const LibraryModel = require('../models/LibraryModel');

const err = (msg, status = 400) => {
  const e = new Error(msg);
  e.status = status;
  throw e;
};

async function getStories(queryParams = {}) {
  if (typeof queryParams !== 'object') throw err('Invalid query parameters', 400);
  return LibraryModel.getStories(queryParams);
}

module.exports = {
  getStories,
};
