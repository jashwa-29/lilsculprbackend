const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

// GET all students
router.get('/', studentController.getAllStudents);

// GET level configuration
router.get('/levels', studentController.getLevelConfig);

// GET level statistics
router.get('/level-stats', studentController.getLevelStats);

// GET a single student
router.get('/:id', studentController.getStudentById);

// GET student level history
router.get('/:id/level-history', studentController.getLevelHistory);

// POST start level journey (newbie -> level 1)
router.post('/:id/start-level', studentController.startLevelJourney);

// POST advance to next level
router.post('/:id/advance-level', studentController.advanceLevel);

// PUT update student
router.put('/:id', studentController.updateStudent);

// DELETE student
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
