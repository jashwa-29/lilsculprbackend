const express = require('express');
const router = express.Router();
const compensationRequestController = require('../controllers/compensationRequest.controller');
const { protect } = require('../middleware/auth.middleware');

// Public route (for parent portal)
router.post('/', compensationRequestController.createRequest);
router.get('/student/:studentId', compensationRequestController.getStudentRequests);

// Protected routes (admin only)
router.get('/', protect, compensationRequestController.getAllRequests);
router.get('/stats', protect, compensationRequestController.getRequestStats);
router.get('/:id', protect, compensationRequestController.getRequestById);
router.put('/:id/accept', protect, compensationRequestController.acceptRequest);
router.put('/:id/reject', protect, compensationRequestController.rejectRequest);

module.exports = router;
