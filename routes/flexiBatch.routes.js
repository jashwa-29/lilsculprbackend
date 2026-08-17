const express = require('express');
const router = express.Router();
const flexiBatchController = require('../controllers/flexiBatch.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected (admin only)
router.use(protect);

// Get all flexi-batches (admin)
router.get('/', flexiBatchController.getAllFlexiBatches);

// Get a student's flexi-schedule
router.get('/student/:studentId', flexiBatchController.getFlexiSchedule);

// Create or update a student's flexi-schedule
router.post('/student/:studentId', flexiBatchController.setFlexiSchedule);

// Update flexi-batch status
router.put('/:id', flexiBatchController.updateFlexiBatchStatus);

// Delete flexi-batch
router.delete('/:id', flexiBatchController.deleteFlexiBatch);

module.exports = router;
