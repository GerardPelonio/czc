const axios = require("axios");
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const pageCountCache = new Map();
let perfectBooks = [];

const FAST_BUILD = (process.env.FAST_BUILD === '1' || process.env.FAST_BUILD === 'true');
const FORCE_REFRESH = (process.env.FORCE_REFRESH === '1' || process.env.FORCE_REFRESH === 'true');
let runtimeFastBuild = FAST_BUILD;
let runtimeFullCount = false;
const FAST_DEFAULT_PAGES = 8;
const MAX_ALLOWED_PAGES = 15; // Define the new maximum page count for filtering


const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
// Treat Vercel / production as "serverless": no long-running background builders,
// only read from the pre-generated JSON cache or fall back to live quick pool.
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

function loadCache() {
  // Try multiple candidate paths in case `vercel dev` uses a different CWD
  const candidates = [CACHE_FILE, path.join(process.cwd(), 'Backend', 'data', 'perfect-books-cache.json'), path.join(process.cwd(), 'data', 'perfect-books-cache.json')];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        perfectBooks = data;
        console.log(`Loaded library cache from ${p}: ${perfectBooks.length} books`);
        // watch for updates so `npx vercel dev` picks up changes made while running
        try {
          fs.watchFile(p, { interval: 2000 }, () => {
            try {
              const raw2 = fs.readFileSync(p, 'utf8');
              const data2 = JSON.parse(raw2);
              if (Array.isArray(data2)) {
                perfectBooks = data2;
                console.log(`Detected library cache update: ${perfectBooks.length} books (from ${p})`);
              }
            } catch (e) {
              console.log('Failed to reload cache after change', e && e.message);
            }
          });
        } catch (watchErr) {
          // ignore watchers on some filesystems
        }
        return;
      }
    } catch (e) {
      // try next candidate
    }
  }
  // nothing loaded
  console.log(`No usable library cache found at: ${candidates.join(', ')}`);
}

function saveCache(books) {
  // On Vercel / serverless, filesystem is read-only at runtime.
  if (IS_SERVERLESS) return;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(books), 'utf8');
    console.log(`Saved library cache: ${books.length} books`);
  } catch (e) {
    console.log('Failed to save library cache', e && e.message);
  }
}

// ----------------------------------------------------
// Get page count (5–15 pages only)
// ----------------------------------------------------
async function getPageCount(textUrl, bookId) {
  if (pageCountCache.has(bookId)) return pageCountCache.get(bookId);
  try {
    if (runtimeFullCount) {
      // Full download and count (slower but more accurate) — same approach as generator script
      const { data: text } = await axios.get(textUrl, { timeout: 15000 });

      let cleanText = text;
      const start = text.indexOf("*** START");
      const end = text.indexOf("*** END");
      if (start !== -1 && end !== -1) cleanText = text.slice(start, end);
      cleanText = cleanText.replace(/[\r\n]+/g, "\n").replace(/Project Gutenberg.*/gi, "").trim();
      const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
      let pages = Math.round(wordCount / 275);
      pages = Math.max(5, pages); // Set minimum pages
      // REMOVED: Math.min(15, pages) - Allows us to filter true long books
      pageCountCache.set(bookId, pages);
      return pages;
    }
    // Request a sample and try to estimate total using Content-Range when available.
    const sampleSize = runtimeFastBuild ? 50000 : 200000; // 50KB fast mode, 200KB normal
    const res = await axios.get(textUrl, {
      timeout: runtimeFastBuild ? 4000 : 8000,
      responseType: 'text',
      headers: { Range: `bytes=0-${sampleSize - 1}` }
    });

    const text = res.data || '';
    const sampledBytes = Buffer.byteLength(text, 'utf8') || 1;
    let totalBytes = null;
    const contentRange = res.headers['content-range'] || res.headers['Content-Range'];
    if (contentRange) {
      const m = contentRange.match(/\/(\d+)$/);
      if (m) totalBytes = parseInt(m[1], 10);
    }
    if (!totalBytes && res.headers['content-length']) {
      const cl = parseInt(res.headers['content-length'], 10);
      if (!Number.isNaN(cl)) totalBytes = cl;
    }

    let scale = 1;
    if (totalBytes && sampledBytes > 0) scale = Math.max(1, totalBytes / sampledBytes);

    let cleanText = text;
    const start = text.indexOf("*** START");
    const end = text.indexOf("*** END");
    if (start !== -1 && end !== -1) cleanText = text.slice(start, end);
    cleanText = cleanText.replace(/[\r\n]+/g, "\n").replace(/Project Gutenberg.*/gi, "").trim();
    const sampledWords = cleanText.split(/\s+/).filter(w => w.length > 0).length;
    const estimatedTotalWords = Math.round(sampledWords * scale);

    let pages = Math.round(estimatedTotalWords / 275);
    pages = Math.max(5, pages); // Set minimum pages
    // REMOVED: Math.min(15, pages) - Allows us to filter true long books

    pageCountCache.set(bookId, pages);
    return pages;
  } catch (e) {
    const fallback = 7 + (bookId % 8); // 7–14
    pageCountCache.set(bookId, fallback);
    return fallback;
  }
}

