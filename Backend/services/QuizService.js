const axios = require("axios");
const QuizModel = require("../models/QuizModel");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
  const resp = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature:0.5, maxOutputTokens:1500, responseMimeType:"application/json" }
  }, { headers: { "Content-Type":"application/json" }, timeout:30000 });

  const raw = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("AI response missing");
  return raw.replace(/```json/ig,"").replace(/```/g,"").trim();
}

module.exports = {
  async generateQuiz(userId, storyId, storyContent, title) {
    // Generate 5 True/False questions
    const tfRaw = await callGemini(buildTrueFalsePrompt(title, storyContent));
    let tfQuestions = JSON.parse(tfRaw).slice(0,5).map(q => {
      const questionText = (q.question || "").toString().trim() || "No question";
      const choices = ["true","false"];
      const correctAnswer = (q.correctAnswer || "").toString().trim().toLowerCase() === "true" ? "true" : "false";
      const explanation = (q.explanation || "No explanation").toString().trim();
      return { question: questionText, choices, correctAnswer, explanation };
    });

    // Generate 5 Multiple Choice questions
    const mcRaw = await callGemini(buildMultipleChoicePrompt(title, storyContent));
    let mcQuestions = JSON.parse(mcRaw).slice(0,5).map(q => {
      const questionText = (q.question || "").toString().trim() || "No question";
      let choices = Array.isArray(q.choices) ? q.choices.map(c=>c.toString()) : ["A","B","C","D"];
      while(choices.length<4) choices.push("None of the above");
      choices.length = 4;
      const correctAnswer = (q.correctAnswer || "").toString().trim();
      const explanation = (q.explanation || "No explanation").toString().trim();
      return { question: questionText, choices, correctAnswer, explanation };
    });

    // Combine TF + MC
    const questions = [...tfQuestions, ...mcQuestions];

    const quizData = {
      type: "mixed",
      numQuestions: 10,
      questions,
      generatedAt: new Date().toISOString(),
      title
    };

    await QuizModel.saveQuiz(userId, storyId, quizData);
    return quizData;
  },

  async getQuizForUser(userId, storyId) {
    const quiz = await QuizModel.getQuiz(userId, storyId);
    if (!quiz) return null;
    return {
      storyId,
      type: quiz.type,
      numQuestions: quiz.numQuestions,
      questions: quiz.questions.map(q=>({question:q.question, choices:q.choices}))
    };
  }
};
