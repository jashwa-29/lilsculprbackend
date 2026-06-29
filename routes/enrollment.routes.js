const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const enrollmentController = require('../controllers/enrollment.controller');

// Create Razorpay Order
router.post('/create-order', enrollmentController.createOrder);

// Submit form data with uploaded photo
router.post('/submit', upload.single('photo'), enrollmentController.submitEnrollment);

// Admin: Get all students
router.get('/students', enrollmentController.getStudents);

// Admin: Update student status
router.put('/students/:id', enrollmentController.updateStudentStatus);

// Admin: Delete student
router.delete('/students/:id', enrollmentController.deleteStudent);

// Fee Tracking: Get all fee records for a student
router.get('/students/:id/fees', enrollmentController.getStudentFees);

// Fee Tracking: Create or update a fee record for a student
router.post('/students/:id/fees', enrollmentController.upsertStudentFee);

// Fee Tracking: Revenue overview across all students
router.get('/fees/overview', enrollmentController.getFeesOverview);

// Config: Get batches (with dynamic slot counts)
router.get('/batches', enrollmentController.getBatches);

// Admin: Update batches
router.put('/batches', enrollmentController.updateBatches);

module.exports = router;
