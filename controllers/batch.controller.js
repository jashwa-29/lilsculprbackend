const Batch = require('../models/Batch.model');
const Student = require('../models/student.model');
const CompensationToken = require('../models/CompensationToken.model');

/**
 * GET /api/batches
 * Get all active and filling batches
 */
exports.getAllBatches = async (req, res) => {
  try {
    const batches = await Batch.find().populate('enrolledStudents', 'childName currentLevel enrollmentStatus');
    res.json({ success: true, batches });
  } catch (error) {
    console.error('Get All Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batches' });
  }
};

/**
 * POST /api/batches
 * Create a new batch
 */
exports.createBatch = async (req, res) => {
  try {
    const batch = new Batch(req.body);
    await batch.save();
    res.status(201).json({ success: true, batch });
  } catch (error) {
    console.error('Create Batch Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create batch' });
  }
};

/**
 * POST /api/batches/:id/complete
 * Complete a batch and auto-advance students to next level
 * UPDATED: Proper level progression system
 */
exports.completeBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findById(id).populate('enrolledStudents');
    
    if (!batch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Batch not found' 
      });
    }

    // Check if batch is already completed
    if (batch.status === 'completed' || batch.status === 'archived') {
      return res.status(400).json({ 
        success: false, 
        error: `Batch is already ${batch.status}` 
      });
    }

    // Process each student
    const results = {
      advanced: [],
      graduated: [],
      paused: [],
      error: [],
      notStarted: []
    };

    for (const student of batch.enrolledStudents) {
      try {
        const currentLevel = student.currentLevel || 0;
        
        // ═══ NEW: Check if student is at level 0 (not started) ═══
        if (currentLevel === 0) {
          results.notStarted.push({
            studentId: student._id,
            name: student.childName,
            message: 'Student has not started their level journey yet. Please start Level 1 first.'
          });
          continue;
        }

        // ═══ STEP 1: Mark current level as completed ═══
        // Find the current level entry in history
        const currentLevelEntry = student.levelHistory.find(h => 
          h.level === currentLevel && h.completedDate === null
        );

        if (currentLevelEntry) {
          currentLevelEntry.completedDate = new Date();
        } else {
          // If no entry exists, create one (backward compatibility)
          student.levelHistory.push({
            level: currentLevel,
            startedDate: student.enrolledDate || new Date(),
            completedDate: new Date(),
            certificateIssued: false
          });
        }

        // ═══ STEP 2: Determine next level ═══
        const nextLevel = currentLevel + 1;

        if (nextLevel <= 12) {
          // ═══ STEP 3: Advance to next level ═══
          student.currentLevel = nextLevel;
          
          // Add new level entry
          student.levelHistory.push({
            level: nextLevel,
            startedDate: new Date(),
            completedDate: null,
            certificateIssued: false
          });
          
          student.enrollmentStatus = 'active';
          await student.save();
          
          results.advanced.push({
            studentId: student._id,
            name: student.childName,
            oldLevel: currentLevel,
            newLevel: nextLevel
          });
          
          console.log(`✅ ${student.childName} advanced from Level ${currentLevel} to Level ${nextLevel}`);
        } else {
          // ═══ STEP 4: Student has completed all 12 levels ═══
          student.enrollmentStatus = 'graduated';
          student.currentLevel = 12;
          await student.save();
          
          results.graduated.push({
            studentId: student._id,
            name: student.childName,
            message: '🎉 Student has graduated from all 12 levels!'
          });
          
          console.log(`🎉 ${student.childName} has graduated from Level 12!`);
        }
      } catch (err) {
        console.error(`Error processing student ${student._id}:`, err);
        results.error.push({
          studentId: student._id,
          name: student.childName,
          error: err.message
        });
      }
    }

    // Mark current batch as completed
    batch.status = 'completed';
    await batch.save();

    // Generate summary
    const summary = {
      batchCompleted: {
        id: batch._id,
        totalStudents: batch.enrolledStudents.length
      },
      results
    };

    console.log(`✅ Batch ${batch._id} completed. Summary:`, {
      advanced: results.advanced.length,
      graduated: results.graduated.length,
      notStarted: results.notStarted.length,
      errors: results.error.length
    });
    
    res.json({
      success: true,
      summary,
      message: `Batch completed. ${results.advanced.length} students advanced, ${results.graduated.length} students graduated.`
    });
  } catch (error) {
    console.error('Complete Batch Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete batch: ' + error.message
    });
  }
};

/**
 * GET /api/batches/student/:studentId
 * Get student's current batch and progression
 */
exports.getStudentBatchInfo = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId)
      .populate('batchId')
      .select('currentLevel enrollmentStatus batchId levelHistory levelStartedAt');
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: 'Student not found' 
      });
    }

    // Get available tokens
    const availableTokens = await CompensationToken.countDocuments({
      studentId,
      status: 'available',
      expiryDate: { $gt: new Date() }
    });

    // Get level details
    const levelDetails = student.getCurrentLevelDetails();

    res.json({
      success: true,
      student: {
        currentLevel: student.currentLevel,
        enrollmentStatus: student.enrollmentStatus,
        batch: student.batchId,
        levelHistory: student.levelHistory,
        levelStartedAt: student.levelStartedAt,
        availableTokens,
        levelDetails
      }
    });
  } catch (error) {
    console.error('Get Student Batch Info Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch student batch info' 
    });
  }
};

/**
 * POST /api/batches/:batchId/add-students
 * Add students to a batch (for manual assignment)
 */
exports.addStudentsToBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { studentIds } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'studentIds array is required'
      });
    }
    
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // Add students to batch
    const added = [];
    const skipped = [];
    
    for (const studentId of studentIds) {
      const student = await Student.findById(studentId);
      if (!student) {
        skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }
      
      // Check if already in batch
      if (batch.enrolledStudents.includes(studentId)) {
        skipped.push({ studentId, reason: 'Already in batch', name: student.childName });
        continue;
      }
      
      batch.enrolledStudents.push(studentId);
      student.batchId = batchId;
      student.batchJoinedDate = new Date();
      await student.save();
      added.push({ studentId, name: student.childName });
    }
    
    await batch.save();
    
    res.json({
      success: true,
      message: `Added ${added.length} students to batch`,
      added,
      skipped,
      batch
    });
  } catch (error) {
    console.error('Add Students To Batch Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add students to batch'
    });
  }
};