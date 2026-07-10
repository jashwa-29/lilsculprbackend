const Student = require('../models/student.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const FeeRecord = require('../models/FeeRecord.model');
const CompensationRecord = require('../models/CompensationRecord.model');
const CompensationToken = require('../models/CompensationToken.model');
const Batch = require('../models/Batch.model');
const Config = require('../models/config.model');

// Login parent using Enrollment ID and Contact Number
exports.login = async (req, res) => {
  try {
    const { enrollmentId, contact1 } = req.body;
    if (!enrollmentId || !contact1) {
      return res.status(400).json({ success: false, error: 'Enrollment ID and Contact Number are required' });
    }

    // Normalize to uppercase to match the pre-save hook on the Student model
    const normalizedId = enrollmentId.toUpperCase().trim();

    const student = await Student.findOne({ 
      enrollmentId: normalizedId,
      contact1: contact1.trim()
    });

    if (!student) {
      return res.status(401).json({ success: false, error: 'Invalid Enrollment ID or Contact Number' });
    }

    res.json({ success: true, studentId: student._id });
  } catch (error) {
    console.error('Portal Login Error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

/**
 * GET /api/portal/dashboard/:id
 * Updated to use CompensationToken model for accurate token counting
 * with 30-day expiry validation
 */
exports.getDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ 
      success: false, 
      error: 'Student not found' 
    });

    const attendance = await AttendanceRecord.find({ studentId: id }).sort({ date: -1 });
    const fees = await FeeRecord.find({ studentId: id }).sort({ year: -1, month: -1 });
    const compensations = await CompensationRecord.find({ studentId: id }).sort({ date: -1 });

    // Get token count from CompensationToken collection with expiry check
    const now = new Date();
    const availableTokens = await CompensationToken.countDocuments({
      studentId: id,
      status: 'available',
      expiryDate: { $gt: now }
    });

    // Auto-expire tokens that are past expiry
    await CompensationToken.updateMany(
      {
        studentId: id,
        status: 'available',
        expiryDate: { $lte: now }
      },
      { $set: { status: 'expired' } }
    );

    const usedTokens = await CompensationToken.countDocuments({
      studentId: id,
      status: 'used'
    });

    const expiredTokens = await CompensationToken.countDocuments({
      studentId: id,
      status: 'expired'
    });

    res.json({
      success: true,
      student,
      attendance,
      fees,
      compensations,
      tokens: {
        available: availableTokens,
        used: usedTokens,
        expired: expiredTokens,
        total: availableTokens + usedTokens + expiredTokens
      }
    });
  } catch (error) {
    console.error('Portal Dashboard Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard data' 
    });
  }
};

// Get available batches for make-up classes
exports.getAvailableBatches = async (req, res) => {
  try {
    // Capacity is for REGULAR enrolled students only.
    // Compensation bookings are extra and do not consume regular seats.
    const batches = await Batch.find({ status: { $in: ['active', 'filling'] } });

    const dayLabels = {
      monfri: 'Monday & Friday',
      tuethu: 'Tuesday & Thursday',
      satsu:  'Saturday & Sunday'
    };

    const availableSlots = batches
      .map(b => ({
        batch: b,
        seatsLeft: b.capacity - b.enrolledStudents.length // regular students only
      }))
      .filter(({ seatsLeft }) => seatsLeft > 0)
      .map(({ batch: b, seatsLeft }) => ({
        batchId: b._id,
        type: b.type,
        dayId: b.dayId,
        dayLabel: dayLabels[b.dayId] || b.dayId,
        time: b.time,
        seatsLeft
      }));

    res.json({ success: true, availableSlots });
  } catch (error) {
    console.error('Get Available Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available batches' });
  }
};

/**
 * POST /api/portal/book-compensation
 * Compensation classes are EXTRA sessions on top of regular students.
 * They do NOT consume regular seats — capacity is for enrolled students only.
 * Guards:
 *   - Batch must exist and be active/filling
 *   - Regular student seats must not be full (protects existing students)
 *   - Student must have a valid, unexpired token (FIFO)
 */
