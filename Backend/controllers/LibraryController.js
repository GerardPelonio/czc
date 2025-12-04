const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION: STRICT 10-15 PAGES
// ============================================
const MIN_PAGES = 10;
const MAX_PAGES = 15;
const WORDS_PER_PAGE = 250; 
const MIN_WORDS = 2500;
const MAX_WORDS = 4500; // Hard cap

// Blacklisted words in TITLES (Case insensitive)
const TITLE_BLACKLIST = [
  "history", "vol", "volume", "index", "dictionary", 
  "encyclopedia", "collected", "complete", "works", 
  "memoirs", "biography", "letters", "report", "manual"
];

// Blacklisted words in SUBJECTS
const SUBJECT_BLACKLIST = [
  "history", "biography", "periodicals", "politics", 
  "reference", "instructional"
];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';
const FORCE_REFRESH = (process.env.FORCE_REFRESH === '1' || process.env.FORCE_REFRESH === 'true');

let perfectBooks = [];

// [Load/Save Cache functions remain standard]
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
// CRITICAL: ACCURATE PAGE COUNTING & FILTERING
// ============================================
async function processBookContent(textUrl, bookTitle) {
  try {
    // 1. Download Content
    // We set a max content length. If it exceeds this, it's definitely too big.
    // 15 pages * 250 words * ~6 chars/word = ~22KB. 
    // We allow 60KB to be safe for metadata/license.
    const MAX_SIZE_BYTES = 60 * 1024; 

    const response = await axios.get(textUrl, { 
      timeout: 8000,
      maxContentLength: MAX_SIZE_BYTES, // Will throw error if larger
      validateStatus: (status) => status === 200
    });

    let text = response.data || '';

    // 2. Structure Check (The "History Book" Detector)
    // If we find "Chapter 20" or "Index", it's a long book, even if the file is small.
    const structureChecks = [
        /Chapter\s+(?:XX|20)/i,  // Chapter 20+
        /Index\s*$/i,            // Ends with Index
        /Bibliography/i,         // Academic book
        /Table of Contents/i     // Usually implies a long collection
    ];

    for (const check of structureChecks) {
        if (check.test(text.substring(0, 5000)) || check.test(text.substring(text.length - 5000))) {
            // console.log(`  ✗ REJECTED "${bookTitle}": Found structure marker (Index/Chapter XX)`);
            return { valid: false };
        }
    }

    // 3. Strip Gutenberg Headers
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

    // 4. Count Words
    const cleanText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(' ').length;

    // 5. Strict Range Check
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
        // console.log(`  ✗ REJECTED "${bookTitle}": ${wordCount} words (Req: ${MIN_WORDS}-${MAX_WORDS})`);
        return { valid: false };
    }

    const pages = Math.round(wordCount / WORDS_PER_PAGE);
    
    return { valid: true, pages, wordCount };

  } catch (err) {
    // If error is "maxContentLength size exceeded", it's definitely a novel/history book
    if (err.code === 'ERR_BAD_RESPONSE' || err.message.includes('maxContentLength')) {
        // console.log(`  ✗ REJECTED "${bookTitle}": File too large (Novel/History)`);
        return { valid: false };
    }
    return { valid: false };
  }
}

