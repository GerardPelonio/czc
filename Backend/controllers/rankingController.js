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

    // Books completed: prefer counters when they are positive, otherwise use array lengths
    const counterValues = [student.completedBooksCount, student.booksReadCount]
      .filter((n) => typeof n === 'number' && n >= 0);
    const counterMax = counterValues.length ? Math.max(...counterValues) : -1;

    const arrayCompletedLen = Array.isArray(student.completedBooks) ? student.completedBooks.length : 0;
    const arrayReadLen = Array.isArray(student.booksRead) ? student.booksRead.length : 0;
    const arrayMax = Math.max(arrayCompletedLen, arrayReadLen);

    const total = counterMax > 0 ? counterMax : arrayMax;
    
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

    // Calculate booksRead for display (0-9 within current tier)
    // total is cumulative books across all tiers
    // We need to find: how many books in the current tier?
    const rankOrder = ["Bronze", "Silver", "Gold", "Diamond", "Amethyst", "Challenger"];
    const tierIndex = rankOrder.indexOf(rankInfo.tier);
    const totalBooksForCurrentTier = (tierIndex * 5 + (5 - rankInfo.sublevel)) * 10;
    const booksInCurrentTier = Math.min(total - totalBooksForCurrentTier, 10);
    
    // If books hit 10 in tier, show 10 (let frontend decide to show as 10/10 or 0/10)
    let booksReadDisplay = Math.max(0, booksInCurrentTier);

    res.json({
      totalCompletedBooks: total,
      totalPoints,
      booksRead: booksReadDisplay,
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
