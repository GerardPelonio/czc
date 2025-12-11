const rankingService = require('../services/rankingService');

exports.getRanking = async (req, res, next) => {
  try {
    const student = req.student || {};

    // TEMP debug: log student snapshot to trace missing fields
    console.log('[ranking] student payload', {
      id: student.id,
      completedBooksCount: student.completedBooksCount,
      booksReadCount: student.booksReadCount,
      completedBooksLen: Array.isArray(student.completedBooks) ? student.completedBooks.length : 'n/a',
      booksReadLen: Array.isArray(student.booksRead) ? student.booksRead.length : 'n/a',
      points: student.points,
      totalPoints: student.totalPoints,
      quizPoints: student.quizPoints,
    });

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

    // Quick debug hook: return raw payload when debug=1
    if (req.query && req.query.debug === '1') {
      return res.json({
        debug: true,
        student: {
          id: student.id,
          completedBooksCount: student.completedBooksCount,
          booksReadCount: student.booksReadCount,
          completedBooksLen: Array.isArray(student.completedBooks) ? student.completedBooks.length : null,
          booksReadLen: Array.isArray(student.booksRead) ? student.booksRead.length : null,
          points: student.points,
          totalPoints: student.totalPoints,
          quizPoints: student.quizPoints,
        },
        totals: { totalCompletedBooks: total, totalPoints },
      });
    }

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
