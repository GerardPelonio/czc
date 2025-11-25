// services/LibraryService.js
const LibraryModel = require("../models/LibraryModel");


async function getStories(queryParams) {
  return LibraryModel.getStories(queryParams);
}

module.exports = {
  getStories,
};
