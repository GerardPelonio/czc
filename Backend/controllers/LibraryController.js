const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
// Wide range to capture valid short stories (8-25 pages)
const MIN_WORDS = 2000; 
const MAX_WORDS = 6000; 
const WORDS_PER_PAGE = 250;
const TARGET_BOOK_COUNT = 55; 

// Skip massive collections immediately by title
const IGNORE_TITLES = [
  "history", "complete", "works", "anthology", "volume", "vol.", 
  "index", "dictionary", "encyclopedia", "handbook", "manual", "report", 
  "memoirs", "letters", "poems", "poetry", "plays", "collection"
];

// Search these topics to find diverse books
const TOPICS = ["mystery", "horror", "science fiction", "adventure", "fantasy", "humor", "suspense"];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

// In-memory storage
let perfectBooks = [];

// ============================================
// HELPERS
// ============================================

function loadCache() {
  const candidates = [
    CACHE_FILE, 
    path.join(process.cwd(), 'Backend', 'data', 'perfect-books-cache.json'), 
    path.join(process.cwd(), 'data', 'perfect-books-cache.json')
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        perfectBooks = data;
        console.log(`✓ Loaded ${perfectBooks.length} books from cache: ${p}`);
        
        // --- CRITICAL FIX: VALIDATE CONTENT ---
        // If the first book has no content, the cache is stale/useless.
        if (!perfectBooks[0].content || perfectBooks[0].content.length < 100) {
            console.log("⚠️ Cache found but missing content. Marking for rebuild.");
            perfectBooks = []; // Clear it to force rebuild
        }
        return;
      }
    } catch (e) {}
  }
}

function saveCache(books) {
  if (IS_SERVERLESS) return;
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(books, null, 2), 'utf8');
  } catch (e) {
    console.log('Failed to save cache:', e.message);
  }
}

// ============================================
// CORE BUILDER LOGIC
// ============================================

async function processBook(textUrl) {
  try {
    const response = await axios.get(textUrl, { 
      timeout: 10000, 
      maxContentLength: 3 * 1024 * 1024, // 3MB limit
      validateStatus: (status) => status === 200
    });

    let text = response.data || '';

    // --- A. Structure Check ---
    if (/Chapter\s+(?:15|20|XX)/i.test(text) || /Index\s*$/i.test(text.slice(-5000))) {
        return { valid: false };
    }

    // --- B. CLEANING ---
    const startMarkers = ["*** START", "START OF THIS PROJECT", "Produced by"];
    const endMarkers = ["*** END", "End of the Project", "End of Project"];
    
    let startIdx = 0;
    let endIdx = text.length;

    for (const m of startMarkers) {
        const i = text.indexOf(m);
        if (i !== -1) {
            const nextLine = text.indexOf('\n', i);
            if (nextLine !== -1) startIdx = nextLine + 1;
            break;
        }
    }
    for (const m of endMarkers) {
        const i = text.lastIndexOf(m);
        if (i !== -1) {
            endIdx = i;
            break;
        }
    }
    if (endIdx > startIdx) text = text.slice(startIdx, endIdx);

    // Remove License junk and clean whitespace
    let cleanText = text
        .replace(/Project Gutenberg/gi, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n") 
        .trim();

    // --- C. Word Count ---
    const words = cleanText.split(/\s+/);
    const wordCount = words.length;

    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) return { valid: false };

    const pages = Math.round(wordCount / WORDS_PER_PAGE);
    return { valid: true, pages, wordCount, cleanText };

  } catch (err) {
    return { valid: false };
  }
}

async function buildPerfectLibrary() {
  console.log('--- Rebuilding Library (Robust Mode) ---');
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  let verifiedBooks = [];
  let scannedIds = new Set();

  // Loop through topics until we have enough books
  for (const topic of TOPICS) {
    if (verifiedBooks.length >= TARGET_BOOK_COUNT) break;
    
    // Fetch first 2 pages of this genre to save time
    for (let page = 1; page <= 2; page++) {
       if (verifiedBooks.length >= TARGET_BOOK_COUNT) break;

       try {
         const url = `https://gutendex.com/books?languages=en&topic=${topic}&sort=popular&page=${page}`;
         const res = await axios.get(url, { timeout: 8000, httpsAgent: agent });
         const results = res.data.results || [];

         for (const b of results) {
            if (verifiedBooks.length >= TARGET_BOOK_COUNT) break;
            if (scannedIds.has(b.id)) continue; 
            scannedIds.add(b.id);

            if (IGNORE_TITLES.some(bad => b.title.toLowerCase().includes(bad))) continue;
            
            const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"] || b.formats["text/plain; charset=us-ascii"];
            if (!txtUrl) continue;

            // Analyze
            const analysis = await processBook(txtUrl);

            if (analysis.valid) {
                const randomLevel = Math.random() > 0.5 ? "Senior High" : "Junior High";
                const genreTitle = topic.charAt(0).toUpperCase() + topic.slice(1);

                verifiedBooks.push({
                    id: `GB${b.id}`,
                    title: (b.title || "Untitled").split(/ by |,/i)[0].trim(),
                    author: b.authors?.[0]?.name || "Unknown Author",
                    cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
                    source_url: txtUrl,
                    content: analysis.cleanText, // SAVING CONTENT
                    school_level: randomLevel,
                    grade_range: randomLevel === "Senior High" ? "11–12" : "7–10",
                    age_range: randomLevel === "Senior High" ? "16–18" : "12–16",
                    genre: genreTitle, 
                    pages: analysis.pages,
                    word_count: analysis.wordCount,
                    reading_time: `${Math.round(analysis.pages * 2)} mins`
                });
            }
         }
       } catch (e) {
         console.log(`Genre fetch error: ${e.message}`);
       }
    }
  }

  perfectBooks = verifiedBooks;
  saveCache(verifiedBooks);
  console.log(`Library Ready: ${perfectBooks.length} readable books.`);
}

// ============================================
// MAIN CONTROLLER
// ============================================

// Attempt load on startup
loadCache();

async function getStories(req, res) {
  try {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cache-Control, Pragma, Expires');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // 2. Cache Control
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let { limit = 12, level, genre, refresh } = req.query;
    limit = Math.min(parseInt(limit) || 12, 50);

    // 3. Auto-Heal: Rebuild if empty OR if missing content
    if (perfectBooks.length === 0 || refresh === 'true') {
        console.log("Library empty or stale. Building now...");
        await buildPerfectLibrary();
    }

    // 4. Fail-safe
    if (perfectBooks.length === 0) {
       return res.status(503).json({ 
         success: false, 
         message: "Library is rebuilding. Please try again in 10 seconds.",
         books: [] 
       });
    }

    // 5. Filter for READABLE books only
    let pool = perfectBooks.filter(b => {
        return b.content && typeof b.content === 'string' && b.content.length > 500;
    });
    
    // Fallback if filter killed everything (should not happen with new logic)
    if (pool.length === 0 && perfectBooks.length > 0) {
        console.log("Panic: All books unreadable. Rebuilding...");
        await buildPerfectLibrary(); // Try one more time
        pool = perfectBooks;
    }

    // Apply Query Filters
    if (level === "junior") pool = pool.filter(b => b.school_level === "Junior High");
    if (level === "senior") pool = pool.filter(b => b.school_level === "Senior High");
    if (genre) pool = pool.filter(b => b.genre.toLowerCase() === genre.toLowerCase());

    pool = pool.sort(() => 0.5 - Math.random());

    return res.json({
      success: true,
      total: pool.slice(0, limit).length,
      books: pool.slice(0, limit)
    });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStories };