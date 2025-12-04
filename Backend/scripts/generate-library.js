// scripts/generate-library.js
// Run: node Backend/scripts/generate-library.js
// FAST MODE: No AI, just strict filtering + random genres
require('dotenv').config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ==========================================
// CONFIGURATION
// ==========================================
// Strict range: 2500 - 4500 words (~10-15 pages)
const MIN_WORDS = 2500;
const MAX_WORDS = 4500; 
const WORDS_PER_PAGE = 250;

// Download limit: 2MB (Enough for text, rejects massive novels)
const MAX_DOWNLOAD_SIZE = 2 * 1024 * 1024; 

// Skip these titles immediately (case-insensitive)
const IGNORE_TITLES = [
  "history", "collection", "collected", "complete", "works", 
  "anthology", "volume", "vol.", "index", "dictionary", 
  "encyclopedia", "handbook", "manual", "report", "memoirs"
];

const GENRES = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Fantasy"];

// ----------------------------------------------------
// 1. Process Content
// ----------------------------------------------------
async function analyzeBook(textUrl, bookTitle) {
  try {
    const response = await axios.get(textUrl, { 
      timeout: 8000, // Faster timeout
      maxContentLength: MAX_DOWNLOAD_SIZE,
      validateStatus: (status) => status === 200
    });

    let text = response.data || '';

    // 1. Structure Check (Reject "Chapter 20" or Indexes)
    const structureChecks = [
        /Chapter\s+(?:XX|20)/i, 
        /Index\s*$/i,           
        /Bibliography/i        
    ];
    for (const check of structureChecks) {
        if (check.test(text.substring(0, 5000)) || check.test(text.substring(text.length - 5000))) {
            return { valid: false, reason: "Structure (Index/Chapters)" };
        }
    }

    // 2. Strip Gutenberg Headers
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

    // 3. Count Words
    const cleanText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(' ').length;

    // 4. Strict Range Check
    if (wordCount < MIN_WORDS) {
        return { valid: false, reason: `Too short (${wordCount} words)` };
    }
    if (wordCount > MAX_WORDS) {
        return { valid: false, reason: `Too long (${wordCount} words)` };
    }

    const pages = Math.round(wordCount / WORDS_PER_PAGE);
    return { valid: true, pages, wordCount };

  } catch (err) {
    if (err.message && err.message.includes("maxContentLength")) {
        return { valid: false, reason: "File too large (>2MB)" };
    }
    return { valid: false, reason: err.message };
  }
}

// ----------------------------------------------------
// 2. Load Raw Books
// ----------------------------------------------------
async function loadRawBooks() {
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  
  // Use "Topic" search which is more reliable than "Search"
  const urls = [
    "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular",
    "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular&page=2",
    "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular&page=3"
  ];

  let allBooks = [];
  console.log("Fetching candidates from Gutendex (Sequential)...");

  for (const url of urls) {
      try {
          process.stdout.write(`Fetching ${url} ... `);
          const res = await axios.get(url, { timeout: 30000, httpsAgent: agent });
          const results = res.data.results || [];
          console.log(`OK (${results.length} items)`);
          allBooks.push(...results);
          
          await new Promise(r => setTimeout(r, 1000)); // Short delay
      } catch (err) {
          console.log(`FAILED: ${err.message}`);
      }
  }

  console.log(`\nFound ${allBooks.length} raw candidates.`);

  const unique = Array.from(new Map(allBooks.map(item => [item.id, item])).values());

  const filtered = unique.filter(book => {
      const titleLower = (book.title || "").toLowerCase();
      
      const hasText = book.formats && (book.formats["text/plain"] || book.formats["text/plain; charset=utf-8"] || book.formats["text/plain; charset=us-ascii"]);
      if (!hasText) return false;

      if (IGNORE_TITLES.some(bad => titleLower.includes(bad))) return false;

      return true;
  });

  console.log(`Reduced to ${filtered.length} candidates after Title Filter.\n`);
  return filtered;
}

// ----------------------------------------------------
// 3. Build & Save (FAST MODE)
// ----------------------------------------------------
async function buildAndSave() {
  const rawBooks = await loadRawBooks();
  
  const verifiedBooks = [];
  let processed = 0;

  console.log("--- Scanning Contents (Fast Mode) ---");

  for (const b of rawBooks) {
    // Stop if we have enough books (e.g., 50)
    if (verifiedBooks.length >= 50) break;

    const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"] || b.formats["text/plain; charset=us-ascii"];
    const analysis = await analyzeBook(txtUrl, b.title);
    
    process.stdout.write(`[${++processed}/${rawBooks.length}] ${b.title.substring(0, 25)}... `);
    
    if (analysis.valid) {
        console.log(`✅ MATCH! (${analysis.pages} pages)`);
        
        // --- RANDOM ASSIGNMENT INSTEAD OF AI ---
        const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)];
        const randomLevel = Math.random() > 0.5 ? "Senior High" : "Junior High";

        verifiedBooks.push({
            id: `GB${b.id}`,
            title: (b.title || "Untitled").split(/ by |,/i)[0].trim(),
            author: b.authors?.[0]?.name || "Unknown Author",
            cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
            source_url: txtUrl,
            school_level: randomLevel,
            grade_range: randomLevel === "Senior High" ? "11–12" : "7–10",
            age_range: randomLevel === "Senior High" ? "16–18" : "12–16",
            genre: randomGenre,
            pages: analysis.pages,
            word_count: analysis.wordCount,
            reading_time: `${Math.round(analysis.pages * 2)} mins`
        });

    } else {
        console.log(`❌ ${analysis.reason}`);
    }
  }

  console.log(`\n\nLIBRARY GENERATION COMPLETE: ${verifiedBooks.length} Verified Books`);

  const outputPath = path.join(__dirname, "../data/perfect-books-cache.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(verifiedBooks, null, 2));
  console.log(`\nSaved to ${outputPath}`);
}

buildAndSave();