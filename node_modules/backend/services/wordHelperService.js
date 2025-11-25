const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CACHE_ENTRIES = 1000;
const TIMEOUT_MS = 10000; // HTTP timeout
const GENAI_TIMEOUT_MS = 20000; // GenAI / TTS timeout

const cache = new Map();

function _getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function _setCache(key, data, ttl = DEFAULT_TTL_MS) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function fetchWithTimeout(url, options = {}, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function translateText(text, targetLang) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('Translation key not configured'), { status: 500 });
  if (!text) return text;

  try {
    let GoogleGenAI;
    try { GoogleGenAI = require('@google/genai').GoogleGenAI; } catch (e) { GoogleGenAI = null; }
    if (GoogleGenAI) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const langName = targetLang === 'tl' ? 'Tagalog' : targetLang;
      const prompt = `Translate the following text into ${langName}. Reply with the translation only.\n\n${text}`;

      const genaiPromise = ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      let res;
      try {
        res = await Promise.race([
          genaiPromise,
          new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('GenAI timeout'), { name: 'AbortError' })), GENAI_TIMEOUT_MS))
        ]);
      } catch (err) {
        if (err.name === 'AbortError') throw Object.assign(new Error('Translation request timed out'), { status: 504 });
        throw err;
      }

      const translated = res?.text
        || (res?.candidates && res.candidates[0]?.content && res.candidates[0].content[0]?.text)
        || (Array.isArray(res?.outputs) && res.outputs[0]?.content?.[0]?.text)
        || null;

      if (!translated) throw Object.assign(new Error('GenAI returned empty translation'), { status: 502 });
      return String(translated).trim();
    }
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('Translation request timed out'), { status: 504 });
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const body = { q: text, target: targetLang, format: 'text' };

  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('Translation request timed out'), { status: 504 });
    throw Object.assign(new Error('Translation fetch failed'), { status: 502 });
  }

  if (!res.ok) {
    let bodyText = 'no body';
    try { bodyText = await res.text(); } catch (e) { /* ignore */ }
    throw Object.assign(new Error(`Translation service error: ${bodyText}`), { status: 502 });
  }

  const j = await res.json();
  return (j && j.data && j.data.translations && j.data.translations[0] && j.data.translations[0].translatedText) || null;
}

async function synthesizeSpeech(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !text) return null;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`;
  const body = {
    input: { text },
    voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' }
  };

  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, GENAI_TIMEOUT_MS);
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('TTS request timed out'), { status: 504 });
    throw Object.assign(new Error('TTS fetch failed'), { status: 502 });
  }

  if (!res.ok) {
    let bodyText = 'no body';
    try { bodyText = await res.text(); } catch (e) { /* ignore */ }
    throw Object.assign(new Error(`TTS service error: ${bodyText}`), { status: 502 });
  }

  const j = await res.json();
  return j && j.audioContent ? `data:audio/mp3;base64,${j.audioContent}` : null;
}

/**
 * Returns { word, definition, partOfSpeech, pronunciation, example, source, translations? }
 * options: { translateTo: 'tl' | 'en' }
 */
async function getWord(word, options = {}) {
  if (!word || typeof word !== 'string') throw Object.assign(new Error('Invalid word'), { status: 400 });
  const target = options.translateTo ? String(options.translateTo).toLowerCase().trim() : null;
  const key = `${String(word).toLowerCase().trim()}::${target || 'none'}`;
  const cached = _getFromCache(key);
  if (cached) return cached;

  let lookupWord = word;
  let translatedSourceWord = null; // when input was Tagalog and we translated it to English
  const dictFor = en => `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(en)}`;

  // First try dictionary lookup for the provided word
  let json;
  let res;
  try {
    res = await fetchWithTimeout(dictFor(lookupWord), {}, TIMEOUT_MS);
    if (!res.ok) {
      if (res.status === 404 && target === 'en') {
        // attempt Tagalog -> English: translate input to English, then lookup
        try {
          const t = await translateText(lookupWord, 'en');
          if (t && t.trim()) {
            translatedSourceWord = lookupWord;
            lookupWord = t.trim();
            res = await fetchWithTimeout(dictFor(lookupWord), {}, TIMEOUT_MS);
          }
        } catch (e) {
          // translation failed — we'll continue and handle not found below
        }
      }
    }
    if (!res.ok) {
      if (res.status === 404) throw Object.assign(new Error('Word not found'), { status: 404 });
      throw Object.assign(new Error('Remote dictionary error'), { status: 502 });
    }
    json = await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('Dictionary request timed out'), { status: 504 });
    throw err;
  }

  if (!Array.isArray(json) || json.length === 0) throw Object.assign(new Error('Word not found'), { status: 404 });

  const entry = json[0];
  const phoneticsArr = Array.isArray(entry.phonetics) ? entry.phonetics : [];
  let phonetic = phoneticsArr.find(p => p && p.audio && String(p.audio).trim()) || phoneticsArr.find(p => p && (p.text || p.audio)) || {};
  if (phonetic && phonetic.audio && typeof phonetic.audio === 'string') {
    let a = phonetic.audio.trim();
    if (a.startsWith('//')) a = 'https:' + a;
    phonetic.audio = a;
  }

  const meaning = (entry.meanings && entry.meanings[0]) || {};
  const definitionObj = (meaning.definitions && meaning.definitions[0]) || {};

  const hasAudio = Boolean(phonetic && phonetic.audio && typeof phonetic.audio === 'string'
    && (phonetic.audio.startsWith('http') || phonetic.audio.startsWith('data:')));

  const base = {
    word: entry.word || lookupWord,
    definition: definitionObj.definition || null,
    partOfSpeech: meaning.partOfSpeech || null,
    pronunciation: hasAudio ? phonetic.audio : 'No pronunciation Audio',
    example: definitionObj.example || null,
    source: 'dictionaryapi.dev'
  };

  // Synthesize English audio only when no audio URL exists and language is English (or unspecified)
  if (!hasAudio && (!target || target === 'en')) {
    try {
      const audioData = await synthesizeSpeech(base.word);
      if (audioData) base.pronunciation = audioData;
    } catch (e) {
      console.error('TTS error:', e && e.message);
    }
  }

  // If user requested translations (tl or en)
  if (target) {
    // If we translated input Tagalog -> English to get dict entry, return that translation result
    if (target === 'en' && translatedSourceWord) {
      const result = {
        ...base,
        pronunciation: base.pronunciation || 'No pronunciation Audio',
        translations: { target: 'en', word: base.word || lookupWord, original: translatedSourceWord }
      };
      _setCache(key, result);
      return result;
    }

    // Otherwise, translate fields into requested target (usual flow)
    try {
      const [tWord, tDef, tExample] = await Promise.all([
        translateText(base.word, target),
        translateText(base.definition || '', target),
        translateText(base.example || '', target)
      ]);
      // keep dictionary audio URL (English) if present when translating; otherwise show no audio
      let pronunciation = base.pronunciation || 'No pronunciation Audio';
      if (target === 'tl') {
        if (!(typeof pronunciation === 'string' && (pronunciation.startsWith('http') || pronunciation.startsWith('data:')))) {
          pronunciation = 'No pronunciation Audio';
        }
      }
      const result = {
        ...base,
        pronunciation,
        translations: { target, word: tWord || null, definition: tDef || null, example: tExample || null }
      };
      _setCache(key, result);
      return result;
    } catch (err) {
      const result = { ...base, translationError: err.message || 'translation failed' };
      _setCache(key, result);
      return result;
    }
  }

  _setCache(key, base);
  return base;
}

module.exports = { getWord };