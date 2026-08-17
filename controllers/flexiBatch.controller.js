const FlexiBatch = require('../models/FlexiBatch.model');
const Student = require('../models/student.model');
const FeeRecord = require('../models/FeeRecord.model');
const emailService = require('../services/email.service');
const { syncStudentPaymentStatus } = require('../services/syncFeeStatus.service');

// Helper: Get current month/year string
function getCurrentMonthYear() {
  const d = new Date();
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Validate a flexi-batch schedule payload
 * Expected shape: [{ day, time, timeStart, timeEnd }, ...] — exactly 2 distinct days
 */
function validateSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule) || schedule.length !== 2) {
    return 'Please select exactly 2 days for the flexi-batch.';
  }

  for (const slot of schedule) {
    if (!VALID_DAYS.includes(slot.day)) {
      return `Invalid day: ${slot.day}. Must be a valid day of the week (Monday - Sunday).`;
    }
    if (!slot.time || !slot.timeStart || !slot.timeEnd) {
      return 'Each schedule item must have time, timeStart, and timeEnd fields.';
    }
  }

  const uniqueDays = new Set(schedule.map(s => s.day));
  if (uniqueDays.size !== 2) {
    return 'Please select 2 different days.';
  }

  return null;
}

/**
 * Create or update a flexi-batch schedule for a student
 */
exports.setFlexiSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schedule, classType, notes } = req.body;

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Validate schedule
    const scheduleError = validateSchedule(schedule);
    if (scheduleError) {
      return res.status(400).json({ success: false, error: scheduleError });
    }

    const resolvedClassType = classType || student.classType || 'offline';

    // Find and update, or create if it doesn't exist
    const flexiBatch = await FlexiBatch.findOneAndUpdate(
      { studentId: studentId },
      {
        schedule: schedule,
        classType: resolvedClassType,
        status: 'active',
        notes: notes || '',
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Format the days and time for display (short names, e.g., "Tue/Wed")
    const dayShortMap = {
      'Monday': 'Mon',
      'Tuesday': 'Tue',
      'Wednesday': 'Wed',
      'Thursday': 'Thu',
      'Friday': 'Fri',
      'Saturday': 'Sat',
      'Sunday': 'Sun'
    };
    const daysFull = schedule.map(s => s.day);
    const daysShort = daysFull.map(d => dayShortMap[d] || d);
    const daysText = daysShort.join('/');       // e.g., "Tue/Wed"
    const daysFullText = daysFull.join(' & ');  // e.g., "Tuesday & Wednesday"
    const timeText = schedule[0]?.time || '';

    // Update student's classType and mark as flexi
    student.classType = resolvedClassType;
    student.enrollmentStatus = 'active';
    student.isFlexiBatch = true;
    student.flexiBatchId = flexiBatch._id;

    // ═══════════════════════════════════════════════════════════
    // CRITICAL: Set batch fields to show the flexi schedule
    // as if it's a regular batch
    // ═══════════════════════════════════════════════════════════
    student.dayId = daysText;  // e.g., "Tue/Wed"
    student.dayIdFull = daysFullText;  // e.g., "Tuesday & Wednesday"
    student.time = timeText;   // e.g., "4:00 PM - 5:00 PM"
    student.slotKey = `flexi-${student._id}`; // Unique identifier
    student.batchDisplayName = `${daysText} at ${timeText}`;
    student.batchDisplayFull = `${daysFullText} at ${timeText}`;

    // Clear any regular batch reference
    student.batchId = null;

    await student.save();

    // Create first month fee record if not exists
    const currentMonthYear = getCurrentMonthYear();
    const [month, year] = currentMonthYear.split(' ');

    const existingFee = await FeeRecord.findOne({
      studentId: student._id,
      month,
      year: Number(year)
    });

    if (!existingFee) {
      const baseFee = resolvedClassType === 'offline' ? 2500 : 2200;
      const totalAmount = student.kitOptIn ? baseFee + 2000 : baseFee;

      const feeRecord = new FeeRecord({
        studentId: student._id,
        enrollmentId: student.enrollmentId,
        childName: student.childName,
        parentName: student.parentName,
        email: student.email,
        contact1: student.contact1,
        month,
        year: Number(year),
        amount: totalAmount,
        status: student.paymentStatus === 'Completed' ? 'Paid' : 'Pending',
        paymentMethod: student.paymentMethod || null,
        paidAt: student.paymentStatus === 'Completed' ? new Date() : null,
        notes: 'First month fee for flexi-batch'
      });
      await feeRecord.save();
    }

    // Sync payment status
    await syncStudentPaymentStatus(studentId);

    // Send confirmation email
    if (student.email) {
      try {
        await emailService.sendFlexiBatchConfirmation(student, flexiBatch);
      } catch (emailError) {
        console.warn('⚠️ Failed to send flexi-batch confirmation email:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: 'Flexi-batch schedule saved successfully.',
      data: flexiBatch,
      student: student
    });

  } catch (error) {
    console.error('Set Flexi Schedule Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save flexi-batch schedule: ' + error.message
    });
  }
};

