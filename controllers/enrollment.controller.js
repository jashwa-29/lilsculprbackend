const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Student = require('../models/student.model');
const Batch = require('../models/Batch.model');
const Config = require('../models/config.model');
const FeeRecord = require('../models/FeeRecord.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const CompensationRecord = require('../models/CompensationRecord.model');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send welcome email to parents
 */
const sendWelcomeEmail = async (student) => {
  if (!student.email) return;

  const mailOptions = {
    from: `Lil Sculpr <${process.env.EMAIL_FROM}>`,
    to: student.email,
    subject: 'Welcome to Lil Sculpr Clay Modelling Academy! 🎉',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h2>Welcome to Lil Sculpr!</h2>
        <p>Dear ${student.parentName},</p>
        <p>We have successfully received the enrollment for <strong>${student.childName}</strong>.</p>
        <p><strong>Enrollment ID:</strong> ${student.enrollmentId}</p>
        <p><strong>Payment ID:</strong> ${student.razorpayPaymentId}</p>
        <p><strong>Class Type:</strong> ${student.classType === 'offline' ? 'Offline (Chennai)' : 'Online (Live)'}</p>
        <p><strong>Batch:</strong> ${student.dayId} - ${student.time}</p>
        <p><strong>Payment Details:</strong> ₹${student.amountPaid} (Includes First Month Fee${student.kitOptIn ? ' + Enrollment Kit' : ''})</p>
        ${student.paymentStatus === 'Pending' ? '<p style="color: #e67e22;"><strong>⚠️ Payment Status: Pending</strong> - Please complete payment within 24 hours.</p>' : ''}
        <p>Our team will reach out to you on WhatsApp within 24 hours to confirm the slot and share further details.</p>
        <br>
        <p>Warm Regards,</p>
        <p><strong>Lil Sculpr Academy</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

/**
 * Generates a unique enrollment ID
 */
const generateEnrollmentId = async () => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  
  const count = await Student.countDocuments({
    createdAt: { $gte: startOfYear, $lte: endOfYear }
  });
  
  const sequence = (count + 1).toString().padStart(3, '0');
  return `LS-${year}-${sequence}`;
};

/**
 * Helper: Get current month/year string
 */
const getCurrentMonthYear = () => {
  const d = new Date();
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

/**
 * Helper: Auto-create fee record for first month
 */
const createFirstMonthFeeRecord = async (student) => {
  const monthYear = getCurrentMonthYear();
  const [month, year] = monthYear.split(' ');
  
  // Determine base fee
  const baseFee = student.classType === 'offline' ? 2500 : 2200;
  const totalAmount = student.kitOptIn ? baseFee + 2000 : baseFee;
  
  // Check if fee record already exists
  const existing = await FeeRecord.findOne({
    studentId: student._id,
    month,
    year: Number(year)
  });
  
  if (!existing) {
    // ═══ FIX: Use student.paymentStatus to determine the initial status ═══
    // If paymentStatus is 'Completed', the first month should be marked as 'Paid'
    const isPaid = student.paymentStatus === 'Completed';
    
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
      status: isPaid ? 'Paid' : 'Pending',
      paymentMethod: isPaid ? (student.paymentMethod || 'Razorpay') : null,
      paidAt: isPaid ? new Date() : null,
      notes: isPaid 
        ? 'First month fee paid via enrollment' 
        : 'First month fee pending - will be collected later'
    });
    await feeRecord.save();
    console.log(`✅ First month fee record created for ${student.childName}: ${month} ${year} (${isPaid ? 'Paid' : 'Pending'})`);
  } else {
    // ═══ FIX: If fee record exists but is pending and student payment is completed, update it ═══
    if (existing.status === 'Pending' && student.paymentStatus === 'Completed') {
      existing.status = 'Paid';
      existing.paymentMethod = student.paymentMethod || 'Razorpay';
      existing.paidAt = new Date();
      existing.notes = 'First month fee paid via enrollment (updated)';
      await existing.save();
      console.log(`✅ Updated fee record for ${student.childName} from Pending to Paid`);
    }
  }
};

/**
 * Sync a student's admission payment status with their fee records
 * This ensures that if a student's paymentStatus is 'Completed', 
 * their current month's fee record is also marked as 'Paid'
 */
const syncPaymentStatusWithFeeRecords = async (student) => {
  if (student.paymentStatus !== 'Completed') return;

  const now = new Date();
  const currentMonth = now.toLocaleString('en-IN', { month: 'long' });
  const currentYear = now.getFullYear();

  // ─── Helper: ensure a paid fee record exists for a given month/year ───
  const ensurePaidRecord = async (month, year) => {
    const existing = await FeeRecord.findOne({ studentId: student._id, month, year });
    if (!existing) {
      const baseFee = student.classType === 'offline' ? 2500 : 2200;
      const totalAmount = student.kitOptIn ? baseFee + 2000 : baseFee;
      const feeRecord = new FeeRecord({
        studentId: student._id,
        enrollmentId: student.enrollmentId,
        childName: student.childName,
        parentName: student.parentName,
        email: student.email,
        contact1: student.contact1,
        month,
        year,
        amount: totalAmount,
        status: 'Paid',
        paymentMethod: student.paymentMethod || 'Razorpay',
        paidAt: new Date(),
        notes: `First month fee paid via enrollment (${student.enrollmentId || 'Manual'})`
      });
      await feeRecord.save();
      console.log(`✅ Synced fee record for ${student.childName}: ${month} ${year} (Paid)`);
    } else if (existing.status === 'Pending') {
      existing.status = 'Paid';
      existing.paymentMethod = student.paymentMethod || 'Razorpay';
      existing.paidAt = new Date();
      existing.notes = `Marked as Paid based on admission payment (${student.enrollmentId || 'Manual'})`;
      await existing.save();
      console.log(`✅ Updated fee record for ${student.childName}: ${month} ${year} (Pending → Paid)`);
    }
  };

  // Always sync the current month
  await ensurePaidRecord(currentMonth, currentYear);

  // Also sync the enrollment month if it differs from current month
  // (covers students whose feeStartMonth was set to a prior month)
  if (student.feeStartMonth) {
    const parts = student.feeStartMonth.split(' '); // e.g. "July 2026"
    if (parts.length === 2) {
      const enrollMonth = parts[0];
      const enrollYear = parseInt(parts[1]);
      if (!isNaN(enrollYear) && (enrollMonth !== currentMonth || enrollYear !== currentYear)) {
        await ensurePaidRecord(enrollMonth, enrollYear);
      }
    }
  }
};

/**
 * POST /api/enrollment/create-order
 * Create a Razorpay order
 * UPDATED: Accepts batchId and validates batch capacity before creating order
 */
exports.createOrder = async (req, res) => {
  try {
    const { classType, kitOptIn, batchId } = req.body;
    
    if (!classType) {
      return res.status(400).json({ success: false, error: 'classType is required' });
    }

    // ═══ Validate batch if batchId provided ═══
    let batch = null;
    if (batchId) {
      batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(400).json({ success: false, error: 'Invalid batch ID. Please select a valid batch.' });
      }
      if (batch.enrolledStudents.length >= batch.capacity) {
        return res.status(400).json({ success: false, error: 'This batch is full. Please select another time slot.' });
      }
    }

    let amount = classType === 'offline' ? 2500 : 2200;
    if (kitOptIn) { amount += 2000; }
    // ⚠️ TEST MODE (uncomment to test with ₹1):
    // let amount = 1;

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ 
      success: true, 
      order, 
      amount, 
      key_id: process.env.RAZORPAY_KEY_ID,
      batch: batch ? { id: batch._id, type: batch.type, dayId: batch.dayId, time: batch.time } : null
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
};

/**
 * POST /api/enrollment/submit
 * Handles form submission after payment
 * UPDATED: Accepts batchId, links student to batch document, adds student to batch's enrolledStudents
 */
exports.submitEnrollment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      childName,
      childAge,
      dateOfBirth,
      childClass,
      schoolName,
      parentName,
      contact1,
      contact2,
      email,
      classType,
      dayId,
      time,
      slotKey,
      kitOptIn,
      amountPaid,
      batchId // ← CRITICAL: Accept batchId from frontend
    } = req.body;

    // Validate Signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + '|' + razorpayPaymentId)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Process Photo
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Child photograph is required' });
    }
    const photoUrl = `/uploads/${req.file.filename}`;

    const enrollmentId = await generateEnrollmentId();
    const currentMonthYear = getCurrentMonthYear();

    let ageString = childAge || '—';
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const age = new Date().getFullYear() - dob.getFullYear();
      ageString = `${age} years`;
    }

    // ═══ CRITICAL: Find or create batch ═══
    let batchDoc = null;
    if (batchId) {
      batchDoc = await Batch.findById(batchId);
      if (!batchDoc) {
        return res.status(400).json({ success: false, error: 'Invalid batch ID provided' });
      }
    } else {
      // Fallback: find by classType + dayId + time
      batchDoc = await Batch.findOne({ type: classType, dayId, time, status: { $in: ['active', 'filling'] } });
      if (!batchDoc) {
        // Auto-create if missing (safety net)
        batchDoc = new Batch({ type: classType, dayId, time, capacity: 8, status: 'active', instructor: 'Admin' });
        await batchDoc.save();
        console.log(`✅ Auto-created batch: ${classType}|${dayId}|${time}`);
      }
    }

    // Check batch capacity
    if (batchDoc.enrolledStudents.length >= batchDoc.capacity) {
      return res.status(400).json({ success: false, error: 'This batch is full. Please select another time slot.' });
    }

    const student = new Student({
      enrollmentId,
      childName,
      childAge: ageString,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      childClass,
      schoolName,
      parentName,
      contact1,
      contact2,
      email,
      classType,
      dayId,
      time,
      slotKey,
      kitOptIn: kitOptIn === 'true' || kitOptIn === true,
      photoUrl,
      paymentStatus: 'Completed',
      paymentMethod: 'Razorpay',
      razorpayOrderId,
      razorpayPaymentId,
      amountPaid: Number(amountPaid),
      feeCoverage: 'first_month',
      feeStartMonth: currentMonthYear,
      feeStartDate: new Date(),
      status: 'active',
      enrollmentStatus: 'pending',
      currentLevel: 0,
      levelHistory: [],
      levelStartedAt: null,
      // ═══ CRITICAL: Link student to batch ═══
      batchId: batchDoc._id,
      batchJoinedDate: new Date()
    });

    await student.save();

    // ═══ Add student to batch's enrolledStudents list ═══
    await Batch.findByIdAndUpdate(batchDoc._id, {
      $addToSet: { enrolledStudents: student._id }
    });
    
    await createFirstMonthFeeRecord(student);
    await syncPaymentStatusWithFeeRecords(student);
    sendWelcomeEmail(student);

    res.status(201).json({ 
      success: true, 
      student,
      batch: { id: batchDoc._id, type: batchDoc.type, dayId: batchDoc.dayId, time: batchDoc.time },
      message: 'Enrollment successful! Student is ready to start their level journey.'
    });
  } catch (error) {
    console.error('Submit Enrollment Error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit enrollment' });
  }
};

