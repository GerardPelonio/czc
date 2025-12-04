// const axios = require("axios");
// const fs = require('fs');
// const path = require('path');

// // ============================================
// // CONFIGURATION
// // ============================================
// const MIN_PAGES = 10;
// const MAX_PAGES = 15;
// const WORDS_PER_PAGE = 250; 
// const MIN_WORDS = 2500;
// const MAX_WORDS = 4500; 

// const TITLE_BLACKLIST = [
//   "history", "vol", "volume", "index", "dictionary", 
//   "encyclopedia", "collected", "complete", "works", 
//   "memoirs", "biography", "letters", "report", "manual"
// ];

// const SUBJECT_BLACKLIST = [
//   "history", "biography", "periodicals", "politics", 
//   "reference", "instructional"
// ];

// const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
// const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

// // In-memory storage (persists while Vercel function is warm)
// let perfectBooks = [];

// // ============================================
// // HELPERS
// // ============================================

// function loadCache() {
//   const candidates = [
//     CACHE_FILE, 
//     path.join(process.cwd(), 'Backend', 'data', 'perfect-books-cache.json'), 
//     path.join(process.cwd(), 'data', 'perfect-books-cache.json')
//   ];
//   for (const p of candidates) {
//     try {
//       if (!fs.existsSync(p)) continue;
//       const raw = fs.readFileSync(p, 'utf8');
//       const data = JSON.parse(raw);
//       if (Array.isArray(data) && data.length > 0) {
//         perfectBooks = data;
//         console.log(`✓ Loaded ${perfectBooks.length} books from cache: ${p}`);
//         return;
//       }
//     } catch (e) {}
//   }
// }

// function saveCache(books) {
//   // On Vercel, we cannot save to disk permanently.
//   if (IS_SERVERLESS) return;
//   try {
//     const dir = path.dirname(CACHE_FILE);
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//     fs.writeFileSync(CACHE_FILE, JSON.stringify(books, null, 2), 'utf8');
//   } catch (e) {
//     console.log('Failed to save cache:', e.message);
//   }
// }

// async function processBookContent(textUrl, bookTitle) {
//   try {
//     // Increased limit to 2MB to allow downloading full stories before processing
//     const MAX_SIZE_BYTES = 2 * 1024 * 1024; 
//     const response = await axios.get(textUrl, { 
//       timeout: 8000,
//       maxContentLength: MAX_SIZE_BYTES, 
//       validateStatus: (status) => status === 200
//     });

//     let text = response.data || '';

//     const structureChecks = [
//         /Chapter\s+(?:XX|20)/i, 
//         /Index\s*$/i,           
//         /Bibliography/i,        
//         /Table of Contents/i    
//     ];

//     for (const check of structureChecks) {
//         if (check.test(text.substring(0, 5000)) || check.test(text.substring(text.length - 5000))) {
//             return { valid: false };
//         }
//     }

//     const startMarkers = ["*** START", "START OF THIS PROJECT", "Produced by"];
//     const endMarkers = ["*** END", "End of the Project", "End of Project"];
//     let startIdx = 0;
//     let endIdx = text.length;

//     for (const m of startMarkers) {
//         const i = text.indexOf(m);
//         if (i !== -1) {
//             const nextLine = text.indexOf('\n', i);
//             if (nextLine !== -1) startIdx = nextLine + 1;
//             break;
//         }
//     }

//     for (const m of endMarkers) {
//         const i = text.lastIndexOf(m);
//         if (i !== -1) {
//             endIdx = i;
//             break;
//         }
//     }

//     if (endIdx > startIdx) text = text.slice(startIdx, endIdx);

//     // Clean whitespace for word counting and reading
//     const cleanText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
//     const wordCount = cleanText.split(' ').length;

//     if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
//         return { valid: false };
//     }

//     const pages = Math.round(wordCount / WORDS_PER_PAGE);
    
//     // UPDATED: Now returning the full content so it can be saved to the object
//     return { valid: true, pages, wordCount, content: cleanText };

//   } catch (err) {
//     return { valid: false };
//   }
// }

// async function loadRawBooks() {
//   const agent = new (require("https").Agent)({ rejectUnauthorized: false });
//   const urls = [
//     `https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular`,
//     `https://gutendex.com/books?languages=en&search=tale&sort=popular`
//   ];

//   let allBooks = [];
//   console.log('Fetching candidates from Gutendex...');

//   try {
//     for (const url of urls) {
//         const res = await axios.get(url, { timeout: 10000, httpsAgent: agent });
//         if (res.data.results) allBooks.push(...res.data.results);
//     }
//     allBooks = Array.from(new Map(allBooks.map(item => [item.id, item])).values());

