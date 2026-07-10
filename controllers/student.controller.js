const Student = require('../models/student.model');
const Batch = require('../models/Batch.model');

/**
 * GET /api/students
 * Get all students with optional filters
 */
exports.getAllStudents = async (req, res) => {
  try {
    const { status, level, batchId, search } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (level) query.currentLevel = parseInt(level);
    if (batchId) query.batchId = batchId;
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { childName: searchRegex },
        { parentName: searchRegex },
        { enrollmentId: searchRegex },
        { contact1: searchRegex },
        { email: searchRegex }
      ];
    }
    
    const students = await Student.find(query)
      .populate('batchId')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Get All Students Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
};

/**
 * GET /api/students/:id
 * Get a single student by ID
 */
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('batchId');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    // Get level details
    const levelDetails = student.getCurrentLevelDetails();
    
    res.json({
      success: true,
      student,
      levelDetails
    });
  } catch (error) {
    console.error('Get Student By ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student'
    });
  }
};

/**
 * POST /api/students/:id/start-level
 * Start the student's level journey (from level 0 to level 1)
 */
exports.startLevelJourney = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    // Check if student is already started
    if (student.currentLevel !== 0) {
      return res.status(400).json({
        success: false,
        error: `Student is already at Level ${student.currentLevel}`,
        currentLevel: student.currentLevel
      });
    }
    
    // Start the journey
    await student.startLevelJourney();
    
    res.json({
      success: true,
      message: `${student.childName} has started their Level 1 journey!`,
      student,
      levelDetails: student.getCurrentLevelDetails()
    });
  } catch (error) {
    console.error('Start Level Journey Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start level journey: ' + error.message
    });
  }
};

/**
 * POST /api/students/:id/advance-level
 * Advance a student to the next level (admin only)
 */
exports.advanceLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body; // Allow force advance even if not in batch
    
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    // Check if student is at max level
    if (student.currentLevel >= 12) {
      return res.status(400).json({
        success: false,
        error: 'Student is already at the maximum level (Level 12)'
      });
    }
    
    // Check if student has started
    if (student.currentLevel === 0) {
      return res.status(400).json({
        success: false,
        error: 'Student has not started their level journey yet. Please start Level 1 first.'
      });
    }
    
    // Advance the level
    const result = await student.advanceLevel();
    
    res.json({
      success: true,
      message: result.action === 'graduated' 
        ? `${student.childName} has graduated from Level 12! 🎉`
        : `${student.childName} advanced from Level ${result.fromLevel} to Level ${result.toLevel}`,
      student,
      levelDetails: student.getCurrentLevelDetails(),
      action: result.action
    });
  } catch (error) {
    console.error('Advance Level Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to advance level: ' + error.message
    });
  }
};

/**
 * GET /api/students/:id/level-history
 * Get complete level history for a student
 */
exports.getLevelHistory = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .select('childName currentLevel levelHistory enrollmentStatus levelStartedAt');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    res.json({
      success: true,
      student: {
        childName: student.childName,
        currentLevel: student.currentLevel,
        enrollmentStatus: student.enrollmentStatus,
        levelStartedAt: student.levelStartedAt,
        levelHistory: student.levelHistory,
        completedCount: student.levelHistory.filter(h => h.completedDate).length,
        totalLevels: 12
      }
    });
  } catch (error) {
    console.error('Get Level History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch level history'
    });
  }
};

/**
 * GET /api/students/level-stats
 * Get statistics about student levels
 */
exports.getLevelStats = async (req, res) => {
  try {
    const [totalStudents, levelDistribution, completionStats] = await Promise.all([
      Student.countDocuments(),
      Student.aggregate([
        {
          $group: {
            _id: '$currentLevel',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Student.aggregate([
        {
          $group: {
            _id: '$enrollmentStatus',
            count: { $sum: 1 }
          }
        }
      ])
    ]);
    
    // Get students with level 0 (newbies)
    const newbies = await Student.countDocuments({ currentLevel: 0 });
    
    // Get graduated students
    const graduated = await Student.countDocuments({ enrollmentStatus: 'graduated' });
    
    // Get active students
    const active = await Student.countDocuments({ 
      enrollmentStatus: 'active',
      currentLevel: { $gt: 0 }
    });
    
    res.json({
      success: true,
      stats: {
        totalStudents,
        newbies,
        active,
        graduated,
        levelDistribution: levelDistribution.map(item => ({
          level: item._id,
          count: item.count
        })),
        completionStats: completionStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get Level Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch level statistics'
    });
  }
};

/**
 * PUT /api/students/:id
 * Update a student (admin only)
 */
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Prevent setting level to 0 via update (must use start-level endpoint)
    if (updates.currentLevel === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot set level to 0. Use the "Start Level Journey" endpoint instead.'
      });
    }
    
    const student = await Student.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('batchId');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    res.json({
      success: true,
      student,
      levelDetails: student.getCurrentLevelDetails()
    });
  } catch (error) {
    console.error('Update Student Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student: ' + error.message
    });
  }
};

/**
 * DELETE /api/students/:id
 * Delete a student (admin only)
 */
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    res.json({
      success: true,
      message: `Student ${student.childName} deleted successfully`
    });
  } catch (error) {
    console.error('Delete Student Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student'
    });
  }
};

/**
 * GET /api/students/levels
 * Get level configuration and details
 */
exports.getLevelConfig = async (req, res) => {
  try {
    // Define level details
    const levels = [];
    for (let i = 0; i <= 12; i++) {
      if (i === 0) {
        levels.push({
          level: 0,
          label: 'Newbie',
          description: 'Not yet started the level journey',
          status: 'not_started'
        });
      } else {
        levels.push({
          level: i,
          label: `Level ${i}`,
          description: i === 12 ? 'Master Level - Graduation!' : `Level ${i} of 12`,
          status: i === 12 ? 'graduation' : 'in_progress'
        });
      }
    }
    
    res.json({
      success: true,
      levels,
      totalLevels: 12,
      graduationLevel: 12
    });
  } catch (error) {
    console.error('Get Level Config Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch level configuration'
    });
  }
};