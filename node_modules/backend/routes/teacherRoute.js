const express = require('express');
const router = express.Router();
const controller = require('../controllers/teacherController');
const { verifyToken, requireRole } = require('../middlewares/teacherMiddleware'); 
const { validateTeacherUpdate } = require('../validators/teacherValidator');

// Teacher Routes
router.get('/api/teacher/profile/:id', verifyToken, requireRole('teacher'), controller.getProfile);
router.post('/api/teacher/profile', verifyToken, requireRole('teacher'), validateTeacherUpdate, controller.createProfile);
router.patch('/api/teacher/profile/:id', verifyToken, requireRole('teacher'), validateTeacherUpdate, controller.updateProfile);
router.delete('/api/teacher/profile/:id', verifyToken, requireRole('teacher'), controller.deleteProfile);

module.exports = router;