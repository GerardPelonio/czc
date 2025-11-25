// services/HomeService.js
const HomeModel = require("../models/HomeModel");

async function saveProgress(data) {
  return HomeModel.saveReadingProgress(data);
}

async function getProgress(userId, storyId) {
  return HomeModel.getReadingProgress(userId, storyId);
}

async function getAllUserProgress(userId) {
  return HomeModel.getAllUserProgress(userId);
}

async function updateSessionDuration(userId, storyId, sessionDuration) {
  return HomeModel.updateSessionDuration(userId, storyId, sessionDuration);
}

async function markStoryCompleted(userId, storyId, totalReadingTime) {
  return HomeModel.markStoryCompleted(userId, storyId, totalReadingTime);
}

async function resetProgress(userId, storyId) {
  return HomeModel.resetProgress(userId, storyId);
}

async function getReadingStats(userId) {
  return HomeModel.getReadingStats(userId);
}

async function getBulkProgress(userId, storyIds) {
  return HomeModel.getBulkProgress(userId, storyIds);
}

async function deleteAllUserProgress(userId) {
  return HomeModel.deleteAllUserProgress(userId);
}

async function getRecentStories(userId, limit = 10) {
  const all = await HomeModel.getAllUserProgress(userId);
  return all
    .filter((p) => p.lastReadAt)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, limit);
}

async function getCompletedStories(userId, limit = 20) {
  const all = await HomeModel.getAllUserProgress(userId);
  return all
    .filter((p) => p.isCompleted)
    .sort((a, b) => b.completedAt - a.completedAt)
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