// ----------------------------------------------------
// Load raw books from Gutendex
// ----------------------------------------------------
async function loadRawBooks() {
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  const searchTerms = encodeURIComponent("short story OR short stories OR fable OR parable OR one act");

  try {
    const [p1, p2] = await Promise.all([
      axios.get(`https://gutendex.com/books?languages=en&search=${searchTerms}&sort=popular&page=1`, { timeout: 15000, httpsAgent: agent }),
      axios.get(`https://gutendex.com/books?languages=en&search=${searchTerms}&sort=popular&page=2`, { timeout: 15000, httpsAgent: agent })
    ]);

    const all = [...(p1.data.results || []), ...(p2.data.results || [])];
    console.log(`Gutendex loaded ${all.length} raw books (cert bypass active)`);

    return all.filter(book =>
      book.formats &&
      (book.formats["text/plain"] ||
       book.formats["text/plain; charset=us-ascii"] ||
       book.formats["text/html"])
    );
  } catch {
    console.log("Gutendex unreachable → fallback applied");
    return [];
  }
}

// ----------------------------------------------------
// Quick live pool for serverless/dev — returns a small, fresh set without using cache
// ----------------------------------------------------
async function loadQuickPool(limit = 12, level, age, genre) {
  const raw = await loadRawBooks();
  if (!raw || raw.length === 0) return [];

  let pool = [...raw];
  if (level === "junior") pool = pool.filter(b => (b.subjects || []).join(' ').toLowerCase().includes('junior') || (b.authors?.[0]?.name || '').toLowerCase().includes('junior'));
  if (level === "senior") pool = pool.filter(b => (b.subjects || []).join(' ').toLowerCase().includes('senior') || (b.authors?.[0]?.name || '').toLowerCase().includes('senior'));
  if (age === "12-16") pool = pool.filter(b => true); // hard to detect age via metadata; keep as-is
  if (age === "16-18") pool = pool.filter(b => true);
  if (genre) {
    const cleanGenre = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
    pool = pool.filter(b => ((b.subjects || []).join(', ').toLowerCase().includes(cleanGenre.toLowerCase())));
  }

  // Return top `limit` items mapped to minimal structure, using FAST_DEFAULT_PAGES
  const selected = pool.slice(0, Math.max(limit, 12)).map(b => {
    const txtUrl = Object.values(b.formats || {}).find(v => typeof v === 'string' && (v.includes('text/plain') || v.endsWith('.txt'))) || `https://www.gutenberg.org/files/${b.id}/${b.id}-0.txt`;
    return {
      id: `GB${b.id}`,
      title: (b.title || 'Story').split(/ by |,|\(/i)[0].trim(),
      author: b.authors?.[0]?.name || 'Unknown Author',
      cover_url: b.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
      source_url: txtUrl,
      school_level: 'Junior High', // guess, fallback
      grade_range: '7–10',
      age_range: '12–16',
      genre: 'Drama',
      pages: FAST_DEFAULT_PAGES, // Still use fast default for quick pool
      reading_time: `${Math.round(FAST_DEFAULT_PAGES * 2.3)} minutes`
    };
  });
  return selected.slice(0, limit);
}

// ----------------------------------------------------
// Assign genre using Grok
// ----------------------------------------------------
async function filterWithGrokBrain(rawBooks) {
  if (rawBooks.length === 0) return [];

  if (runtimeFastBuild) {
    // Fast fallback: pick top N by downloads and assign simple genres — avoids Gemini call.
    const fallbackGenres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Adventure", "Fantasy"];
    return rawBooks
      .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
      .slice(0, 45)
      .map((b, i) => ({ id: b.id, level: i < 20 ? "Senior High" : "Junior High", genre: fallbackGenres[i % fallbackGenres.length] }));
  }

  const GROK_PROMPT = `
You are an expert DepEd English teacher in the Philippines.
Pick 70–90 short stories (5–15 pages) safe for Filipino students.
Assign each: school_level ("Junior High" or "Senior High") and genre (Mystery, Horror, Sci-Fi, Humor, Romance, Drama, Adventure, Fantasy)
Return ONLY clean JSON array: [{"id": 1952, "level": "Senior High", "genre": "Horror"}, ...]
Books:
${rawBooks.map(b => `${b.id}: "${b.title}" by ${b.authors?.[0]?.name || "Unknown"}`).join("\n")}
`.trim();

  try {
    const timeoutMs = runtimeFastBuild ? 8000 : 60000;
    const maxOutputTokens = runtimeFastBuild ? 6000 : 60000;
    const res = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ role: "user", parts: [{ text: GROK_PROMPT }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens, responseMimeType: "application/json" },
    }, { timeout: timeoutMs });

    let text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    text = text.replace(/```json|```/g, "").trim();
    let list = JSON.parse(text);

    const validIds = rawBooks.map(b => b.id);
    return list.filter(x => validIds.includes(x.id));

  } catch {
    const fallbackGenres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Adventure", "Fantasy"];
    return rawBooks
      .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
      .slice(0, 85)
      .map((b, i) => ({ id: b.id, level: i < 38 ? "Senior High" : "Junior High", genre: fallbackGenres[i % 8] }));
  }
}