//     return allBooks.filter(b => {
//         const titleLower = (b.title || "").toLowerCase();
//         if (TITLE_BLACKLIST.some(bad => titleLower.includes(bad))) return false;
//         if (b.subjects && b.subjects.some(s => SUBJECT_BLACKLIST.some(bad => s.toLowerCase().includes(bad)))) return false;
//         return b.formats && (b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"]);
//     });
//   } catch (err) {
//     console.log("✗ Gutendex connection failed:", err.message);
//     return [];
//   }
// }

// async function buildPerfectLibrary() {
//   console.log('--- Building Library (On-Demand) ---');
//   const rawBooks = await loadRawBooks();
//   if (rawBooks.length === 0) return;

//   const genres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Fantasy"];
  
//   function pLimit(concurrency) {
//     const queue = [];
//     let active = 0;
//     const next = () => {
//       if (queue.length === 0 || active >= concurrency) return;
//       active++;
//       const { fn, resolve, reject } = queue.shift();
//       fn().then(resolve, reject).finally(() => { active--; next(); });
//     };
//     return (fn) => new Promise((resolve, reject) => { 
//       queue.push({ fn, resolve, reject }); 
//       next(); 
//     });
//   }

//   const limit = pLimit(5); 

//   const tasks = rawBooks.map(b => limit(async () => {
//     const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"];
//     if (!txtUrl) return null;

//     const stats = await processBookContent(txtUrl, b.title);
//     if (!stats.valid) return null;

//     return {
//       id: `GB${b.id}`,
//       title: (b.title || "Untitled").split(/ by |,/i)[0].trim(),
//       author: b.authors?.[0]?.name || "Unknown",
//       cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
//       source_url: txtUrl,
//       // UPDATED: Saving the full text content so the frontend Reader works
//       content: stats.content, 
//       school_level: Math.random() > 0.5 ? "Senior High" : "Junior High",
//       grade_range: "7–12",
//       age_range: "12–18",
//       genre: genres[Math.floor(Math.random() * genres.length)],
//       pages: stats.pages,
//       word_count: stats.wordCount,
//       reading_time: `${Math.round(stats.pages * 2)} mins`
//     };
//   }));

//   const results = (await Promise.all(tasks)).filter(Boolean);
//   perfectBooks = results;
//   saveCache(results);
//   console.log(`Library Ready: ${perfectBooks.length} books.`);
// }

// // ============================================
// // MAIN CONTROLLER
// // ============================================

// // Attempt load on startup
// loadCache();

// async function getStories(req, res) {
//   try {
//     // 1. CORS CONFIGURATION (Crucial for Vercel/Frontend communication)
//     res.setHeader('Access-Control-Allow-Credentials', true);
//     res.setHeader('Access-Control-Allow-Origin', '*'); 
//     res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
//     // UPDATED: Added "Expires" to the allowed headers list to fix your CORS error
//     res.setHeader(
//       'Access-Control-Allow-Headers',
//       'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cache-Control, Pragma, Expires'
//     );

//     // Handle Preflight Request
//     if (req.method === 'OPTIONS') {
//       return res.status(200).end();
//     }

//     // 2. Disable Caching
//     res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
//     res.setHeader('Pragma', 'no-cache');
//     res.setHeader('Expires', '0');

//     let { limit = 12, level, genre, refresh } = req.query;
//     limit = Math.min(parseInt(limit) || 12, 50);

//     // 3. Lazy Loading / Force Refresh Logic
//     if (perfectBooks.length === 0 || refresh === 'true') {
//         console.log("Cache miss or refresh requested. Building library now...");
//         await buildPerfectLibrary();
//     }

//     // 4. Fallback if build fails
//     if (perfectBooks.length === 0) {
//        return res.status(503).json({ 
//          success: false, 
//          message: "Library is rebuilding. Please try again in 5 seconds.",
//          books: [] 
//        });
//     }

//     let pool = [...perfectBooks];
    
//     if (level === "junior") pool = pool.filter(b => b.school_level === "Junior High");
//     if (level === "senior") pool = pool.filter(b => b.school_level === "Senior High");
//     if (genre) pool = pool.filter(b => b.genre.toLowerCase() === genre.toLowerCase());

//     pool = pool.sort(() => 0.5 - Math.random());

//     return res.json({
//       success: true,
//       total: pool.slice(0, limit).length,
//       books: pool.slice(0, limit)
//     });
    
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }

// module.exports = { getStories };

