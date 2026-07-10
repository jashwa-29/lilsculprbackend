const Waitlist = require('../models/Waitlist.model');
const Batch = require('../models/Batch.model');
const Student = require('../models/student.model');
const emailService = require('../services/email.service');

/**
 * POST /api/waitlist
 * Add a student to waitlist
 */
exports.addToWaitlist = async (req, res) => {
  try {
    const { studentId, batchId, notes } = req.body;

    if (!studentId || !batchId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and Batch ID are required'
      });
    }

    // Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if batch exists and is full
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    // Check if student is already on waitlist for this batch
    const existing = await Waitlist.findOne({
      studentId,
      batchId,
      status: { $in: ['waiting', 'notified'] }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Student is already on the waitlist for this batch'
      });
    }

    // Count current waitlist entries
    const waitlistCount = await Waitlist.countDocuments({
      batchId,
      status: 'waiting'
    });

    const waitlistEntry = new Waitlist({
      studentId,
      batchId,
      parentName: student.parentName,
      childName: student.childName,
      contact1: student.contact1,
      contact2: student.contact2,
      email: student.email,
      priority: waitlistCount + 1,
      notes
    });

    await waitlistEntry.save();

    // Update student status
    student.enrollmentStatus = 'waitlisted';
    await student.save();

    res.status(201).json({
      success: true,
      message: 'Added to waitlist successfully',
      data: waitlistEntry
    });

  } catch (error) {
    // Handle MongoDB duplicate key error from unique index { studentId, batchId }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Student is already on the waitlist for this batch'
      });
    }
    console.error('Add to Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to waitlist'
    });
  }
};

/**
 * GET /api/waitlist
 * Get all waitlist entries (admin)
 */
exports.getAllWaitlist = async (req, res) => {
  try {
    const { batchId, status, page = 1, limit = 50 } = req.query;

    let query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
      Waitlist.find(query)
        .populate('studentId', 'childName parentName contact1 email enrollmentId')
        .populate('batchId', 'type dayId time')
        .sort({ priority: 1, createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Waitlist.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get All Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waitlist'
    });
  }
};

/**
 * GET /api/waitlist/batch/:batchId
 * Get waitlist for a specific batch
 */
exports.getBatchWaitlist = async (req, res) => {
  try {
    const { batchId } = req.params;

    const entries = await Waitlist.find({
      batchId,
      status: { $in: ['waiting', 'notified'] }
    })
    .populate('studentId', 'childName parentName contact1 email enrollmentId')
    .sort({ priority: 1, createdAt: 1 });

    res.json({
      success: true,
      data: entries,
      count: entries.length
    });

  } catch (error) {
    console.error('Get Batch Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch waitlist'
    });
  }
};

/**
 * PUT /api/waitlist/:id/notify
 * Notify a waitlisted parent
 */
exports.notifyWaitlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const entry = await Waitlist.findById(id)
      .populate('studentId')
      .populate('batchId');

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Waitlist entry not found'
      });
    }

    if (entry.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        error: `Cannot notify entry with status: ${entry.status}`
      });
    }

    await entry.notify();

    // Send email using the dedicated email service
    if (entry.email) {
      await emailService.sendWaitlistNotification(entry.email, {
        parentName: entry.parentName,
        childName: entry.childName,
        batch: entry.batchId,
        message: message || `A seat has opened up in the ${entry.batchId.type} ${entry.batchId.dayId} ${entry.batchId.time} batch. Please confirm your enrollment within 24 hours.`
      });
    }

    res.json({
      success: true,
      message: 'Parent notified successfully',
      data: entry
    });

  } catch (error) {
    console.error('Notify Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to notify parent'
    });
  }
};

/**
 * PUT /api/waitlist/:id/enroll
 * Enroll a waitlisted student
 */
exports.enrollWaitlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { batchId } = req.body;

    const entry = await Waitlist.findById(id)
      .populate('studentId')
      .populate('batchId');

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Waitlist entry not found'
      });
    }

    const targetBatch = await Batch.findById(batchId || entry.batchId);
    if (!targetBatch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    // Check if batch has capacity
    if (targetBatch.enrolledStudents.length >= targetBatch.capacity) {
      return res.status(400).json({
        success: false,
        error: 'Batch is full'
      });
    }

    // Enroll the student
    await entry.enroll(batchId || entry.batchId);

    // Add student to batch
    await Batch.findByIdAndUpdate(targetBatch._id, {
      $addToSet: { enrolledStudents: entry.studentId._id }
    });

    res.json({
      success: true,
      message: 'Student enrolled successfully',
      data: entry
    });

  } catch (error) {
    console.error('Enroll Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enroll student'
    });
  }
};

/**
 * DELETE /api/waitlist/:id
 * Remove from waitlist
 */
exports.removeFromWaitlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const entry = await Waitlist.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Waitlist entry not found'
      });
    }

    entry.status = 'removed';
    entry.removedAt = new Date();
    entry.removedReason = reason || 'Admin removed';
    await entry.save();

    // Update student status
    await Student.findByIdAndUpdate(entry.studentId, {
      enrollmentStatus: 'active'
    });

    res.json({
      success: true,
      message: 'Removed from waitlist',
      data: entry
    });

  } catch (error) {
    console.error('Remove from Waitlist Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from waitlist'
    });
  }
};

/**
 * GET /api/waitlist/stats
 * Get waitlist statistics
 */
exports.getWaitlistStats = async (req, res) => {
  try {
    const [totalWaiting, totalNotified, totalEnrolled, totalRemoved] = await Promise.all([
      Waitlist.countDocuments({ status: 'waiting' }),
      Waitlist.countDocuments({ status: 'notified' }),
      Waitlist.countDocuments({ status: 'enrolled' }),
      Waitlist.countDocuments({ status: 'removed' })
    ]);

    // Get waitlist per batch
    const perBatch = await Waitlist.aggregate([
      { $match: { status: { $in: ['waiting', 'notified'] } } },
      {
        $group: {
          _id: '$batchId',
          count: { $sum: 1 },
          entries: { $push: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'batches',
          localField: '_id',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } }
    ]);

    res.json({
      success: true,
      data: {
        totalWaiting,
        totalNotified,
        totalEnrolled,
        totalRemoved,
        perBatch: perBatch.map(item => ({
          batchId: item._id,
          batchName: item.batch ? `${item.batch.type} ${item.batch.dayId} ${item.batch.time}` : 'Unknown',
          count: item.count,
          entries: item.entries.slice(0, 5)
        }))
      }
    });

  } catch (error) {
    console.error('Get Waitlist Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waitlist stats'
    });
  }
};