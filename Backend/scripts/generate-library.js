// scripts/generate-library.js
// Run: node scripts/generate-library.js  (only once!)
require('dotenv').config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const pageCountCache = new Map();
let perfectBooks = [];

// ----------------------------------------------------
// Get page count (5–15 pages only)
// ----------------------------------------------------
async function getPageCount(textUrl, bookId) {
  if (pageCountCache.has(bookId)) return pageCountCache.get(bookId);

  try {
    const { data: text } = await axios.get(textUrl, { timeout: 15000 });
    let cleanText = text;
    const start = text.indexOf("*** START");
    const end = text.indexOf("*** END");
    if (start !== -1 && end !== -1) cleanText = text.slice(start, end);

    cleanText = cleanText.replace(/[\r\n]+/g, "\n").replace(/Project Gutenberg.*/gi, "").trim();
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
    let pages = Math.round(wordCount / 275);
    pages = Math.max(5, Math.min(15, pages));

    pageCountCache.set(bookId, pages);
    return pages;
  } catch (err) {
    const fallback = 7 + (bookId % 8);
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
    console.log(`Gutendex loaded ${all.length} raw books`);

    return all.filter(book =>
      book.formats &&
      (book.formats["text/plain"] ||
       book.formats["text/plain; charset=us-ascii"] ||
       book.formats["text/html"])
    );
  } catch (err) {
    console.log("Gutendex failed, using empty list");
    return [];
  }
}

// ----------------------------------------------------
// Assign genre using Gemini
// ----------------------------------------------------
async function filterWithGrokBrain(rawBooks) {
  if (rawBooks.length === 0) return [];

  const prompt = `
You are an expert DepEd English teacher in the Philippines.
Pick 70–90 short stories safe for Filipino students.
Assign each: school_level ("Junior High" or "Senior High") and genre (Mystery, Horror, Sci-Fi, Humor, Romance, Drama, Adventure, Fantasy)
Return ONLY clean JSON array: [{"id": 1952, "level": "Senior High", "genre": "Horror"}, ...]
Books:
${rawBooks.map(b => `${b.id}: "${b.title}" by ${b.authors?.[0]?.name || "Unknown"}`).join("\n")}
`.trim();

  try {
    const res = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 6000, responseMimeType: "application/json" },
    }, { timeout: 60000 });

    let text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    text = text.replace(/```json|```/g, "").trim();
    const list = JSON.parse(text);

    const validIds = rawBooks.map(b => b.id);
    return list.filter(x => validIds.includes(x.id));
  } catch (err) {
    console.log("Gemini failed → using fallback genres");
    const genres = ["Mystery", "Horror", "Sci-Fi", "Humor", "Romance", "Drama", "Adventure", "Fantasy"];
    return rawBooks
      .sort((a, b) => (b.download_count || 0) - (a.download_count || 0))
      .slice(0, 85)
      .map((b, i) => ({ id: b.id, level: i < 38 ? "Senior High" : "Junior High", genre: genres[i % 8] }));
  }
}

// ----------------------------------------------------
// Build final library & SAVE TO FILE
// ----------------------------------------------------
async function buildAndSave() {
  console.log("Building your perfect CozyClip library... (2–3 minutes)");
  const rawBooks = await loadRawBooks();
  const approved = await filterWithGrokBrain(rawBooks);

  const books = [];
  for (const item of approved) {
    const b = rawBooks.find(book => book.id === item.id);
    if (!b) continue;

    const txtUrl = Object.values(b.formats || {}).find(v => typeof v === "string" && (v.includes("text/plain") || v.endsWith(".txt"))) ||
                   `https://www.gutenberg.org/files/${b.id}/${b.id}-0.txt`;
    const pages = await getPageCount(txtUrl, b.id);

    books.push({
      id: `GB${b.id}`,
      title: (b.title || "Story").split(/ by |,|\(/i)[0].trim(),
      author: b.authors?.[0]?.name || "Unknown Author",
      cover_url: b.formats["image/jpeg"] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
      source_url: txtUrl,
      school_level: item.level.includes("Senior") ? "Senior High" : "Junior High",
      grade_range: item.level.includes("Senior") ? "11–12" : "7–10",
      age_range: item.level.includes("Senior") ? "16–18" : "12–16",
      genre: item.genre || "Drama",
      pages,
      reading_time: `${Math.round(pages * 2.3)} minutes`
    });
  }

  perfectBooks = books;
  const senior = books.filter(b => b.school_level === "Senior High").length;
  console.log(`LIBRARY BUILT: ${books.length} books | Senior: ${senior} | Junior: ${books.length - senior}`);

  // SAVE TO CACHE FILE used by the running server
  const outputPath = path.join(__dirname, "../data/perfect-books-cache.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(books, null, 2));

  console.log("perfect-books-cache.json saved to Backend/data — your server will use it on startup.");
  console.log("Commit this file if you want instant cold starts on Vercel.");
}

buildAndSave();