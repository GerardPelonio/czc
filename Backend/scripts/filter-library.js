// Backend/scripts/filter-library.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const CACHE_FILE = path.join(__dirname, '../data/perfect-books-cache.json');
const OUTPUT_FILE = CACHE_FILE;
const TIMEOUT_MS = 15000;
// Increased minimum length to be very sure we have the full story text
const MIN_CONTENT_LENGTH = 3000; 

async function filterLibrary() {
  console.log('📦 Loading library from:', CACHE_FILE);

  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ Error: Cache file not found. Run the generation script first.');
    process.exit(1);
  }

  let books;
  try {
    const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
    books = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ Error parsing JSON:', err.message);
    process.exit(1);
  }

  console.log(`🔍 Strictly checking ${books.length} books for readability...`);
  
  const validBooks = [];
  const removedBooks = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    process.stdout.write(`[${i + 1}/${books.length}] Checking: ${book.title.substring(0, 20)}... `);

    // 1. Immediate Readme rejection (they don't contain the story)
    if (book.source_url.toLowerCase().includes('readme.txt')) {
      console.log('❌ REJECTED (Readme URL)');
      removedBooks.push(book);
      continue;
    }

    try {
      // 2. Fetch the actual content
      const response = await axios.get(book.source_url, {
        timeout: TIMEOUT_MS,
        responseType: 'text',
        headers: { 'User-Agent': 'CozyClip-Cleaner/1.0' }
      });

      const text = response.data;
      const lowerText = text.toLowerCase();

      // 3. Check for HTML disguised as Text (Soft 404)
      if (lowerText.includes("<!doctype html") || lowerText.includes("<body")) {
         console.log('❌ REJECTED (HTML Content)');
         removedBooks.push(book);
         continue;
      }
      
      // 4. Check for "File Not Found" keywords
      if (lowerText.includes("file not found") || lowerText.includes("404 not found")) {
        console.log('❌ REJECTED (Content says 404)');
        removedBooks.push(book);
        continue;
      }

      // 5. Check Minimum Length (if it's too short, it's incomplete)
      if (text.length < MIN_CONTENT_LENGTH) {
        console.log(`❌ REJECTED (Too short: ${text.length} chars)`);
        removedBooks.push(book);
        continue;
      }

      // If all checks pass:
      console.log('✅ OK');
      validBooks.push(book);

    } catch (error) {
      // Handle network errors (timeouts, DNS issues, 404 HTTP status)
      console.log(`❌ ERROR (${error.message})`);
      removedBooks.push(book);
    }
    
    // Polite delay
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n===========================================');
  console.log(`✅ Valid: ${validBooks.length} | ❌ Removed: ${removedBooks.length}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validBooks, null, 2));
  console.log(`\n💾 Cleaned library saved to: ${OUTPUT_FILE}`);
}

filterLibrary();