// scripts/generate-library.js
// Run: node scripts/generate-library.js
require('dotenv').config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// STRICT CONFIGURATION (Must match Controller)
const MIN_WORDS = 2500;
const MAX_WORDS = 4500; 
const WORDS_PER_PAGE = 250;

let perfectBooks = [];

// ----------------------------------------------------
// 1. Process Content (Strict Filter)
// ----------------------------------------------------
async function analyzeBook(textUrl, bookTitle) {
  try {
    // 60KB limit prevents downloading massive novels
    const MAX_SIZE_BYTES = 60 * 1024; 
    
    const response = await axios.get(textUrl, { 
      timeout: 10000,
      maxContentLength: MAX_SIZE_BYTES,
      validateStatus: (status) => status === 200
    });

    let text = response.data || '';

    // Reject obvious long structures
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

    // Strip Gutenberg Headers
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

    // Count Words
    const cleanText = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(' ').length;

    // STRICT CHECK
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
        return { valid: false, reason: `Word count: ${wordCount}` };
    }

    const pages = Math.round(wordCount / WORDS_PER_PAGE);
    return { valid: true, pages, wordCount };

  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

// ----------------------------------------------------
// 2. Load Raw Books
// ----------------------------------------------------
async function loadRawBooks() {
  const agent = new (require("https").Agent)({ rejectUnauthorized: false });
  // Search for specific short story terms
  const searchTerms = encodeURIComponent("short story OR short stories OR tale OR fable");

  try {
    const [p1, p2] = await Promise.all([
      axios.get(`https://gutendex.com/books?languages=en&search=${searchTerms}&sort=popular&page=1`, { timeout: 15000, httpsAgent: agent }),
      axios.get(`https://gutendex.com/books?languages=en&search=${searchTerms}&sort=popular&page=2`, { timeout: 15000, httpsAgent: agent })
    ]);

    const all = [...(p1.data.results || []), ...(p2.data.results || [])];
    console.log(`Gutendex found ${all.length} candidates.`);
    
    // Deduplicate
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());

    return unique.filter(book =>
      book.formats &&
      (book.formats["text/plain"] || book.formats["text/plain; charset=utf-8"] || book.formats["text/plain; charset=us-ascii"])
    );
  } catch (err) {
    console.log("Gutendex failed:", err.message);
    return [];
  }
}

// ----------------------------------------------------
// 3. Assign Metadata (Gemini)
// ----------------------------------------------------
async function filterWithGemini(validBooks) {
  if (validBooks.length === 0) return [];
  console.log(`Asking Gemini to classify ${validBooks.length} verified short stories...`);

  const prompt = `
You are an expert English teacher.
Classify these books for Filipino students.
Return JSON array: [{"id": 123, "level": "Senior High", "genre": "Horror"}, ...]
Options:
- level: "Junior High" or "Senior High"
- genre: Mystery, Horror, Sci-Fi, Humor, Romance, Drama, Fantasy
Books:
${validBooks.map(b => `${b.id}: "${b.title}"`).join("\n")}
`.trim();

  try {
    const res = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 8000, responseMimeType: "application/json" },
    }, { timeout: 60000 });

    let text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const list = JSON.parse(text.replace(/```json|```/g, "").trim());
    return list;
  } catch (err) {
    console.log("Gemini failed, using fallback genres.");
    return []; // fallback logic handled in buildAndSave
  }
}

// ----------------------------------------------------
// 4. Build & Save
// ----------------------------------------------------
async function buildAndSave() {
  console.log("--- Starting Strict Library Generation ---");
  const rawBooks = await loadRawBooks();
  
  const verifiedBooks = [];
  let processed = 0;

  // Process sequentially or in small chunks to avoid rate limits/timeouts
  for (const b of rawBooks) {
    process.stdout.write(`Processing ${++processed}/${rawBooks.length}: ${b.title.substring(0, 20)}... `);
    
    const txtUrl = b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"] || b.formats["text/plain; charset=us-ascii"];
    if (!txtUrl) { console.log("No text."); continue; }

    const analysis = await analyzeBook(txtUrl, b.title);
    
    if (analysis.valid) {
        console.log(`✅ MATCH! (${analysis.pages} pages)`);
        verifiedBooks.push({ ...b, ...analysis });
    } else {
        console.log(`❌ Skipped (${analysis.reason})`);
    }
  }

  // Get AI Metadata
  const metadataList = await filterWithGemini(verifiedBooks);
  
  // Merge Data
  const finalLibrary = verifiedBooks.map(b => {
    const meta = metadataList.find(m => m.id === b.id) || {};
    const fallbackGenre = ["Mystery", "Humor", "Sci-Fi", "Drama"][b.id % 4];
    
    return {
      id: `GB${b.id}`,
      title: (b.title || "Untitled").split(/ by |,/i)[0].trim(),
      author: b.authors?.[0]?.name || "Unknown Author",
      cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
      source_url: b.formats["text/plain"] || b.formats["text/plain; charset=utf-8"],
      school_level: meta.level || (Math.random() > 0.5 ? "Senior High" : "Junior High"),
      grade_range: "7–12",
      age_range: "12–18",
      genre: meta.genre || fallbackGenre,
      pages: b.pages,
      word_count: b.wordCount,
      reading_time: `${Math.round(b.pages * 2)} mins`
    };
  });

  console.log(`\nLIBRARY COMPLETE: ${finalLibrary.length} Verified Books`);

  const outputPath = path.join(__dirname, "../data/perfect-books-cache.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(finalLibrary, null, 2));
  console.log(`Saved to ${outputPath}`);
}

buildAndSave();
