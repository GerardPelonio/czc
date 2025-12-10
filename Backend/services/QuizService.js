const { sanitizeAxiosError, maskApiKey } = require('../utils/logging');
const axios = require('axios');
const QuizModel = require('../models/QuizModel');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Log API key status at startup
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is missing! Quiz generation will fail.');
  console.error('Please set GEMINI_API_KEY in your .env file');
} else {
  console.log('✅ GEMINI_API_KEY found (length: ' + GEMINI_API_KEY.length + ')');
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";

let lastRequest = 0;
const MIN_DELAY = 2000; // 30 RPM safe for free tier

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < MIN_DELAY) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY - elapsed));
  }
  lastRequest = now;
}

function cleanGutenbergContent(raw) {
  if (!raw || typeof raw !== "string") return "";

  let text = raw
    .replace(/<[^>]*>/g, " ")  // HTML/CSS
    .replace(/\r?\n/g, " ")    // Line breaks
    .replace(/\s+/g, " ")      // Whitespace
    .trim();

  // Extract story (skip headers/footers) - but be more lenient
  const startIdx = Math.max(text.search(/\*\*\* START OF/i), 0);
  const endIdx = text.search(/\*\*\* END OF/i);
  if (startIdx >= 0 && endIdx > startIdx) {
    text = text.substring(startIdx, endIdx);
  }

  // Remove only obvious junk patterns
  const junkPatterns = [
    /Project Gutenberg|www\.gutenberg\.org/gi,
    /E?Book #\d+|Release Date:/gi,
  ];
  junkPatterns.forEach(p => text = text.replace(p, " "));

  // Don't filter short words - keep all content
  text = text
    .replace(/\s+/g, " ")
    .slice(0, 30000) // Trim to safe size
    .trim();

  return text;
}

async function generateQuiz(userId, storyId, content, title = "the book", db = null, attempt = 0) {
  await rateLimit();

  const cleanText = cleanGutenbergContent(content);
  if (cleanText.length < 1500) {
    throw new Error("Not enough clean book content");
  }

  // Check if API key is configured
  if (!GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY not configured on server');
    err.status = 500;
    throw err;
  }

  const prompt = `You are a literature teacher. Generate a 10-question quiz on "${title}":
- 5 True/False questions
- 5 Multiple-choice (A B C D options)

Use ONLY the text below. No mentions of Gutenberg/licenses/metadata.

Text excerpt:
${cleanText}

Return ONLY valid JSON (no extra text):

{
  "type": "mixed",
  "numQuestions": 10,
  "questions": [
    {
      "question": "Example true/false question?",
      "type": "true-false",
      "correctAnswer": "True",
      "explanation": "Brief reason from text."
    },
    {
      "question": "Example MC question?",
      "type": "multiple-choice",
      "choices": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": "B",
      "explanation": "Brief reason from text."
    }
  ]
}`;

  try {
    console.log(`[Quiz] Calling Gemini API for ${storyId}...`);
    console.log(`[Quiz] Using model: gemini-2.5-flash-lite`);
    console.log(`[Quiz] API endpoint: ${GEMINI_URL}`);
    
    const res = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        safetySettings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
        ]
      },
      { timeout: 60000 }
    );

    let raw = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    raw = raw.replace(/^```json\s*|```$/gi, "").trim();

    const quiz = JSON.parse(raw);

    // Normalize
    quiz.questions.forEach(q => {
      if (q.type === "true-false") {
        q.correctAnswer = q.correctAnswer.toLowerCase().includes('true') ? "True" : "False";
      } else {
        q.correctAnswer = q.correctAnswer.toUpperCase().charAt(0);
      }
    });

    // Attempt to save quiz to Firebase via QuizModel
    try {
        if (QuizModel && typeof QuizModel.saveQuiz === 'function') {
          await QuizModel.saveQuiz(userId, storyId, quiz, db);
      } else {
        // fallback to using firebase-admin directly (if available)
        // If model isn't available, let model have handled persistence fallback; nothing else to do
      }
    } catch (e) {
      console.warn('saveQuiz attempt failed:', e && e.message ? e.message : e);
    }

    console.log(`[Quiz] ✅ Quiz generated successfully for ${storyId}`);
    return quiz;

  } catch (error) {
    const status = error?.response?.status;
    const code = error?.code || null;
    const errorMsg = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    const errorData = error?.response?.data;
    
    console.error(`[Quiz] ❌ Gemini error (status=${status}, code=${code}): ${errorMsg}`);
    console.error(`[Quiz] Full error response:`, JSON.stringify(errorData, null, 2));
    
    // Handle specific Gemini API errors
    if (status === 403) {
      // 403 usually means invalid API key or quota exceeded
      const err = new Error('Quiz generation service returned 403 - API key may be invalid or quota exceeded');
      err.status = 503; // Return 503 to client to indicate service unavailable
      throw err;
    }
    
    const shouldRetryOn5xx = status >= 500 && status < 600 && attempt < 3;
    const shouldRetryOnNetwork = ['ECONNRESET', 'ECONNABORTED', 'ENOTFOUND', 'ERR_BAD_RESPONSE'].includes(code) && attempt < 3;

    if ((status === 429 || shouldRetryOn5xx || shouldRetryOnNetwork) && attempt < 3) {
      const delay = 3000 * Math.pow(2, attempt); // 3s,6s,12s
      console.warn(`[Quiz] Retrying Gemini call (attempt ${attempt + 1}/3, waiting ${delay}ms)...`);
      await new Promise(r => setTimeout(r, delay));
      return generateQuiz(userId, storyId, content, title, db, attempt + 1);
    }

    const sanitized = sanitizeAxiosError(error);
    console.error('[Quiz] Final error:', sanitized);
    const ex = new Error('Quiz generation failed — try again later');
    ex.status = sanitized.status || 500;
    throw ex;
  }
}

module.exports = { generateQuiz };