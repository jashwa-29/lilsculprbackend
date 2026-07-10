const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portal.controller');

// Parent login
router.post('/login', portalController.login);

// Parent dashboard (requires studentId passed in body or query, or ideally JWT)
// For simplicity in the static site without complex auth headers, we can pass studentId in POST or query
router.get('/dashboard/:id', portalController.getDashboard);

// Available batches for compensation
router.get('/available-batches', portalController.getAvailableBatches);

// Book a make-up class
router.post('/book-compensation', portalController.bookCompensation);

// Get token details
router.get('/tokens/:id', portalController.getTokenDetails);

// Update date of birth
router.put('/update-dob/:id', portalController.updateDateOfBirth);

module.exports = router;
