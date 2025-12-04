// Backend/scripts/filter-library.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const CACHE_FILE = path.join(__dirname, '../data/perfect-books-cache.json');
const OUTPUT_FILE = CACHE_FILE; // Overwrites the existing file. Change name if you want a backup.
const TIMEOUT_MS = 10000;

// Gutenberg can block aggressive scraping, so we use a small delay.
const DELAY_BETWEEN_REQUESTS_MS = 500; 

async function filterLibrary() {
  console.log('📦 Loading library from:', CACHE_FILE);

  if (!fs.existsSync(CACHE_FILE)) {
    console.error('❌ Error: Cache file not found.');
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

  console.log(`🔍 Checking ${books.length} books for valid text content...`);
  
  const validBooks = [];
  const invalidBooks = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const progress = `[${i + 1}/${books.length}]`;
    
    process.stdout.write(`${progress} Checking: ${book.title.substring(0, 30)}... `);

    try {
      const isValid = await checkUrl(book.source_url);
      
      if (isValid) {
        console.log('✅ OK');
        validBooks.push(book);
      } else {
        console.log('❌ INVALID (HTML/Empty)');
        invalidBooks.push(book);
      }
    } catch (error) {
      console.log(`❌ ERROR (${error.message})`);
      invalidBooks.push(book);
    }

    // Polite delay
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
  }

  console.log('\n===========================================');
  console.log('SUMMARY');
  console.log('===========================================');
  console.log(`Total Scanned: ${books.length}`);
  console.log(`✅ Valid:      ${validBooks.length}`);
  console.log(`❌ Removed:    ${invalidBooks.length}`);
  
  if (invalidBooks.length > 0) {
    console.log('\nRemoved Books:');
    invalidBooks.forEach(b => console.log(`- ${b.title} (${b.id})`));
  }

  // Save the filtered list
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validBooks, null, 2));
    console.log(`\n💾 Saved filtered library to: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error saving file:', err.message);
  }
}

async function checkUrl(url) {
  if (!url) return false;

  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      responseType: 'text',
      // Mimic a browser to avoid some basic blocking
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status !== 200) return false;

    const content = response.data;

    // 1. Check if empty
    if (!content || content.length === 0) return false;

    // 2. Check if response is HTML disguised as text
    // Gutenberg often redirects dead .txt links to an HTML "Book not found" or "Bibrec" page.
    const trimmedStart = content.trim().substring(0, 300).toLowerCase();
    
    if (trimmedStart.includes('<!doctype html') || 
        trimmedStart.includes('<html') || 
        trimmedStart.includes('<body') ||
        (response.headers['content-type'] && response.headers['content-type'].includes('text/html'))) {
      return false;
    }

    return true;

  } catch (error) {
    throw error; // Let the main loop handle the error logging
  }
}

filterLibrary();