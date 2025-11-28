const firebase = require('firebase-admin');
const HomeModel = require('../models/HomeModel');
const QuestService = require('../services/QuestService');

const err = (msg, status = 400) => { 
  const e = new Error(msg); 
  e.status = status; 
  throw e; 
};

async function saveProgress(data) {
  if (!data || !data.userId || !data.storyId) throw err('Missing required progress data', 400);
  const saved = await HomeModel.saveReadingProgress(data);
  try {
    // always trigger 'chapter_read' if chapter information provided
    if (data.chapter) {
      await QuestService.updateUserQuestProgress(data.userId, 'chapter_read', { storyId: data.storyId, chapter: data.chapter });
    }
    // if the saved state marks the chapter as completed or progresses reached 100, trigger 'chapter_completed'
    if (saved && (saved.isCompleted || saved.progressPercentage === 100 || saved.chapterCompleted)) {
      await QuestService.updateUserQuestProgress(data.userId, 'chapter_completed', { storyId: data.storyId, chapter: data.chapter });
    }
  } catch (e) {
    // don't fail the save if quest update fails — just warn
    console.warn('HomeService: failed to update quest after saving progress', e && e.message ? e.message : e);
  }
  return saved;
}

async function getProgress(userId, storyId) {
  if (!userId || !storyId) throw err('userId and storyId are required', 400);
  return HomeModel.getReadingProgress(userId, storyId);
}

async function getAllUserProgress(userId) {
  if (!userId) throw err('userId is required', 400);
  return HomeModel.getAllUserProgress(userId);
}

async function updateSessionDuration(userId, storyId, sessionDuration) {
  if (!userId || !storyId || !sessionDuration) throw err('Missing parameters', 400);
  return HomeModel.updateSessionDuration(userId, storyId, sessionDuration);
}

async function markStoryCompleted(userId, storyId, totalReadingTime) {
  if (!userId || !storyId || !totalReadingTime) throw err('Missing parameters', 400);
  const data = await HomeModel.markStoryCompleted(userId, storyId, totalReadingTime);
  try {
    await QuestService.updateUserQuestProgress(userId, 'story_completed', { storyId });
  } catch (e) {
    // don't fail the story completion if quest update fails — just warn
    console.warn('HomeService: failed to update quest after story completion', e && e.message ? e.message : e);
  }
  return data;
}

async function resetProgress(userId, storyId) {
  if (!userId || !storyId) throw err('Missing parameters', 400);
  return HomeModel.resetProgress(userId, storyId);
}

async function getReadingStats(userId) {
  if (!userId) throw err('userId is required', 400);
  return HomeModel.getReadingStats(userId);
}

async function getBulkProgress(userId, storyIds) {
  if (!userId || !Array.isArray(storyIds)) throw err('Invalid parameters', 400);
  return HomeModel.getBulkProgress(userId, storyIds);
}

async function deleteAllUserProgress(userId) {
  if (!userId) throw err('userId is required', 400);
  return HomeModel.deleteAllUserProgress(userId);
}

async function getRecentStories(userId, limit = 10) {
  if (!userId) throw err('userId is required', 400);
  const all = await HomeModel.getAllUserProgress(userId);
  return all
    .filter(p => p.lastReadAt)
    .sort((a, b) => (b.lastReadAt?.seconds || 0) - (a.lastReadAt?.seconds || 0))
    .slice(0, limit);
}

async function getCompletedStories(userId, limit = 20) {
  if (!userId) throw err('userId is required', 400);
  const all = await HomeModel.getAllUserProgress(userId);
  return all
    .filter(p => p.isCompleted)
    .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    .slice(0, limit);
}

module.exports = {
  saveProgress,
  getProgress,
  getAllUserProgress,
  updateSessionDuration,
  markStoryCompleted,
  resetProgress,
  getReadingStats,
  getBulkProgress,
  deleteAllUserProgress,
  getRecentStories,
  getCompletedStories,
};