/**
 * Get a student's flexi-batch schedule
 */
exports.getFlexiSchedule = async (req, res) => {
  try {
    const { studentId } = req.params;
    const flexiBatch = await FlexiBatch.findOne({ studentId });

    if (!flexiBatch) {
      return res.status(404).json({
        success: false,
        error: 'No flexi-batch schedule found for this student.'
      });
    }

    res.json({
      success: true,
      data: flexiBatch
    });
  } catch (error) {
    console.error('Get Flexi Schedule Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flexi-batch schedule.'
    });
  }
};

/**
 * Get all flexi-batch students (admin)
 */
exports.getAllFlexiBatches = async (req, res) => {
  try {
    const { status, classType, page = 1, limit = 50 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (classType) query.classType = classType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [flexiBatches, total] = await Promise.all([
      FlexiBatch.find(query)
        .populate('studentId', 'childName parentName contact1 email enrollmentId classType paymentStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FlexiBatch.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: flexiBatches,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get All Flexi Batches Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flexi-batches.'
    });
  }
};

/**
 * Update flexi-batch status
 */
exports.updateFlexiBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const flexiBatch = await FlexiBatch.findById(id);
    if (!flexiBatch) {
      return res.status(404).json({
        success: false,
        error: 'Flexi-batch not found'
      });
    }

    flexiBatch.status = status || flexiBatch.status;
    if (notes !== undefined) flexiBatch.notes = notes;
    flexiBatch.updatedAt = new Date();
    await flexiBatch.save();

    // Update student status if needed
    if (status === 'cancelled' || status === 'completed') {
      await Student.findByIdAndUpdate(flexiBatch.studentId, {
        enrollmentStatus: status === 'cancelled' ? 'withdrawn' : 'completed'
      });
    }

    res.json({
      success: true,
      message: 'Flexi-batch status updated successfully.',
      data: flexiBatch
    });
  } catch (error) {
    console.error('Update Flexi Batch Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update flexi-batch status.'
    });
  }
};

/**
 * Delete flexi-batch
 */
exports.deleteFlexiBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const flexiBatch = await FlexiBatch.findByIdAndDelete(id);

    if (!flexiBatch) {
      return res.status(404).json({
        success: false,
        error: 'Flexi-batch not found'
      });
    }

    // Update student
    await Student.findByIdAndUpdate(flexiBatch.studentId, {
      isFlexiBatch: false,
      flexiBatchId: null,
      enrollmentStatus: 'active'
    });

    res.json({
      success: true,
      message: 'Flexi-batch deleted successfully.'
    });
  } catch (error) {
    console.error('Delete Flexi Batch Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete flexi-batch.'
    });
  }
};