const axios = require("axios");
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const MIN_WORDS = 2000; 
const MAX_WORDS = 6000; 
const WORDS_PER_PAGE = 250;
const TARGET_BOOK_COUNT = 55; 

// Emergency Fallback (If Gutendex fails completely)
const EMERGENCY_BOOKS = [
    {
        id: "EMERGENCY_1",
        title: "The Gift of the Magi",
        author: "O. Henry",
        content: "One dollar and eighty-seven cents. That was all. And sixty cents of it was in pennies...",
        school_level: "Senior High",
        genre: "Romance",
        pages: 5,
        reading_time: "10 mins"
    }
];

const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
const IS_SERVERLESS = !!process.env.VERCEL || process.env.SERVERLESS || process.env.NODE_ENV === 'production';

let perfectBooks = [];

// ============================================
// 1. ROBUST CACHE LOADER
// ============================================
function loadCache() {
  console.log("Loading cache...");
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
        // VALIDATION: Check if the first book actually has content
        if (!data[0].content || data[0].content.length < 50) {
            console.warn(`⚠️ Cache at ${p} is corrupt (missing content). Ignoring.`);
            continue; 
        }

        perfectBooks = data;
        console.log(`✅ Loaded ${perfectBooks.length} valid books from ${p}`);
        return;
      }
    } catch (e) {
        console.error(`Error reading cache ${p}:`, e.message);
    }
  }
  console.log("❌ No valid cache found. Starting empty.");
}

// ============================================
// 2. BUILDER LOGIC (Simplified & Fast)
// ============================================
async function buildPerfectLibrary() {
  console.log('--- STARTING BUILD (On-Demand) ---');
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  let verifiedBooks = [];
  
  // Use a targeted search to get results fast
  const topics = ["mystery", "sci-fi", "horror"];
  
  for (const topic of topics) {
      if (verifiedBooks.length >= 20) break; // Get at least 20 books quickly
      
      try {
        const url = `https://gutendex.com/books?languages=en&topic=${topic}&sort=popular`;
        const res = await axios.get(url, { timeout: 5000, httpsAgent: agent });
        const results = res.data.results || [];

        for (const b of results) {
            if (verifiedBooks.length >= 50) break;
            
            // Basic Title Filter
            if (b.title.toLowerCase().includes("complete works")) continue;

            const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"];
            if (!txtUrl) continue;

            // Fast Download & Check
            try {
                const textRes = await axios.get(txtUrl, { timeout: 4000, maxContentLength: 2 * 1024 * 1024 });
                let text = textRes.data || "";
                
                // Clean Content
                const startIdx = text.indexOf("*** START");
                const endIdx = text.indexOf("*** END");
                if (startIdx !== -1 && endIdx !== -1) {
                    text = text.slice(startIdx, endIdx).replace(/Project Gutenberg/g, "");
                }

                if (text.length > 5000 && text.length < 30000) { // Rough char count for 10-15 pages
                    verifiedBooks.push({
                        id: `GB${b.id}`,
                        title: b.title,
                        author: b.authors[0]?.name || "Unknown",
                        content: text, // SAVE CONTENT
                        genre: topic.charAt(0).toUpperCase() + topic.slice(1),
                        school_level: Math.random() > 0.5 ? "Senior High" : "Junior High",
                        pages: Math.round(text.split(" ").length / 250),
                        reading_time: "15 mins",
                        cover_url: b.formats["image/jpeg"]
                    });
                }
            } catch (e) { /* ignore download errors */ }
        }
      } catch (e) {
          console.log(`Topic ${topic} failed: ${e.message}`);
      }
  }

  if (verifiedBooks.length > 0) {
      perfectBooks = verifiedBooks;
      console.log(`✅ Rebuild success: ${perfectBooks.length} books.`);
  } else {
      console.log("⚠️ Rebuild failed. Using Emergency Fallback.");
      perfectBooks = EMERGENCY_BOOKS;
  }
}

// ============================================
// 3. CONTROLLER
// ============================================

// Attempt load on startup
loadCache();

async function getStories(req, res) {
  try {
    // 1. CORS & Cache Headers
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // 2. Check if we need to build
    if (perfectBooks.length === 0) {
        console.log("Library empty. Triggering build...");
        await buildPerfectLibrary();
    }

    // 3. Last Resort Fallback
    if (perfectBooks.length === 0) {
        return res.json({
            success: true,
            total: 1,
            books: EMERGENCY_BOOKS // Return fallback so frontend never loads forever
        });
    }

    // 4. Return Data
    let { limit = 60 } = req.query;
    return res.json({
      success: true,
      total: perfectBooks.length,
      books: perfectBooks.slice(0, parseInt(limit))
    });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getStories };