/**
 * POST /api/enrollment/manual
 * Admin-only: Manually enroll a student with offline payment
 */
exports.manualEnrollment = async (req, res) => {
  try {
    const {
      childName, childAge, dateOfBirth, childClass, schoolName,
      parentName, contact1, contact2, email,
      classType, dayId, time, slotKey,
      kitOptIn, amountPaid, offlinePaymentRef,
      paymentMethod,
      paymentStatus,
      currentLevel // Allow admin to set initial level
    } = req.body;

    // Basic validation
    if (!childName || !parentName || !contact1 || !classType || !dayId || !time || !slotKey) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Photo is optional for manual entry
    let photoUrl = '';
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const enrollmentId = await generateEnrollmentId();

    // Look up the matching batch
    let batchDoc = null;
    const batchIdFromBody = req.body.batchId;
    if (batchIdFromBody) {
      batchDoc = await Batch.findById(batchIdFromBody);
    } else {
      batchDoc = await Batch.findOne({ type: classType, dayId, time, status: { $in: ['active', 'filling'] } });
    }

    if (!batchDoc) {
      return res.status(400).json({
        success: false,
        error: `Invalid batch slot: No active batch found for ${classType} / ${dayId} / ${time}.`
      });
    }

    const isPaid = paymentStatus === 'completed' || paymentStatus === 'Paid';
    const finalPaymentStatus = isPaid ? 'Completed' : 'Pending';
    const paymentMethodValue = paymentMethod || 'Cash';
    
    const paymentRef = offlinePaymentRef || (isPaid ? `PAID-${Date.now()}` : `PENDING-${Date.now()}`);
    const paymentId = isPaid ? paymentRef : `PENDING-${Date.now()}`;

    const currentMonthYear = getCurrentMonthYear();
    
    // Use provided level or default to 0 (newbie)
    const studentLevel = parseInt(currentLevel) || 0;
    
    // If level is set to 0, enrollmentStatus should be 'pending'
    // If level > 0, enrollmentStatus should be 'active'
    const enrollmentStatus = studentLevel > 0 ? 'active' : 'pending';
    
    let levelHistory = [];
    let levelStartedAt = null;

    if (studentLevel > 0) {
      // Generate history for ALL levels up to the current level
      for (let i = 1; i <= studentLevel; i++) {
        levelHistory.push({
          level: i,
          startedDate: i === 1 ? new Date() : new Date(), // Could use creation date
          completedDate: i === studentLevel ? null : new Date(),
          certificateIssued: false
        });
      }
      levelStartedAt = new Date();
    }

    // Calculate age from dateOfBirth if provided
    let ageString = childAge || '—';
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const age = new Date().getFullYear() - dob.getFullYear();
      ageString = `${age} years`;
    }

    const student = new Student({
      enrollmentId,
      childName,
      childAge: ageString,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      childClass: childClass || '—',
      schoolName: schoolName || '—',
      parentName,
      contact1,
      contact2: contact2 || '—',
      email: email || '',
      classType,
      dayId,
      time,
      slotKey,
      kitOptIn: kitOptIn === 'true' || kitOptIn === true,
      photoUrl,
      paymentStatus: finalPaymentStatus,
      paymentMethod: paymentMethodValue,
      razorpayOrderId: null,
      razorpayPaymentId: paymentId,
      amountPaid: Number(amountPaid) || 0,
      feeCoverage: isPaid ? 'first_month' : 'pending_first_month',
      feeStartMonth: currentMonthYear,
      feeStartDate: new Date(),
      status: 'active',
      enrollmentStatus: enrollmentStatus,
      batchId: batchDoc._id,
      currentLevel: studentLevel,
      levelHistory: levelHistory,
      levelStartedAt: levelStartedAt,
      batchJoinedDate: new Date()
    });

    await student.save();

    // Add student to batch
    if (batchDoc) {
      await Batch.findByIdAndUpdate(batchDoc._id, {
        $addToSet: { enrolledStudents: student._id }
      });
    }

    await createFirstMonthFeeRecord(student);
    await syncPaymentStatusWithFeeRecords(student);

    if (email) sendWelcomeEmail(student);

    const statusMsg = studentLevel > 0
      ? `Student enrolled at Level ${studentLevel}!`
      : 'Student enrolled as a newbie (Level 0). Please start their level journey when ready.';

    res.status(201).json({ 
      success: true, 
      student,
      message: statusMsg,
      paymentStatus: finalPaymentStatus,
      currentLevel: studentLevel,
      levelStarted: studentLevel > 0
    });
  } catch (error) {
    console.error('Manual Enrollment Error:', error);
    res.status(500).json({ success: false, error: 'Failed to save manual enrollment: ' + error.message });
  }
};