// ============================================
// Load Books with Metadata Filtering
// ============================================
async function loadRawBooks() {
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  
  // Search specifically for "short stories" topic to avoid general history
  const urls = [
    `https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular`,
    `https://gutendex.com/books?languages=en&search=tale&sort=popular`
  ];

  let allBooks = [];
  console.log('Fetching candidates from Gutendex...');

  try {
    for (const url of urls) {
        const res = await axios.get(url, { timeout: 10000, httpsAgent: agent });
        if (res.data.results) allBooks.push(...res.data.results);
    }

    // De-duplicate
    allBooks = Array.from(new Map(allBooks.map(item => [item.id, item])).values());

    // ----------------------------------------------------
    // 🛡️ LEVEL 1 FILTER: METADATA (Title & Subjects)
    // ----------------------------------------------------
    const filtered = allBooks.filter(b => {
        const titleLower = (b.title || "").toLowerCase();
        
        // Check Title Blacklist
        if (TITLE_BLACKLIST.some(bad => titleLower.includes(bad))) return false;

        // Check Subject Blacklist
        if (b.subjects && b.subjects.some(s => SUBJECT_BLACKLIST.some(bad => s.toLowerCase().includes(bad)))) {
            return false;
        }

        // Must have text format
        return b.formats && (b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"]);
    });

    console.log(`✓ Metadata Filter: Reduced ${allBooks.length} -> ${filtered.length} candidates.`);
    return filtered;

  } catch (err) {
    console.log("✗ Gutendex connection failed:", err.message);
    return [];
  }
}

// ============================================
// Build Library
// ============================================
async function buildPerfectLibrary() {
  console.log('\n========================================');
  console.log(`BUILDING LIBRARY (STRICT 10-15 PAGES)`);
  console.log('========================================\n');
  
  const rawBooks = await loadRawBooks();
  if (rawBooks.length === 0) return;

  const genres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Fantasy"];
  
  // Concurrency Limiter
  function pLimit(concurrency) {
    const queue = [];
    let active = 0;
    const next = () => {
      if (queue.length === 0 || active >= concurrency) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => { 
      queue.push({ fn, resolve, reject }); 
      next(); 
    });
  }

  const limit = pLimit(5); 
  let accepted = 0;

  const tasks = rawBooks.map(b => limit(async () => {
    const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"];
    if (!txtUrl) return null;

    // ----------------------------------------------------
    // 🛡️ LEVEL 2 FILTER: CONTENT ANALYSIS
    // ----------------------------------------------------
    const stats = await processBookContent(txtUrl, b.title);

    if (!stats.valid) return null;

    accepted++;
    console.log(`  ✓ ACCEPTED: "${b.title.substring(0, 40)}..." | ${stats.pages} pgs | ${stats.wordCount} words`);

    return {
      id: `GB${b.id}`,
      title: (b.title || "Untitled").split(/ by |,/i)[0].trim(),
      author: b.authors?.[0]?.name || "Unknown",
      cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
      source_url: txtUrl,
      school_level: Math.random() > 0.5 ? "Senior High" : "Junior High",
      grade_range: "7–12",
      age_range: "12–18",
      genre: genres[Math.floor(Math.random() * genres.length)],
      pages: stats.pages,
      word_count: stats.wordCount,
      reading_time: `${Math.round(stats.pages * 2)} mins`
    };
  }));

  const results = (await Promise.all(tasks)).filter(Boolean);

  perfectBooks = results;
  saveCache(results);
  
  console.log('\n========================================');
  console.log(`LIBRARY READY: ${perfectBooks.length} Verified Books`);
  console.log('========================================\n');
}

// ============================================
// Init & API
// ============================================
loadCache();

if (!IS_SERVERLESS) {
  if (perfectBooks.length === 0 || FORCE_REFRESH) {
    buildPerfectLibrary();
  }
}

async function getStories(req, res) {
  try {
    let { limit = 12, level, genre } = req.query;
    limit = Math.min(parseInt(limit) || 12, 50);

    if (perfectBooks.length === 0) {
      return res.json({ 
        success: false, 
        message: "Building library... please refresh in 30 seconds.",
        books: [] 
      });
    }

    let pool = [...perfectBooks];
    
    // Filters
    if (level === "junior") pool = pool.filter(b => b.school_level === "Junior High");
    if (level === "senior") pool = pool.filter(b => b.school_level === "Senior High");
    if (genre) pool = pool.filter(b => b.genre.toLowerCase() === genre.toLowerCase());

    // Shuffle
    pool = pool.sort(() => 0.5 - Math.random());

    return res.json({
      success: true,
      total: pool.slice(0, limit).length,
      books: pool.slice(0, limit)
    });
    
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStories };
