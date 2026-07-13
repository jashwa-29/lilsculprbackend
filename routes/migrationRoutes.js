const express = require('express');
const router = express.Router();
const migrationController = require('../controllers/migrationController');

// Migration endpoint with dry run option
// Usage: POST /api/migration/link-students-batches?dryRun=true  (preview only)
// Usage: POST /api/migration/link-students-batches?dryRun=false (actually runs it)
router.post('/migration/link-students-batches', migrationController.linkStudentsToBatches);

module.exports = router;