/**
 * GET /api/enrollment/students
 * Fetch all students
 */
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    console.error('Get Students Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
};

/**
 * PUT /api/enrollment/students/:id
 * Update student
 */
exports.updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
};

/**
 * PUT /api/enrollment/students/:id
 * Update student - Generic update
 */
exports.updateStudent = async (req, res) => {
  try {
    const updates = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    
    // If payment status was updated to Completed, update fee record
    if (updates.paymentStatus === 'Completed' && student.feeCoverage === 'pending_first_month') {
      student.feeCoverage = 'first_month';
      await student.save();
      
      await syncPaymentStatusWithFeeRecords(student);
    }
    
    res.json({ success: true, student });
  } catch (error) {
    console.error('Update Student Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
};

/**
 * DELETE /api/enrollment/students/:id
 * Delete a student
 */
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
};

/**
 * GET /api/enrollment/batches
 * Fetch batches configuration and dynamic slot counts
 */
exports.getBatches = async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'BATCHES' });
    if (!config) {
      const defaultBatches = {
        offline: {
            label: "Offline",
            days: [
                { id: "monfri", label: "Monday & Friday", slots: ["3:00–4:00 PM", "4:00–5:00 PM", "5:00–6:00 PM", "6:00–7:00 PM"] },
                { id: "tuethu", label: "Tuesday & Thursday", slots: ["3:00–4:00 PM", "4:00–5:00 PM", "5:00–6:00 PM", "6:00–7:00 PM"] },
                { id: "satsu", label: "Saturday & Sunday", slots: ["10:00–11:00 AM", "11:00 AM–12:00 PM", "12:00–1:00 PM", "2:00–3:00 PM", "3:00–4:00 PM", "4:00–5:00 PM"] }
            ]
        },
        online: {
            label: "Online",
            days: [
                { id: "monfri", label: "Monday & Friday", slots: ["4:00–5:00 PM"] },
                { id: "tuethu", label: "Tuesday & Thursday", slots: ["4:00–5:00 PM"] },
                { id: "satsu", label: "Saturday & Sunday", slots: ["4:00–5:00 PM"] }
            ]
        }
      };
      config = new Config({ key: 'BATCHES', value: defaultBatches });
      await config.save();
    }

    const students = await Student.find({ status: { $ne: 'cancelled' } }, 'slotKey');
    const slotCounts = {};
    students.forEach(s => {
      if (s.slotKey) {
        slotCounts[s.slotKey] = (slotCounts[s.slotKey] || 0) + 1;
      }
    });

    res.json({ 
      success: true, 
      batches: config.value,
      slotCounts: slotCounts,
      maxPerSlot: 8 
    });
  } catch (error) {
    console.error('Get Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batches configuration' });
  }
};

