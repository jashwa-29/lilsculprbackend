const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');

// Get all batches
router.get('/', batchController.getAllBatches);

// Create a new batch
router.post('/', batchController.createBatch);

// Complete a batch and advance students
router.post('/:id/complete', batchController.completeBatch);

// Get student batch info
router.get('/student/:studentId', batchController.getStudentBatchInfo);

module.exports = router;
