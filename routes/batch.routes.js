const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');
const flexiBatchController = require('../controllers/flexiBatch.controller');

// Get all batches (including flexi)
router.get('/', batchController.getAllBatches);

// Get flexi-batches only
router.get('/flexi', flexiBatchController.getAllFlexiBatches);

// Create a new batch
router.post('/', batchController.createBatch);

// Complete a batch and advance students
router.post('/:id/complete', batchController.completeBatch);

// Get student batch info
router.get('/student/:studentId', batchController.getStudentBatchInfo);

// Delete all batches
router.delete('/all', batchController.deleteAllBatches);

// Trigger seed batches script
router.post('/seed', batchController.seedBatchesHandler);

// Delete specific batch
router.delete('/:id', batchController.deleteBatch);

// Edit specific batch
router.put('/:id', batchController.editBatch);

module.exports = router;
