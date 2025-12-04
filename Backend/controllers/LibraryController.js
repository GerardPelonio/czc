const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const MIN_PAGES = 10;
const MAX_PAGES = 15;
const WORDS_PER_PAGE = 250; 
const MIN_WORDS = 2500;
const MAX_WORDS = 4500; 

const TITLE_BLACKLIST = [
  "history", "vol", "volume", "index", "dictionary", 
  "encyclopedia", "collected", "complete", "works", 
  "memoirs", "biography", "letters", "report", "manual"
];

const SUBJECT_BLACKLIST = [
  "history", "biography", "periodicals", "politics", 
  "reference", "instructional"
];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

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
        return;
      }
    } catch (e) {}
  }
}

function saveCache(books) {
  // In Vercel (Serverless), we cannot save to disk permanently, 
  // but we try anyway for local development.
  if (IS_SERVERLESS) return;
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(books, null, 2), 'utf8');
  } catch (e) {
    console.log('Failed to save cache:', e.message);
  }
}

async function processBookContent(textUrl, bookTitle) {
  try {
    const MAX_SIZE_BYTES = 60 * 1024; // 60KB limit
    const response = await axios.get(textUrl, { 
      timeout: 8000,
      maxContentLength: MAX_SIZE_BYTES, 
      validateStatus: (status) => status === 200
    });

    let text = response.data || '';

    const structureChecks = [
        /Chapter\s+(?:XX|20)/i, 
        /Index\s*$/i,           
        /Bibliography/i,        
        /Table of Contents/i    
    ];

    for (const check of structureChecks) {
        if (check.test(text.substring(0, 5000)) || check.test(text.substring(text.length - 5000))) {
            return { valid: false };
        }
    }

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

    const cleanText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(' ').length;

    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
        return { valid: false };
    }

    const pages = Math.round(wordCount / WORDS_PER_PAGE);
    return { valid: true, pages, wordCount };

  } catch (err) {
    return { valid: false };
  }
}

async function loadRawBooks() {
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
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
    allBooks = Array.from(new Map(allBooks.map(item => [item.id, item])).values());

    return allBooks.filter(b => {
        const titleLower = (b.title || "").toLowerCase();
        if (TITLE_BLACKLIST.some(bad => titleLower.includes(bad))) return false;
        if (b.subjects && b.subjects.some(s => SUBJECT_BLACKLIST.some(bad => s.toLowerCase().includes(bad)))) return false;
        return b.formats && (b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"]);
    });
  } catch (err) {
    console.log("✗ Gutendex connection failed:", err.message);
    return [];
  }
}

async function buildPerfectLibrary() {
  console.log('--- Building Library (On-Demand) ---');
  const rawBooks = await loadRawBooks();
  if (rawBooks.length === 0) return;

  const genres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Fantasy"];
  
  // Simple concurrency limiter
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

  const tasks = rawBooks.map(b => limit(async () => {
    const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"];
    if (!txtUrl) return null;

    const stats = await processBookContent(txtUrl, b.title);
    if (!stats.valid) return null;

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
  console.log(`Library Ready: ${perfectBooks.length} books.`);
}

// ============================================
// MAIN CONTROLLER
// ============================================

// Attempt to load cache on startup, but don't fail if missing
loadCache();

async function getStories(req, res) {
  try {
    // 1. Critical: Disable Vercel/Browser Caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let { limit = 12, level, genre, refresh } = req.query;
    limit = Math.min(parseInt(limit) || 12, 50);

    // 2. Lazy Loading / Force Refresh Logic
    // If we have no books in memory OR the user specifically requested a refresh
    if (perfectBooks.length === 0 || refresh === 'true') {
        console.log("Cache miss or refresh requested. Building library now...");
        await buildPerfectLibrary();
    }

    // 3. Fallback if build fails (e.g. timeout)
    if (perfectBooks.length === 0) {
       return res.status(503).json({ 
         success: false, 
         message: "Library is rebuilding. Please try again in 5 seconds.",
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
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStories };
