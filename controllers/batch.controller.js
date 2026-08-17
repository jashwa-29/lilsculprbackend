const Batch = require('../models/Batch.model');
const Student = require('../models/student.model');
const FlexiBatch = require('../models/FlexiBatch.model');
const CompensationToken = require('../models/CompensationToken.model');

/**
 * GET /api/batches
 * Get all active and filling batches + flexi-batches
 */
exports.getAllBatches = async (req, res) => {
  try {
    // Get regular batches
    const batches = await Batch.find().populate('enrolledStudents', 'childName currentLevel enrollmentStatus');

    // Get active flexi-batches with student info
    const flexiBatches = await FlexiBatch.find({ status: 'active' })
      .populate('studentId', 'childName parentName enrollmentId');

    const dayShortMap = {
      'Monday': 'Mon',
      'Tuesday': 'Tue',
      'Wednesday': 'Wed',
      'Thursday': 'Thu',
      'Friday': 'Fri',
      'Saturday': 'Sat',
      'Sunday': 'Sun'
    };

    // Format flexi-batches for display (safe property access)
    const formattedFlexiBatches = flexiBatches.map(fb => {
      const schedule = fb.schedule || [];
      const daysShort = schedule.map(s => dayShortMap[s.day] || s.day).join('/');
      const daysFull = schedule.map(s => s.day).join(' & ');
      const timeText = schedule[0]?.time || '';

      return {
        _id: fb._id,
        type: 'flexi',
        dayId: daysShort,           // e.g., "Tue/Wed"
        dayIdFull: daysFull,        // e.g., "Tuesday & Wednesday"
        time: timeText,
        capacity: 999,              // No capacity limit
        status: fb.status || 'active',
        isFlexi: true,
        schedule,
        enrolledStudents: fb.studentId ? [fb.studentId] : [],
        enrolledCount: fb.studentId ? 1 : 0,
        displayName: `${daysShort} · ${timeText}`,
        displayNameFull: `${daysFull} · ${timeText}`,
        classType: fb.classType || 'offline'
      };
    });

    // Format regular batches uniformly
    const formattedRegularBatches = batches.map(batch => ({
      _id: batch._id,
      type: batch.type,
      dayId: batch.dayId,
      time: batch.time,
      capacity: batch.capacity,
      status: batch.status,
      isFlexi: false,
      enrolledStudents: batch.enrolledStudents || [],
      enrolledCount: batch.enrolledStudents ? batch.enrolledStudents.length : 0,
      displayName: `${batch.dayId} · ${batch.time}`,
      instructor: batch.instructor,
      notes: batch.notes
    }));

    // Combine and sort: regular batches first, then flexi-batches
    const allBatches = [...formattedRegularBatches, ...formattedFlexiBatches];
    allBatches.sort((a, b) => {
      if (a.isFlexi && !b.isFlexi) return 1;
      if (!a.isFlexi && b.isFlexi) return -1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    res.json({
      success: true,
      batches: allBatches,
      flexiBatches: formattedFlexiBatches,
      regularBatches: formattedRegularBatches,
      counts: {
        total: allBatches.length,
        regular: formattedRegularBatches.length,
        flexi: formattedFlexiBatches.length
      }
    });
  } catch (error) {
    console.error('Get All Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batches: ' + error.message });
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
      .populate('flexiBatchId')
      .select('currentLevel enrollmentStatus batchId flexiBatchId levelHistory levelStartedAt isFlexiBatch');
    
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

    // Format batch info (includes flexi)
    let batchInfo = null;

    if (student.isFlexiBatch && student.flexiBatchId) {
      const flexi = student.flexiBatchId;
      batchInfo = {
        type: 'flexi',
        displayName: flexi.displayName,
        displayNameFull: flexi.displayNameFull,
        dayShort: flexi.dayShort,
        dayFull: flexi.dayFull,
        schedule: flexi.schedule,
        classType: flexi.classType,
        status: flexi.status,
        notes: flexi.notes
      };
    } else if (student.batchId) {
      batchInfo = {
        type: 'regular',
        batch: student.batchId
      };
    }

    res.json({
      success: true,
      student: {
        currentLevel: student.currentLevel,
        enrollmentStatus: student.enrollmentStatus,
        batch: student.batchId,
        flexiBatch: student.flexiBatchId,
        isFlexiBatch: student.isFlexiBatch,
        levelHistory: student.levelHistory,
        levelStartedAt: student.levelStartedAt,
        availableTokens,
        levelDetails,
        batchInfo
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

/**
 * DELETE /api/batches/all
 * Delete all batches (Admin only)
 */
exports.deleteAllBatches = async (req, res) => {
  try {
    await Batch.deleteMany({});
    res.json({ success: true, message: 'All batches deleted successfully' });
  } catch (error) {
    console.error('Delete All Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete all batches' });
  }
};

/**
 * DELETE /api/batches/:id
 * Delete a specific batch
 */
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByIdAndDelete(id);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Delete Batch Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete batch' });
  }
};

/**
 * PUT /api/batches/:id
 * Edit a specific batch
 */
exports.editBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    res.json({ success: true, message: 'Batch updated successfully', batch });
  } catch (error) {
    console.error('Edit Batch Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update batch' });
  }
};

/**
 * POST /api/batches/seed
 * Run the seedBatches script
 */
exports.seedBatchesHandler = async (req, res) => {
  try {
    const seedBatches = require('../seed/seedBatches');
    // Using an interceptor to capture console logs from the seed script
    const originalLog = console.log;
    let logOutput = [];
    console.log = (...args) => {
      logOutput.push(args.join(' '));
      originalLog(...args);
    };

    await seedBatches();

    // Restore console.log
    console.log = originalLog;

    res.json({ success: true, message: 'Batches seeded successfully', logs: logOutput });
  } catch (error) {
    console.error('Seed Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to seed batches' });
  }
};