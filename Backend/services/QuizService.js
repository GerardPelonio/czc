const axios = require("axios");
const QuizModel = require("../models/QuizModel");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

function buildTrueFalsePrompt(title, content) {
  return `
You are a literature teacher creating a comprehension quiz for "${title}".
Generate exactly 5 True/False statements.
Text excerpt (first 3000 chars): ${content.substring(0, 3000)}
Output JSON array with:
{ "question": "...", "choices":["true","false"], "correctAnswer":"true/false", "explanation":"..." }
`.trim();
}

function buildMultipleChoicePrompt(title, content) {
  return `
You are a literature teacher creating a comprehension quiz for "${title}".
Generate exactly 5 multiple-choice questions, each with 4 choices, one correct answer.
Text excerpt (first 3000 chars): ${content.substring(0, 3000)}
Output JSON array with:
{ "question":"...", "choices":["A","B","C","D"], "correctAnswer":"...", "explanation":"..." }
`.trim();
}

async function callGemini(prompt) {
  const resp = await axios.post(
    `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1500, responseMimeType: "application/json" }
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );

  const raw = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw err("AI response missing");
  return raw.replace(/```json/ig,"").replace(/```/g,"").trim();
}

async function generateQuiz(userId, storyId, storyContent, title) {
  if (!userId) throw err("userId is required");
  if (!storyId) throw err("storyId is required");
  if (!storyContent) throw err("storyContent is required");
  if (!title) throw err("title is required");

  // Generate True/False
  const tfRaw = await callGemini(buildTrueFalsePrompt(title, storyContent));
  const tfQuestions = JSON.parse(tfRaw).slice(0, 5).map(q => ({
    question: (q.question || "No question").toString().trim(),
    choices: ["true","false"],
    correctAnswer: (q.correctAnswer || "false").toString().trim().toLowerCase() === "true" ? "true" : "false",
    explanation: (q.explanation || "No explanation").toString().trim()
  }));

  // Generate Multiple Choice
  const mcRaw = await callGemini(buildMultipleChoicePrompt(title, storyContent));
  const mcQuestions = JSON.parse(mcRaw).slice(0, 5).map(q => {
    let choices = Array.isArray(q.choices) ? q.choices.map(c => c.toString()) : ["A","B","C","D"];
    while (choices.length < 4) choices.push("None of the above");
    choices.length = 4;
    return {
      question: (q.question || "No question").toString().trim(),
      choices,
      correctAnswer: (q.correctAnswer || "").toString().trim(),
      explanation: (q.explanation || "No explanation").toString().trim()
    };
  });

  const questions = [...tfQuestions, ...mcQuestions];
  const quizData = {
    type: "mixed",
    numQuestions: questions.length,
    questions,
    generatedAt: new Date().toISOString(),
    title
  };

  await QuizModel.saveQuiz(userId, storyId, quizData);
  return quizData;
}

async function getQuizForUser(userId, storyId) {
  if (!userId) throw err("userId is required");
  if (!storyId) throw err("storyId is required");

  const quiz = await QuizModel.getQuiz(userId, storyId);
  if (!quiz) return null;

  return {
    storyId,
    type: quiz.type,
    numQuestions: quiz.numQuestions,
    questions: quiz.questions.map(q => ({ question: q.question, choices: q.choices }))
  };
}

module.exports = {
  generateQuiz,
  getQuizForUser,
};