/**
 * PUT /api/enrollment/batches
 * Update batches configuration
 */
exports.updateBatches = async (req, res) => {
  try {
    const { batches } = req.body;
    if (!batches) return res.status(400).json({ success: false, error: 'Batches data is required' });

    let config = await Config.findOne({ key: 'BATCHES' });
    if (!config) {
      config = new Config({ key: 'BATCHES', value: batches });
    } else {
      config.value = batches;
    }
    await config.save();

    res.json({ success: true, batches: config.value, message: 'Batches updated successfully' });
  } catch (error) {
    console.error('Update Batches Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update batches configuration' });
  }
};

/**
 * GET /api/enrollment/students/:id/fees
 * Fetch all fee records for a specific student
 */
exports.getStudentFees = async (req, res) => {
  try {
    const fees = await FeeRecord.find({ studentId: req.params.id }).sort({ year: 1, month: 1 });
    res.json({ success: true, fees });
  } catch (error) {
    console.error('Get Student Fees Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fee records' });
  }
};

/**
 * POST /api/enrollment/students/:id/fees
 * Create or update a fee record for a specific month/year
 */
exports.upsertStudentFee = async (req, res) => {
  try {
    const { month, year, amount, status, paymentMethod, notes } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, error: 'Month and year are required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const feeData = {
      studentId: student._id,
      enrollmentId: student.enrollmentId,
      childName: student.childName,
      parentName: student.parentName,
      email: student.email,
      contact1: student.contact1,
      month,
      year: Number(year),
      amount: Number(amount) || 0,
      status: status || 'Pending',
      paymentMethod: paymentMethod || null,
      notes: notes || '',
      paidAt: status === 'Paid' ? new Date() : null
    };

    const fee = await FeeRecord.findOneAndUpdate(
      { studentId: student._id, month, year: Number(year) },
      { $set: feeData },
      { upsert: true, new: true }
    );

    if (status === 'Paid' && student.feeCoverage === 'pending_first_month') {
      const currentMonthYear = getCurrentMonthYear();
      const [currentMonth, currentYear] = currentMonthYear.split(' ');
      if (month === currentMonth && Number(year) === Number(currentYear)) {
        student.feeCoverage = 'first_month';
        await student.save();
      }
    }

    res.json({ success: true, fee });
  } catch (error) {
    console.error('Upsert Student Fee Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update fee record' });
  }
};

