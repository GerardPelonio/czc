const axios = require("axios");
const zlib = require("zlib");
const { promisify } = require("util");
const gunzip = promisify(zlib.gunzip);
const fs = require('fs');         // <--- CRUCIAL IMPORT
const path = require('path');       // <--- CRUCIAL IMPORT

// ====================================================
// CACHE SETUP
// ====================================================
const CACHE_FILE = path.join(__dirname, '..', 'data', 'perfect-books-cache.json');
let perfectBooksCache = {}; // Map of { ID: BookObjectWithContent }

function loadStoryCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      // Convert array to an object map for O(1) lookup by ID
      perfectBooksCache = data.reduce((map, book) => {
        if (book.id) map[String(book.id).toUpperCase()] = book;
        return map;
      }, {});
      console.log(`Story Cache loaded: ${Object.keys(perfectBooksCache).length} pre-validated books.`);
      return true;
    }
  } catch (e) {
    console.error("Failed to load Story Cache:", e.message);
  }
  return false;
}

loadStoryCache(); // Load cache immediately when the module starts

// ----------------------------------------------------
// Get Story by ID
// ----------------------------------------------------
async function getStoryById(req, res) {
  try {
    let { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "ID required" });
    
    // Normalize to uppercase
    id = String(id).toUpperCase();
    
    console.log(`\nRequesting story: ${id}`);

    // === 1. CACHE CHECK (PRIORITY) ===
    if (perfectBooksCache[id]) {
      const cachedBook = perfectBooksCache[id];
      console.log(`CACHE HIT: Returning ${id} from local cache.`);
      
      // Ensure the cached book has content before returning
      if (cachedBook.content && cachedBook.content.length > 2000) {
        return res.json({
          success: true,
          story: {
            id: cachedBook.id,
            title: cachedBook.title,
            author: cachedBook.author,
            content: cachedBook.content, // Use the pre-validated content
            source: 'local_cache',
            source_id: cachedBook.id.startsWith("GB") ? cachedBook.id.slice(2) : cachedBook.id,
            content_preview: cachedBook.content.substring(0, 500) + (cachedBook.content.length > 500 ? "..." : ""),
          },
        });
      }
    }


    // === 2. LIVE FETCH FALLBACK (Original logic for non-cached books) ===
    console.log(`LIVE FETCH: Cache miss or invalid content. Attempting to fetch ${id} from source.`);
    let title = "Unknown";
    let author = "Unknown";
    let content = null;
    let source = null;
    let sourceId = null;

    if (id.startsWith("GB")) {
      const gutenbergId = id.slice(2);
      try {
        const { data } = await axios.get(`https://gutendex.com/books/${gutenbergId}`, { timeout: 5000 });
        title = data.title || "Unknown";
        author = data.authors?.[0]?.name || "Unknown";
      } catch (e) {
        console.log(`Metadata failed: ${e.message}`);
      }

      content = await fetchFromGutenberg(gutenbergId, title);
      if (content) {
        source = "gutenberg";
        sourceId = gutenbergId;
      }
    } else if (id.startsWith("OL") && id.endsWith("W")) {
      const workUrl = `https://openlibrary.org/works/${id}.json`;
      const { data: work } = await axios.get(workUrl, { timeout: 6000 });
      title = work.title || "Unknown";
      author = work.authors ? await getAuthorNames(work.authors) : "Unknown";

      const gutenbergId = extractGutenbergId(work);
      if (gutenbergId) {
        content = await fetchFromGutenberg(gutenbergId, title);
        if (content) {
          source = "gutenberg";
          sourceId = gutenbergId;
        }
      }

      if (!content) {
        const editionsUrl = `https://openlibrary.org/works/${id}/editions.json?limit=10`;
        const { data: editionsData } = await axios.get(editionsUrl, { timeout: 6000 });
        for (const ed of editionsData.entries || []) {
          if (!ed.ocaid) continue;
          content = await fetchFromIA(ed.ocaid, title);
          if (content) {
            source = "ia";
            sourceId = ed.ocaid;
            break;
          }
        }
      }
    }

    if (!content) {
      return res.status(404).json({ success: false, message: "No readable text found." });
    }

    // === SEND WITH REAL LINE BREAKS ===
    const response = {
      success: true,
      story: {
        id,
        title,
        author,
        content,
        source,
        source_id: sourceId,
        content_preview: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
      },
    };

    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(response, null, 2));

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// (The remaining helper functions like extractCleanContent, fetchFromGutenberg, etc., are unchanged)

