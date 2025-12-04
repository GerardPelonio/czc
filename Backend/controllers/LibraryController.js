const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIG
// ============================================
const MIN_WORDS = 3000;
const MAX_WORDS = 4200;
const WORDS_PER_PAGE = 250;

const TITLE_BLACKLIST = ["history","vol ","volume","index","dictionary","encyclopedia","letters","memoirs","biography","poetry","essays","plays","juvenile"];
const SUBJECT_BLACKLIST = ["history","biography","poetry","drama","letters","essays","juvenile literature","fairy tales"];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS;

let perfectBooks = [];

// ============================================
// CACHE
// ============================================
function loadCache() {
  const paths = [CACHE_FILE, path.join(process.cwd(), 'data', 'perfect-books-cache.json')];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data) && data.length > 0) {
          perfectBooks = data;
          console.log(`Cache loaded: ${perfectBooks.length} books`);
          return true;
        }
      }
    } catch (_) {}
  }
  return false;
}

function saveCache() {
  if (IS_SERVERLESS) return;
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(perfectBooks, null, 2));
    console.log(`Cache saved: ${perfectBooks.length} books`);
  } catch (e) { console.log("Cache save failed:", e.message); }
}

// ============================================
// STRICT TEXT DOWNLOADER & VALIDATOR
// ============================================
async function downloadAndValidateText(url, title) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxContentLength: 3 * 1024 * 1024,
        validateStatus: status => status === 200,
      });

      let text = response.data;
      if (typeof text !== 'string' || text.length < 10000) return null;

      // Strip Gutenberg boilerplate
      const start = text.search(/\*\*\* START OF (THIS|THE) PROJECT GUTENBERG/i);
      const end = text.search(/\*\*\* END OF (THIS|THE) PROJECT GUTENBERG/i);

      if (start !== -1) {
        const lineAfter = text.indexOf('\n', start);
        text = lineAfter !== -1 ? text.slice(lineAfter + 1) : text.slice(start);
      }
      if (end !== -1) text = text.slice(0, end);

      text = text.trim();
      if (text.length < 12000) return null;

      // Clean & count words
      const clean = text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/[_*]/g, '')
        .trim();

      const words = clean.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;

      if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) return null;

      // Final sanity checks
      if (!/["“][^"“”]{15,}[”"]/.test(text)) return null; // must have dialogue
      if ((clean.match(/\b\d+\b/g) || []).length / wordCount > 0.08) return null;

      return {
        content: clean,
        wordCount,
        pages: Math.round(wordCount / WORDS_PER_PAGE)
      };

    } catch (err) {
      if (attempt === 2) console.log(`Failed ${title} (${url}):`, err.message);
      await new Promise(r => setTimeout(r, 1000)); // wait before retry
    }
  }
  return null;
}

// ============================================
// FETCH CANDIDATES
// ============================================
async function loadCandidates() {
  const urls = [
    "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular",
    "https://gutendex.com/books?languages=en&search=story+OR+tale&copyright=false&sort=popular"
  ];

  let books = [];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      if (res.data?.results) books.push(...res.data.results);
    } catch (e) {}
  }

  // Dedupe + filter
  books = Array.from(new Map(books.map(b => [b.id, b])).values());

  return books.filter(book => {
    const title = (book.title || "").toLowerCase();
    if (TITLE_BLACKLIST.some(t => title.includes(t))) return false;
    if (book.subjects?.some(s => SUBJECT_BLACKLIST.some(bad => s.toLowerCase().includes(bad)))) return false;

    const txtUrl = book.formats?.["text/plain"] || book.formats?.["text/plain; charset=utf-8"] || book.formats?.["text/plain; charset=us-ascii"];
    if (!txtUrl || !txtUrl.includes('gutenberg.org')) return false;

    return true;
  });
}

// ============================================
// BUILD LIBRARY — ONLY SUCCESSFUL DOWNLOADS
// ============================================
async function buildPerfectLibrary() {
  console.log("Building perfect library (only books with real text)...");
  if (perfectBooks.length >= 30) return; // already good

  const candidates = await loadCandidates();
  const genres = ["Mystery","Horror","Sci-Fi","Fantasy","Romance","Adventure","Humor"];

  const limiter = (concurrency) => {
    const queue = []; let active = 0;
    return (task) => new Promise((res) => {
      const run = async () => { active++; try { res(await task()); } finally { active--; if (queue.length) queue.shift()(); }};
      if (active < concurrency) run(); else queue.push(run);
    });
  };
  const run = limiter(6);

  const results = [];
  for (const book of candidates) {
    if (results.length >= 100) break;

    const txtUrl = book.formats["text/plain"] || book.formats["text/plain; charset=utf-8"] || book.formats["text/plain; charset=us-ascii"];
    const validated = await run(() => downloadAndValidateText(txtUrl, book.title));

    if (validated) {
      results.push({
        id: `GB${book.id}`,
        title: (book.title || "Untitled").replace(/ by .*/i, '').replace(/,.*/, '').trim(),
        author: (book.authors?.[0]?.name || "Unknown").split(',')[0],
        cover_url: book.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`,
        source_url: txtUrl,
        content: validated.content,           // GUARANTEED to exist
        word_count: validated.wordCount,
        pages: validated.pages,
        reading_time: `${Math.round(validated.pages * 2)} mins`,
        genre: genres[Math.floor(Math.random() * genres.length)],
        school_level: Math.random() > 0.5 ? "Senior High" : "Junior High",
        grade_range: "7–12",
        age_range: "12–18"
      });
      console.log(`Added: ${book.title} (${validated.wordCount} words)`);
    }
  }

  perfectBooks = results;
  saveCache();
  console.log(`Library ready: ${perfectBooks.length} PERFECT books with real content`);
}

// ============================================
// API HANDLER
// ============================================
loadCache();

async function getStories(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { limit = 12, level, genre, refresh } = req.query;
  const lim = Math.min(parseInt(limit) || 12, 50);

  if (perfectBooks.length === 0 || refresh === 'true') {
    await buildPerfectLibrary();
  }

  if (perfectBooks.length === 0) {
    return res.status(503).json({ success: false, message: "Building library... Try again in 10s", books: [] });
  }

  let list = [...perfectBooks];
  if (level === "junior") list = list.filter(b => b.school_level === "Junior High");
  if (level === "senior") list = list.filter(b => b.school_level === "Senior High");
  if (genre) list = list.filter(b => b.genre.toLowerCase() === genre.toLowerCase());

  list.sort(() => Math.random() - 0.5);

  res.json({
    success: true,
    total: list.length,
    books: list.slice(0, lim).map(b => ({ ...b, content: undefined })) // don't send full text in list
  });
}

module.exports = { getStories };