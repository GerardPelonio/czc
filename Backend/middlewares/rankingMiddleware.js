const loadStudent = async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ message: 'Database not initialized' });
    
    const uid = req.user?.uid || req.user?.id || req.user?.userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const docRef = db.collection('students').doc(uid);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ message: 'Student not found' });

    req.student = { id: snap.id, ...snap.data() };
    req.studentRef = docRef;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { loadStudent };