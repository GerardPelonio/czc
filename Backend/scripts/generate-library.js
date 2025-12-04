// scripts/generate-library.js

// Run: node Backend/scripts/generate-library.js

// STRICT MODE: 10-15 Pages (2500-3800 words) | 50+ Books

require('dotenv').config();

const axios = require("axios");

const fs = require("fs");

const path = require("path");



// ==========================================

// CONFIGURATION

// ==========================================

// Standard: 1 page = ~250 words.

// 10 pages = 2500 words

// 15 pages = 3750 words

const MIN_WORDS = 2500;

const MAX_WORDS = 3800;

const WORDS_PER_PAGE = 250;



const TARGET_BOOK_COUNT = 55; // Goal: 50+ books

const MAX_PAGES_TO_SCAN = 40; // Scan deep to find enough matches



// Download limit: 3MB (Buffer for download, but we filter by word count later)

const MAX_DOWNLOAD_SIZE = 3 * 1024 * 1024;



// Skip these immediately

const IGNORE_TITLES = [

  "history", "complete", "works", "anthology", "volume", "vol.",

  "index", "dictionary", "encyclopedia", "handbook", "manual", "report",

  "memoirs", "letters", "poems", "poetry", "plays"

];



const GENRES = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Fantasy", "Adventure"];



// ----------------------------------------------------

// 1. Process & Clean Content

// ----------------------------------------------------

async function analyzeBook(textUrl, bookTitle) {

  try {

    const response = await axios.get(textUrl, {

      timeout: 12000,

      maxContentLength: MAX_DOWNLOAD_SIZE,

      validateStatus: (status) => status === 200

    });



    let text = response.data || '';



    // --- STEP A: Structure Check ---

    // Reject massive structures often found in collections

    if (/Chapter\s+(?:X|V|10)/i.test(text.slice(0, 10000))) {

         // If it has Chapter 10+, it's likely a novel, not a short story

         if (/Chapter\s+(?:15|20|XX)/i.test(text)) {

             return { valid: false, reason: "Too many chapters (Novel?)" };

         }

    }



    // --- STEP B: Smart Cleaning (Make it Readable) ---

    // 1. Remove Gutenberg Header/Footer

    const startMarkers = ["*** START", "START OF THIS PROJECT", "Produced by", "Start of the Project"];

    const endMarkers = ["*** END", "End of the Project", "End of Project", "END OF THIS PROJECT"];

   

    let startIdx = 0;

    let endIdx = text.length;



    for (const m of startMarkers) {

        const i = text.indexOf(m);

        if (i !== -1) {

            // Find the next newline after the marker to start clean

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

   

    // Slice the main content

    if (endIdx > startIdx) text = text.slice(startIdx, endIdx);



    // 2. Remove License junk if it remains

    text = text.replace(/Project Gutenberg/gi, "");

   

    // 3. Collapse whitespace (Fixes readability)

    // Replaces multiple newlines with a single paragraph break

    const cleanText = text

        .replace(/\r\n/g, "\n")

        .replace(/\n{3,}/g, "\n\n") // Max 2 newlines

        .trim();



    // --- STEP C: Word Count ---

    // Split by whitespace to get accurate count

    const words = cleanText.split(/\s+/);

    const wordCount = words.length;



    // Strict Check

    if (wordCount < MIN_WORDS) {

        return { valid: false, reason: `Too short (${wordCount} w)` };

    }

    if (wordCount > MAX_WORDS) {

        return { valid: false, reason: `Too long (${wordCount} w)` };

    }



    const pages = Math.round(wordCount / WORDS_PER_PAGE);

   

    return { valid: true, pages, wordCount };



  } catch (err) {

    if (err.message && err.message.includes("maxContentLength")) {

        return { valid: false, reason: "File too large (>3MB)" };

    }

    return { valid: false, reason: err.message };

  }

}



// ----------------------------------------------------

// 2. Load Raw Books

// ----------------------------------------------------

async function loadRawBooks() {

  const agent = new (require("https").Agent)({ rejectUnauthorized: false });

 

  // Search for "stories" to get collections, then we filter for single stories inside

  const baseUrl = "https://gutendex.com/books?languages=en&topic=short%20stories&sort=popular";

 

  let allBooks = [];

 

  console.log(`Fetching candidates from Gutendex (Scanning ${MAX_PAGES_TO_SCAN} pages)...`);



  for (let page = 1; page <= MAX_PAGES_TO_SCAN; page++) {

      try {

          const url = `${baseUrl}&page=${page}`;

          process.stdout.write(`Fetching Page ${page}... `);

         

          const res = await axios.get(url, { timeout: 30000, httpsAgent: agent });

          const results = res.data.results || [];

          console.log(`OK (${results.length} items)`);

         

          if (results.length === 0) break;

         

          allBooks.push(...results);

         

          // Polite delay

          await new Promise(r => setTimeout(r, 1000));

      } catch (err) {

          console.log(`FAILED: ${err.message}`);

      }

  }



  console.log(`\nFound ${allBooks.length} raw candidates.`);



  const unique = Array.from(new Map(allBooks.map(item => [item.id, item])).values());



  const filtered = unique.filter(book => {

      const titleLower = (book.title || "").toLowerCase();

     

      const hasText = book.formats && (

        book.formats["text/plain"] ||

        book.formats["text/plain; charset=utf-8"] ||

        book.formats["text/plain; charset=us-ascii"]

      );

      if (!hasText) return false;



      if (IGNORE_TITLES.some(bad => titleLower.includes(bad))) return false;



      return true;

  });



  console.log(`Reduced to ${filtered.length} candidates after Title Filter.\n`);

  return filtered;

}



// ----------------------------------------------------

// 3. Build & Save

// ----------------------------------------------------

async function buildAndSave() {

  const rawBooks = await loadRawBooks();

 

  const verifiedBooks = [];

  let matches = 0;



  console.log(`--- Scanning Contents (Target: ${TARGET_BOOK_COUNT} Books) ---`);

  console.log(`Criteria: ${MIN_WORDS}-${MAX_WORDS} words (~10-15 pages)`);

  console.log("This will take a few minutes...\n");



  for (const b of rawBooks) {

    if (verifiedBooks.length >= TARGET_BOOK_COUNT) {

        console.log("\nTarget reached! Stopping early.");

        break;

    }



    const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"] || b.formats["text/plain; charset=us-ascii"];

    const analysis = await analyzeBook(txtUrl, b.title);

   

    // Status log

    const statusIcon = analysis.valid ? "✅" : "❌";

    const info = analysis.valid ? `(${analysis.pages} pgs)` : `(${analysis.reason})`;

    process.stdout.write(`[${matches}/${TARGET_BOOK_COUNT}] ${b.title.substring(0, 25).padEnd(25)} ${statusIcon} ${info}\r`);

   

    if (analysis.valid) {

        process.stdout.write(`\n✅ FOUND: "${b.title}" (${analysis.pages} pages / ${analysis.wordCount} words)\n`);

        matches++;



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

    }

  }



  console.log(`\n\n==================================================`);

  console.log(`LIBRARY GENERATION COMPLETE: ${verifiedBooks.length} Verified Books`);

  console.log(`==================================================`);



  const outputPath = path.join(__dirname, "../data/perfect-books-cache.json");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(verifiedBooks, null, 2));

  console.log(`\nSaved to ${outputPath}`);

}



buildAndSave();