// ----------------------------------------------------
// Build final library
// ----------------------------------------------------
async function buildPerfectLibrary(forceFast = false) {
  runtimeFastBuild = forceFast || FAST_BUILD;
  runtimeFullCount = !runtimeFastBuild;
  console.log("Building CozyClip Library — Philippine Curriculum + Genres");
  const rawBooks = await loadRawBooks();
  const approved = await filterWithGrokBrain(rawBooks);

  // Build books in parallel with limited concurrency to avoid serial downloads.
  function pLimit(concurrency) {
    const queue = [];
    let active = 0;
    const next = () => {
      if (queue.length === 0 || active >= concurrency) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
  }

  const limit = pLimit(runtimeFastBuild ? 10 : 5);
  const tasks = approved.map(item => limit(async () => {
    const b = rawBooks.find(book => book.id === item.id);
    if (!b) return null;
    if (runtimeFullCount) console.log(`Processing book ${b.id} — ${b.title}`);
    const txtUrl = Object.values(b.formats || {}).find(v => typeof v === "string" && (v.includes("text/plain") || v.endsWith(".txt"))) || `https://www.gutenberg.org/files/${b.id}/${b.id}-0.txt`;
    
    // Get the estimated page count (which is now unclamped)
    const estimatedPages = runtimeFastBuild ? FAST_DEFAULT_PAGES : await getPageCount(txtUrl, b.id);
    
    // FIX: Filter out any books that are longer than the desired 15 pages
    if (estimatedPages > MAX_ALLOWED_PAGES) {
        if (runtimeFullCount) console.log(`Dropping book ${b.id} because it is too long (${estimatedPages} pages).`);
        return null;
    }

    // Use the estimated page count for the final metadata
    const finalPages = Math.max(5, estimatedPages); // Ensure a minimum of 5 pages for display

    return {
      id: `GB${b.id}`,
      title: (b.title || "Story").split(/ by |,|\(/i)[0].trim(),
      author: b.authors?.[0]?.name || "Unknown Author",
      cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
      source_url: txtUrl,
      school_level: item.level.includes("Senior") ? "Senior High" : "Junior High",
      grade_range: item.level.includes("Senior") ? "11–12" : "7–10",
      age_range: item.level.includes("Senior") ? "16–18" : "12–16",
      genre: item.genre || "Drama",
      pages: finalPages, // Use the filtered page count
      reading_time: `${Math.round(finalPages * 2.3)} minutes`
    };
  }));

  const books = (await Promise.all(tasks)).filter(Boolean); // Filter out the nulls (long books)

  perfectBooks = books;
  // Persist cache so API can serve immediately on restart
  try { saveCache(books); } catch (e) { /* ignore */ }
  const senior = books.filter(b => b.school_level === "Senior High").length;
  console.log(`LIBRARY READY: ${books.length} books | Senior: ${senior} | Junior: ${books.length - senior}`);
  // After a fast initial build, schedule a full build to refresh content (unless user requested FAST_BUILD mode)
  if (runtimeFastBuild && !FAST_BUILD) {
    console.log('Fast build complete; scheduling a full rebuild in 45s');
    setTimeout(() => buildPerfectLibrary(false), 45 * 1000);
  }
  runtimeFastBuild = FAST_BUILD; // restore default
  runtimeFullCount = !runtimeFastBuild;
}

// Always try to load the pre-generated cache first so API can respond immediately.
loadCache();

// In non-serverless environments (local dev / long-running server), we can
// still build/refresh the library in the background.
if (!IS_SERVERLESS) {
  const cacheExists = fs.existsSync(CACHE_FILE);
  if (!cacheExists || FORCE_REFRESH) {
    console.log('No cache or FORCE_REFRESH is enabled — building library from scratch');
  }
  // If FORCE_REFRESH is set, we force a fresh build even if the cache exists;
  // otherwise prefer fast builds if no cache or FAST_BUILD true.
  const initialFast = FAST_BUILD || (!cacheExists && !FORCE_REFRESH);
  buildPerfectLibrary(initialFast).catch(e => {
    console.log('Initial library build failed', e && e.message);
  });
  setInterval(() => {
    buildPerfectLibrary(false).catch(e => {
      console.log('Periodic library rebuild failed', e && e.message);
    });
  }, 20 * 60 * 1000);
}

// ----------------------------------------------------
// Controller function
// ----------------------------------------------------
async function getStories(req, res) {
  try {
    let { limit = 12, level, age, genre } = req.query;
    limit = Math.min(parseInt(limit) || 12, 50);

    if (perfectBooks.length === 0) {
      // Build a quick live pool and return it for serverless environments (fast but not fully cached)
      try {
        const quick = await loadQuickPool(limit, level, age, genre);
        if (quick.length > 0) {
          return res.json({ success: true, total: quick.length, applied_filters: { level, age, genre }, books: quick });
        }
      } catch (e) {
        console.log('Quick pool failed', e && e.message);
      }

      return res.json({ success: false, message: "Library loading... (30–60s first time)", books: [] });
    }

    let pool = [...perfectBooks];
    if (level === "junior") pool = pool.filter(b => b.school_level === "Junior High");
    if (level === "senior") pool = pool.filter(b => b.school_level === "Senior High");
    if (age === "12-16") pool = pool.filter(b => b.age_range === "12–16");
    if (age === "16-18") pool = pool.filter(b => b.age_range === "16–18");
    if (genre) {
      const cleanGenre = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
      pool = pool.filter(b => b.genre === cleanGenre);
    }

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = pool.slice(0, limit);
    return res.json({
      success: true,
      total: selected.length,
      applied_filters: { level, age, genre },
      books: selected
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch stories" });
  }
}

module.exports = { getStories };