// ----------------------------------------------------
// Helper: Extract Clean Content
// ----------------------------------------------------
function extractCleanContent(rawText, title) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let start = 0;
  let end = lines.length;

  const tocEndPatterns = [
    /^BOOK [IVX]/i,
    /^VOLUME [IVX]/i,
    /^PART [IVX]/i,
    /^CHAPTER [IVX0-9]/i,
    /^SECTION [IVX0-9]/i,
  ];

  let lastTocLine = -1;
  for (let i = 0; i < Math.min(1000, lines.length); i++) {
    if (tocEndPatterns.some(p => p.test(lines[i]))) lastTocLine = i;
  }

  const contentStartPatterns = [
    /^CHAPTER [IVX0-9]/i,
    /^BOOK [IVX]/i,
    new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    /^\s*I\.?\s+/i,
  ];

  let contentStart = lastTocLine + 1;
  for (let i = contentStart; i < Math.min(contentStart + 100, lines.length); i++) {
    if (contentStartPatterns.some(p => p.test(lines[i]))) {
      contentStart = i;
      break;
    }
  }

  const endMarkers = [
    /\*\*\* END OF (THE|THIS) PROJECT GUTENBERG/i,
    /End of Project Gutenberg/i,
    /End of the Project Gutenberg EBook/i,
  ];

  for (let i = lines.length - 1; i >= Math.max(lines.length - 500, 0); i--) {
    if (endMarkers.some(m => m.test(lines[i]))) {
      end = i;
      break;
    }
  }

  let content = lines.slice(contentStart, end).join('\n');

  content = content
    .replace(/\r/g, '')
    .replace(/^\s*[\*\-=_]{3,}\s*$/gm, '')
    .replace(/\s{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\*\-=_]+\s*$/gm, '')
    .trim();

  return content.length > 1000 ? content : "Content extraction failed.";
}

// ----------------------------------------------------
// Fetch from Gutenberg
// ----------------------------------------------------
async function fetchFromGutenberg(id, title) {
  const urls = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  ];

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, {
        timeout: 12000,
        validateStatus: s => s === 200,
        headers: { 'User-Agent': 'CozyClip/1.0' },
      });
      const clean = extractCleanContent(data, title);
      if (clean.length > 2000) return clean;
    } catch (err) {
      console.log(`  Failed: ${err.message}`);
    }
  }
  return null;
}

// ----------------------------------------------------
// Fetch from Internet Archive
// ----------------------------------------------------
async function fetchFromIA(ocaid, title) {
  const urls = [
    `https://archive.org/download/${ocaid}/${ocaid}_djvu.txt`,
    `https://archive.org/download/${ocaid}/${ocaid}.txt`,
    `https://archive.org/download/${ocaid}/${ocaid}_abbyy.gz`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 12000,
        responseType: "arraybuffer",
        validateStatus: s => s === 200,
        headers: { 'User-Agent': 'CozyClip/1.0' },
      });

      let raw = res.data;
      if (url.includes('.gz') || (Buffer.isBuffer(raw) && raw[0] === 0x1f && raw[1] === 0x8b)) {
        try { raw = await gunzip(raw); } catch { continue; }
      }

      const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
      const clean = extractCleanContent(text, title);
      if (clean.length > 2000) return clean;
    } catch {}
  }
  return null;
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
async function getAuthorNames(authors) {
  const names = [];
  for (const a of authors.slice(0, 3)) {
    try {
      const { data } = await axios.get(`https://openlibrary.org${a.author.key}.json`, { timeout: 3000 });
      names.push(data.name || 'Unknown');
    } catch {}
  }
  return names.length ? names.join(', ') : 'Unknown';
}

function extractGutenbergId(work) {
  if (work.identifiers?.gutenberg?.[0]) return work.identifiers.gutenberg[0];
  const link = work.links?.find(l => l.url?.includes("gutenberg.org/ebooks/"));
  if (link) {
    const match = link.url.match(/\/ebooks\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

module.exports = { getStoryById };