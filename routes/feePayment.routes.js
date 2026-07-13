const express = require('express');
const router = express.Router();
const feePaymentController = require('../controllers/feePayment.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes (for parents)
router.post('/student-details', feePaymentController.getStudentForFeePayment);
router.post('/create-order', feePaymentController.createFeePaymentOrder);
router.post('/verify', feePaymentController.verifyFeePayment);

// Protected routes (admin only)
router.get('/history/:studentId', protect, feePaymentController.getFeeHistory);
router.get('/summary', protect, feePaymentController.getPaymentSummary);

module.exports = router;
