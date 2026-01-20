const express = require('express');
const router = express.Router();
const specialCourseController = require('../controllers/SpecialCourse.controller');

// ==================== PUBLIC ROUTES ====================

// Health check
router.get('/health', specialCourseController.healthCheck);

// Test cleanup
router.post('/test-cleanup', specialCourseController.testCleanup);

// Check slot availability
router.get('/check-slots', specialCourseController.checkSlots);

// Check multiple slots availability
router.post('/check-multiple-slots', specialCourseController.checkMultipleSlots);

// Check duplicate registration
router.post('/check-duplicate', specialCourseController.checkDuplicate);

// Initial registration (dynamic carnival)
router.post('/register', specialCourseController.register);

// Create payment order
router.post('/create-order', specialCourseController.createOrder);

// Verify payment
router.post('/verify-payment', specialCourseController.verifyPayment);

// Check registration status
router.post('/check-registration-status', specialCourseController.checkRegistrationStatus);

// ==================== ADMIN/UTILITY ROUTES ====================

// Get system statistics
router.get('/admin/statistics', specialCourseController.getStatistics);

// Get carnival-specific statistics
router.get('/admin/statistics/:carnivalName', specialCourseController.getCarnivalStatistics);

// Run manual cleanup
router.post('/admin/cleanup', specialCourseController.runCleanup);

// Manually expire a registration
router.post('/admin/expire-registration', specialCourseController.expireRegistration);

// GET all registrations (for admin panel) - MUST BE BEFORE DYNAMIC ROUTE
router.get('/admin/registrations', specialCourseController.getAllRegistrations);

// GET detailed registration - MUST BE BEFORE DYNAMIC ROUTE
router.get('/admin/registrations/:registrationId', specialCourseController.getRegistrationById);

// ==================== DYNAMIC ROUTES (MUST BE LAST) ====================

// Get registration details by ID - MUST BE VERY LAST
router.get('/:registrationId', specialCourseController.getRegistration);

module.exports = router;