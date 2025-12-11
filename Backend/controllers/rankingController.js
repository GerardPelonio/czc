const rankingService = require('../services/rankingService');

exports.getRanking = async (req, res, next) => {
  try {
    const student = req.student || {};
    const total =
      typeof student.completedBooksCount === 'number'
        ? student.completedBooksCount
        : (student.completedBooks || []).length;
    
    // Get total points from quiz submissions (used for level progress)
    const totalPoints = Number(student.points || 0);

    const rankInfo = rankingService.computeRank(total, totalPoints);
    rankInfo.badge = rankingService.badgeForTier(rankInfo.tier);

    res.json({
      totalCompletedBooks: total,
      totalPoints,
      ...rankInfo,
    });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const history = req.student?.completedBooks || [];
    res.json({ history });
  } catch (err) {
    next(err);
  }
};