exports.bookCompensation = async (req, res) => {
  try {
    const { studentId, date, batchType, dayId, time } = req.body;
    
    if (!studentId || !date || !batchType || !dayId || !time) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // ─── STEP 1: Verify the target batch exists and is open ───────────────
    const targetBatch = await Batch.findOne({
      type: batchType,
      dayId,
      time,
      status: { $in: ['active', 'filling'] }
    });

    if (!targetBatch) {
      return res.status(404).json({
        success: false,
        error: 'The selected batch slot does not exist or is not currently active.'
      });
    }

    // ─── STEP 2: Guard regular-student capacity only ──────────────────────
    // Compensation students are extras — they do NOT count against capacity.
    // We only block if ALL regular seats are taken (to protect enrolled students).
    if (targetBatch.enrolledStudents.length >= targetBatch.capacity) {
      return res.status(409).json({
        success: false,
        error: 'This batch is full with regular students. Please select another slot.'
      });
    }

    // ─── STEP 3: Find oldest available token (FIFO) that hasn't expired ───
    const token = await CompensationToken.findOne({
      studentId,
      status: 'available',
      expiryDate: { $gt: new Date() }
    }).sort({ generatedDate: 1 }); // FIFO: use oldest token first

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'No available compensation tokens. Please contact the academy.' 
      });
    }

    // ─── STEP 4: Create compensation record and consume the token ─────────
    const record = new CompensationRecord({
      studentId,
      date,
      batchType,
      dayId,
      time,
      status: 'Booked',
      tokenUsed: token._id
    });

    await record.save();

    token.status = 'used';
    token.consumedBy = record._id;
    token.consumedAt = new Date();
    await token.save();

    res.json({ 
      success: true, 
      record, 
      token, 
      message: 'Make-up class booked successfully' 
    });
  } catch (error) {
    console.error('Book Compensation Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to book make-up class' 
    });
  }
};

/**
 * GET /api/portal/tokens/:id
 * New endpoint to get detailed token information
 */
exports.getTokenDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tokens = await CompensationToken.find({ studentId: id })
      .sort({ generatedDate: -1 })
      .populate('generatedFrom', 'date')
      .populate('consumedBy', 'date batchType time');
    
    const now = new Date();
    const available = tokens.filter(t => 
      t.status === 'available' && t.expiryDate > now
    );
    const expired = tokens.filter(t => 
      t.status === 'available' && t.expiryDate <= now
    );
    const used = tokens.filter(t => t.status === 'used');
    
    res.json({
      success: true,
      tokens: {
        available,
        used,
        expired,
        total: tokens.length
      }
    });
  } catch (error) {
    console.error('Get Token Details Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch token details' 
    });
  }
};

/**
 * PUT /api/portal/update-dob/:id
 * Update student's date of birth
 */
exports.updateDateOfBirth = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateOfBirth } = req.body;

    if (!dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'Date of birth is required'
      });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }
    
    if (dob > new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Date of birth cannot be in the future'
      });
    }

    // Calculate age from DOB
    const age = new Date().getFullYear() - dob.getFullYear();
    const ageString = `${age} years`;

    const student = await Student.findByIdAndUpdate(
      id,
      { 
        dateOfBirth: dob,
        childAge: ageString // Keep in sync
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Sync birthday collection
    const Birthday = require('../models/Birthday.model');
    await Birthday.findOneAndUpdate(
      { studentId: student._id },
      {
        dateOfBirth: dob,
        year: dob.getFullYear(),
        month: dob.getMonth() + 1,
        day: dob.getDate(),
        childName: student.childName,
        parentName: student.parentName,
        contact1: student.contact1,
        email: student.email
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Date of birth updated successfully',
      student: {
        dateOfBirth: student.dateOfBirth,
        childAge: student.childAge
      }
    });

  } catch (error) {
    console.error('Update DOB Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update date of birth'
    });
  }
};