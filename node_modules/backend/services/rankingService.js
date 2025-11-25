const RANKS = ['Bronze', 'Silver', 'Gold', 'Amethyst', 'Diamond', 'Challenger'];
const BOOKS_PER_SUBLEVEL = 10;
const SUBLEVELS_PER_TIER = 5;

function computeRank(totalCompletedBooks = 0) {
  const level = Math.floor(totalCompletedBooks / BOOKS_PER_SUBLEVEL);
  const tierIndex = Math.min(Math.floor(level / SUBLEVELS_PER_TIER), RANKS.length - 1);
  const sublevel = Math.min((level % SUBLEVELS_PER_TIER) + 1, SUBLEVELS_PER_TIER);
  const currentRank = `${RANKS[tierIndex]} ${sublevel}`;

  const progressInSublevel = totalCompletedBooks % BOOKS_PER_SUBLEVEL;
  const booksToNext = (tierIndex === RANKS.length - 1 && sublevel === SUBLEVELS_PER_TIER)
    ? 0
    : BOOKS_PER_SUBLEVEL - progressInSublevel;

  let nextRank = null;
  if (!(tierIndex === RANKS.length - 1 && sublevel === SUBLEVELS_PER_TIER)) {
    let nextTier = tierIndex;
    let nextSub = sublevel + 1;
    if (nextSub > SUBLEVELS_PER_TIER) {
      nextSub = 1;
      nextTier = Math.min(tierIndex + 1, RANKS.length - 1);
    }
    nextRank = `${RANKS[nextTier]} ${nextSub}`;
  }

  return {
    currentRank,
    tier: RANKS[tierIndex],
    sublevel,
    progressInSublevel,
    booksToNext,
    nextRank,
  };
}

function badgeForTier(tier) {
  // Minimal: emoji badge. Frontend can swap for SVG assets.
  const map = {
    Bronze: '🥉',
    Silver: '🥈',
    Gold: '🥇',
    Amethyst: '🔷',
    Diamond: '💎',
    Challenger: '🔥',
  };
  return map[tier] || '📚';
}

/**
 * Safe transactional helper to record a completed book and keep a fast count.
 * Avoids duplicates; records finishedAt.
 * db: firestore instance (app.locals.db)
 * studentId: string
 * book: { bookId, title, ... }
 */
async function addCompletedBook(db, studentId, book = {}) {
  if (!db || !studentId || !book.bookId) throw new Error('Invalid args');
  const studentRef = db.collection('students').doc(studentId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(studentRef);
    if (!snap.exists) throw new Error('Student not found');

    const data = snap.data() || {};
    const existing = data.completedBooks || [];
    if (existing.some((b) => b.bookId === book.bookId)) {
      // already recorded
      return;
    }

    const toPush = {
      bookId: book.bookId,
      title: book.title || '',
      finishedAt: new Date().toISOString(),
    };

    const updatedBooks = [...existing, toPush];
    const updatedCount = (data.completedBooksCount || existing.length) + 1;

    tx.update(studentRef, {
      completedBooks: updatedBooks,
      completedBooksCount: updatedCount,
      updatedAt: new Date().toISOString(),
    });
  });
}

module.exports = {
  computeRank,
  badgeForTier,
  addCompletedBook,
};