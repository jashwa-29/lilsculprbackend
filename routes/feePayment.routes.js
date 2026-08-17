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
router.get('/revenue/detailed', protect, feePaymentController.getDetailedRevenue);

// Admin / Utility routes (No auth required for Postman testing as requested)
router.get('/all', feePaymentController.getAllFeeRecords);
router.delete('/:id', feePaymentController.deleteFeeRecord);

module.exports = router;
