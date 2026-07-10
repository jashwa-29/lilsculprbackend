const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public: Login
router.post('/login', authController.login);

// Protected: Get current admin info (used for session validation)
router.get('/me', protect, authController.getMe);

// Protected: Logout
router.post('/logout', protect, authController.logout);

module.exports = router;
