const rankingService = require('../services/rankingService');

exports.getRanking = async (req, res, next) => {
  try {
    const student = req.student || {};

    // Books completed: prefer the fast counter, fall back to arrays or legacy fields
    const total =
      typeof student.completedBooksCount === 'number'
        ? student.completedBooksCount
        : typeof student.booksReadCount === 'number'
          ? student.booksReadCount
          : (Array.isArray(student.completedBooks) ? student.completedBooks.length : 0) ||
            (Array.isArray(student.booksRead) ? student.booksRead.length : 0);
    
    // Quiz / challenge points: handle possible legacy fields
    const totalPoints = Number(
      student.points ??
      student.totalPoints ??
      student.quizPoints ??
      0
    );

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
