// services/StoryService.js
const StoryModel = require("../models/StoryModel");

/**
 * Fetch a single story by ID
 */
async function getStoryById(storyId) {
  return StoryModel.getStoryById(storyId);
}

/**
 * Save or update user reading progress
 */
async function saveProgress(userId, storyId, progressData) {
  return StoryModel.saveProgress(userId, storyId, progressData);
}

/**
 * Get a user's reading progress for a specific story
 */
async function getProgress(userId, storyId) {
  return StoryModel.getProgress(userId, storyId);
}

module.exports = {
  getStoryById,
  saveProgress,
  getProgress,
};