/**
 * GET /api/enrollment/fees/overview
 * Get revenue summary across all fee records (for admin dashboard)
 */
exports.getFeesOverview = async (req, res) => {
  try {
    const [paidFees, pendingFees] = await Promise.all([
      FeeRecord.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      FeeRecord.aggregate([
        { $match: { status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);
    res.json({
      success: true,
      paid: { total: paidFees[0]?.total || 0, count: paidFees[0]?.count || 0 },
      pending: { total: pendingFees[0]?.total || 0, count: pendingFees[0]?.count || 0 }
    });
  } catch (error) {
    console.error('Get Fees Overview Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fees overview' });
  }
};

/**
 * GET /api/enrollment/fees/month/:month/:year
 * Get all fee records for a specific month and year
 */
exports.getAllFeesForMonth = async (req, res) => {
  try {
    const { month, year } = req.params;
    const fees = await FeeRecord.find({ month, year: Number(year) });
    res.json({ success: true, fees });
  } catch (error) {
    console.error('Get All Fees For Month Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fees for the month' });
  }
};

/**
 * GET /api/enrollment/attendance
 * Get attendance records for a range of dates
 */
exports.getAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }
    const attendance = await AttendanceRecord.find(query);
    res.json({ success: true, attendance });
  } catch (error) {
    console.error('Get Attendance Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
  }
};

/**
 * POST /api/enrollment/attendance
 * Enhanced: Automatically generates Compensation Tokens for absent students
 * with 30-day expiry
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Records array is required' 
      });
    }

    const bulkOps = [];
    const tokensToCreate = [];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    for (const record of records) {
      if (record.status === 'none') {
        bulkOps.push({
          deleteOne: {
            filter: { studentId: record.studentId, date: record.date }
          }
        });
        continue;
      }

      if (record.status === 'A') {
        const CompensationToken = require('../models/CompensationToken.model');
        const existingToken = await CompensationToken.findOne({
          studentId: record.studentId,
          generatedDate: new Date(record.date),
          status: { $in: ['available', 'used'] }
        });

        if (!existingToken) {
          const token = new CompensationToken({
            studentId: record.studentId,
            generatedDate: new Date(record.date),
            status: 'available',
            reason: 'absence',
            expiryDate: thirtyDaysFromNow,
            notes: `Auto-generated from attendance on ${record.date}`
          });
          await token.save();
          tokensToCreate.push(token);
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { studentId: record.studentId, date: record.date },
          update: { 
            $set: { 
              status: record.status,
              compensationTokenGenerated: record.status === 'A' 
            } 
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      await AttendanceRecord.bulkWrite(bulkOps);
    }
    
    res.json({ 
      success: true, 
      message: 'Attendance updated successfully',
      tokensGenerated: tokensToCreate.length 
    });
  } catch (error) {
    console.error('Update Attendance Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update attendance' 
    });
  }
};

/**
 * GET /api/enrollment/compensations
 * Get compensation records for a range of dates
 */
exports.getCompensations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }
    const compensations = await CompensationRecord.find(query).populate('studentId', 'childName parentName');
    res.json({ success: true, compensations });
  } catch (error) {
    console.error('Get Compensations Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch compensations' });
  }
};

