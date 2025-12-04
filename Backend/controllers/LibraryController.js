const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const MIN_WORDS = 3000;     // Slightly higher = better quality
const MAX_WORDS = 4200;
const WORDS_PER_PAGE = 250;

const TITLE_BLACKLIST = [
  "history", "vol ", "volume", "index", "dictionary", "encyclopedia", "catalogue",
  "collected works", "complete works", "letters", "memoirs", "biography", "report",
  "manual", "bibliography", "anthology of", "selected", "poetry", "poems", "verse",
  "plays", "drama", "essays", "juvenile", "fairy tales", "tales for children"
];

const SUBJECT_BLACKLIST = [
  "history", "biography", "periodicals", "politics", "reference", "poetry",
  "drama", "letters", "essays", "juvenile literature", "fairy tales", "children"
];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

let perfectBooks = [];

// ============================================
// CACHE
// ============================================
function loadCache() {
  const candidates = [
    CACHE_FILE,
    path.join(process.cwd(), 'Backend', 'data', 'perfect-books-cache.json'),
    path.join(process.cwd(), 'data', 'perfect-books-cache.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data) && data.length > 0) {
          perfectBooks = data;
          console.log(`Loaded ${perfectBooks.length} perfect books from cache`);
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

function saveCache(books) {
  if (IS_SERVERLESS) return;
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(books, null, 2));
    console.log(`Cache saved: ${books.length} books`);
  } catch (e) {
    console.log("Cache save failed:", e.message);
  }
}

// ============================================
// SUPER STRICT CONTENT FILTER (THIS IS THE KEY)
// ============================================
async function processBookContent(textUrl, bookTitle) {
  try {
    const response = await axios.get(textUrl, {
      timeout: 15000,
      maxContentLength: 3 * 1024 * 1024,
      maxRedirects: 5,
      validateStatus: s => s === 200
    });

    let text = response.data;
    if (!text || typeof text !== 'string') return { valid: false };

    // Remove Gutenberg header/footer
    const startMarkers = ["*** START OF THIS PROJECT", "*** START OF THE PROJECT", "START OF THIS PROJECT"];
    const endMarkers = ["*** END OF THIS PROJECT", "*** END OF THE PROJECT", "END OF THIS PROJECT", "*END*"];

    let startIdx = 0;
    let endIdx = text.length;

    for (const m of startMarkers) {
      const i = text.indexOf(m);
      if (i !== -1) {
        const nextLine = text.indexOf('\n', i);
        startIdx = nextLine !== -1 ? nextLine + 1 : i + m.length;
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

    text = text.slice(startIdx, endIdx).trim();
    if (text.length < 12000) return { valid: false }; // Too short after cleanup

    const lowerText = text.toLowerCase();
    const first5k = lowerText.slice(0, 5000);
    const last5k = lowerText.slice(-5000);

    // === REJECT JUNK PATTERNS ===
    const rejectReasons = [
      /\[illustration\]/i,
      /transcriber['’?]?s note/i,
      /errata/i,
      /table of contents.{20,}/i,
      /chapter\s+(?:xx|x{4,}|[ivxlcdm]{5,})/i,  // Too many chapters or high Roman numerals
      /bibliography/i,
      /appendix/i,
      /glossary/i,
      /index\s*$/i,
      /footnote\s*\d+/i,
      /produced by.+distributed proofreading/i,
      /www\.gutenberg\.org\/donate/i,
      /contents\s*$/i,
      /preface.{100,}/i
    ];

    if (rejectReasons.some(r => r.test(first5k) || r.test(last5k))) {
      return { valid: false };
    }

    // === CLEAN TEXT FOR ANALYSIS ===
    const cleanText = text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[_*]/g, '')
      .replace(/[^\w\s\.\,\!\?\;\:\'\"]/g, ' ')
      .trim();

    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) return { valid: false };

    // === READABILITY CHECKS ===
    const sample = cleanText.slice(0, 10000);

    // Too many numbers? → reference book
    const numbers = (cleanText.match(/\b\d+\b/g) || []).length;
    if (numbers / wordCount > 0.07) return { valid: false };

    // Too many short lines? → poetry or play script
    const lines = text.split('\n');
    const shortLines = lines.filter(l => l.trim().length > 0 && l.trim().length < 35);
    if (shortLines.length > lines.length * 0.35) return { valid: false };

    // Too many ALL CAPS words? → old book with bad OCR or play
    const allCaps = (cleanText.match(/\b[A-Z]{4,}\b/g) || []).length;
    if (allCaps > 80) return { valid: false };

    // Must have some dialogue (very strong fiction signal)
    const hasDialogue = /"[^"]{15,}"/.test(text) || /“[^”]{15,}”/.test(text);
    if (!hasDialogue) return { valid: false };

    const pages = Math.round(wordCount / WORDS_PER_PAGE);

    return {
      valid: true,
      content: cleanText,
      wordCount,
      pages
    };

  } catch (err) {
    return { valid: false };
  }
}

// ============================================
// FETCH CANDIDATES
// ============================================
async function loadRawBooks() {
  const urls = [
    "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular",
    "https://gutendex.com/books?languages=en&mime_type=text&copyright=false&sort=popular&page=1",
    "https://gutendex.com/books?languages=en&search=story+OR+tale+OR+adventure&sort=popular"
  ];

  let allBooks = [];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 12000 });
      if (res.data?.results) allBooks.push(...res.data.results);
    } catch (e) {}
  }

  // Dedupe
  allBooks = Array.from(new Map(allBooks.map(b => [b.id, b])).values());

  return allBooks.filter(book => {
    const title = (book.title || "").toLowerCase();
    const hasText = book.formats && (
      book.formats["text/plain"] ||
      book.formats["text/plain; charset=utf-8"] ||
      book.formats["text/plain; charset=us-ascii"]
    );

    if (!hasText) return false;
    if (TITLE_BLACKLIST.some(t => title.includes(t))) return false;
    if (book.subjects?.some(s => SUBJECT_BLACKLIST.some(bad => s.toLowerCase().includes(bad)))) return false;

    return true;
  });
}

