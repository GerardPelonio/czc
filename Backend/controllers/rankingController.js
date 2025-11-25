const rankingService = require('../services/rankingService');

exports.getRanking = async (req, res, next) => {
  try {
    const student = req.student || {};
    const total =
      typeof student.completedBooksCount === 'number'
        ? student.completedBooksCount
        : (student.completedBooks || []).length;

    const rankInfo = rankingService.computeRank(total);
    rankInfo.badge = rankingService.badgeForTier(rankInfo.tier);

    res.json({
      totalCompletedBooks: total,
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