/**
 * PUT /api/enrollment/compensations/:id
 * Update compensation status (Attended/Missed)
 */
exports.updateCompensationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const compensation = await CompensationRecord.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!compensation) return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, compensation });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update compensation status' });
  }
};

/**
 * GET /api/enrollment/compensations/admin
 * Get all compensation records with full details (admin view)
 */
exports.getAllCompensationsAdmin = async (req, res) => {
  try {
    const { startDate, endDate, status, batchType, page = 1, limit = 50 } = req.query;
    const CompensationToken = require('../models/CompensationToken.model');

    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    }
    if (status) query.status = status;
    if (batchType) query.batchType = batchType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      CompensationRecord.find(query)
        .populate('studentId', 'childName parentName contact1 email enrollmentId')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CompensationRecord.countDocuments(query)
    ]);

    const recordsWithStats = records.map(record => {
      const recordObj = record.toObject();
      return {
        ...recordObj,
        tokenDetails: null
      };
    });

    res.json({
      success: true,
      data: recordsWithStats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get All Compensations Admin Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compensation records'
    });
  }
};

/**
 * GET /api/enrollment/compensations/stats
 * Get compensation statistics
 */
exports.getCompensationStats = async (req, res) => {
  try {
    const CompensationToken = require('../models/CompensationToken.model');
    const [total, booked, attended, missed, tokenStats] = await Promise.all([
      CompensationRecord.countDocuments(),
      CompensationRecord.countDocuments({ status: 'Booked' }),
      CompensationRecord.countDocuments({ status: 'Attended' }),
      CompensationRecord.countDocuments({ status: 'Missed' }),
      CompensationToken.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const monthlyTrends = await CompensationRecord.aggregate([
      {
        $group: {
          _id: {
            year: { $year: { $dateFromString: { dateString: '$date' } } },
            month: { $month: { $dateFromString: { dateString: '$date' } } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    const byBatchType = await CompensationRecord.aggregate([
      {
        $group: {
          _id: '$batchType',
          count: { $sum: 1 },
          attended: {
            $sum: { $cond: [{ $eq: ['$status', 'Attended'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        total,
        booked,
        attended,
        missed,
        tokenStats: tokenStats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        monthlyTrends: monthlyTrends.map(t => ({
          month: `${t._id.month}/${t._id.year}`,
          count: t.count
        })),
        byBatchType: byBatchType.map(b => ({
          type: b._id || 'unknown',
          total: b.count,
          attended: b.attended,
          rate: b.count > 0 ? Math.round((b.attended / b.count) * 100) : 0
        }))
      }
    });

  } catch (error) {
    console.error('Get Compensation Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compensation statistics'
    });
  }
};

/**
 * PUT /api/enrollment/students/:id/level
 * Admin-only: Update a student's current level
 */
exports.updateStudentLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { level } = req.body;

    if (!level || level < 1 || level > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid level (1-12) is required.' 
      });
    }

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    if (student.currentLevel === level) {
      return res.json({ success: true, message: 'Student is already at this level', student });
    }

    student.currentLevel = level;
    student.levelHistory.push({ level, completedDate: new Date() });
    await student.save();

    res.json({ 
      success: true, 
      message: `Level updated to ${level} for ${student.childName}`,
      student 
    });
  } catch (error) {
    console.error('Update Student Level Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student level' });
  }
};