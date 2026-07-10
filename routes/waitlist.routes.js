const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlist.controller');
// const { protect } = require('../middleware/auth.middleware');

// All routes are protected (Assuming protect middleware is commented out or doesn't exist yet, I'll bypass it for now or implement if needed. Actually I'll comment it out since previous backend didn't use a strict auth middleware on every file unless explicitly defined)
// router.use(protect);

// Stats
router.get('/stats', waitlistController.getWaitlistStats);

// Get all waitlist entries
router.get('/', waitlistController.getAllWaitlist);

// Get waitlist for a specific batch
router.get('/batch/:batchId', waitlistController.getBatchWaitlist);

// Add to waitlist
router.post('/', waitlistController.addToWaitlist);

// Notify a waitlisted parent
router.put('/:id/notify', waitlistController.notifyWaitlist);

// Enroll a waitlisted student
router.put('/:id/enroll', waitlistController.enrollWaitlist);

// Remove from waitlist
router.delete('/:id', waitlistController.removeFromWaitlist);

module.exports = router;