// ============================================
// BUILD LIBRARY
// ============================================
async function buildPerfectLibrary() {
  console.log("Building perfect library...");
  const candidates = await loadRawBooks();
  if (candidates.length === 0) return;

  const genres = ["Mystery", "Horror", "Sci-Fi", "Fantasy", "Romance", "Adventure", "Humor"];

  const limit = (fn) => {
    let active = 0;
    const queue = [];
    return (...args) => new Promise((res, rej) => {
      const task = () => {
        active++;
        fn(...args).then(res, rej).finally(() => { active--; if (queue.length) queue.shift()(); });
      };
      if (active < 6) task();
      else queue.push(task);
    });
  };

  const limited = limit(async (book) => {
    const txtUrl = book.formats["text/plain"] || book.formats["text/plain; charset=utf-8"] || book.formats["text/plain; charset=us-ascii"];
    const result = await processBookContent(txtUrl, book.title);

    if (!result.valid) return null;

    return {
      id: `GB${book.id}`,
      title: (book.title || "Untitled").replace(/ by .*/i, '').replace(/,.*/, '').trim(),
      author: book.authors?.[0]?.name?.split(',')[0] || "Unknown Author",
      cover_url: book.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`,
      source_url: txtUrl,
      content: result.content,
      school_level: Math.random() > 0.5 ? "Senior High" : "Junior High",
      grade_range: "7–12",
      age_range: "12–18",
      genre: genres[Math.floor(Math.random() * genres.length)],
      pages: result.pages,
      word_count: result.wordCount,
      reading_time: `${Math.round(result.pages * 2)} mins`
    };
  });

  const results = [];
  for (const book of candidates) {
    const processed = await limited(book);
    if (processed) results.push(processed);
    if (results.length >= 80) break; // Enough for now
  }

  perfectBooks = results;
  saveCache(results);
  console.log(`Perfect library ready: ${perfectBooks.length} high-quality books`);
}

// ============================================
// MAIN HANDLER
// ============================================
loadCache();

async function getStories(req, res) {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma, Expires');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // No cache
    res.setHeader('Cache-Control', 'no-store');

    let { limit = 12, level, genre, refresh } = req.query;
    limit = Math.min(parseInt(limit) || 12, 50);

    if (perfectBooks.length === 0 || refresh === 'true') {
      await buildPerfectLibrary();
    }

    if (perfectBooks.length === 0) {
      return res.status(503).json({
        success: false,
        message: "Building library... Try again in 10 seconds",
        books: []
      });
    }

    let pool = [...perfectBooks];

    if (level === "junior") pool = pool.filter(b => b.school_level === "Junior High");
    if (level === "senior") pool = pool.filter(b => b.school_level === "Senior High");
    if (genre) pool = pool.filter(b => b.genre.toLowerCase() === genre.toLowerCase());

    pool = pool.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      total: pool.length,
      books: pool.slice(0, limit)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { getStories };