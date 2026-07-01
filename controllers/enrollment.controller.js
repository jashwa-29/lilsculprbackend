const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Student = require('../models/student.model');
const Config = require('../models/config.model');
const FeeRecord = require('../models/FeeRecord.model');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send welcome email to parents
 */
const sendWelcomeEmail = async (student) => {
  if (!student.email) return; // Skip if no email provided

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
 * POST /api/enrollment/create-order
 * Create a Razorpay order
 */
exports.createOrder = async (req, res) => {
  try {
    const { classType, kitOptIn } = req.body;
    
    if (!classType) {
      return res.status(400).json({ success: false, error: 'classType is required' });
    }

    let amount = classType === 'offline' ? 2500 : 2200;
    if (kitOptIn) {
      amount += 2000;
    }

    const options = {
      amount: amount * 100, // amount in smallest currency unit (paise)
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order, amount, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
};

/**
 * POST /api/enrollment/submit
 * Handles form submission after payment
 */
exports.submitEnrollment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      childName,
      childAge,
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
      amountPaid
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

    const student = new Student({
      enrollmentId,
      childName,
      childAge,
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
      razorpayOrderId,
      razorpayPaymentId,
      amountPaid: Number(amountPaid)
    });

    await student.save();
    
    // Send email asynchronously
    sendWelcomeEmail(student);

    res.status(201).json({ success: true, student });
  } catch (error) {
    console.error('Submit Enrollment Error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit enrollment' });
  }
};

/**
 * POST /api/enrollment/manual
 * Admin-only: Manually enroll a student with offline payment (no Razorpay)
 */
exports.manualEnrollment = async (req, res) => {
  try {
    const {
      childName, childAge, childClass, schoolName,
      parentName, contact1, contact2, email,
      classType, dayId, time, slotKey,
      kitOptIn, amountPaid, offlinePaymentRef
    } = req.body;

    // Basic validation
    if (!childName || !parentName || !contact1 || !classType || !dayId || !time || !slotKey) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Photo is optional for manual entry (admin may not have it)
    let photoUrl = '';
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const enrollmentId = await generateEnrollmentId();

    const student = new Student({
      enrollmentId,
      childName,
      childAge: childAge || '—',
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
      paymentStatus: 'Completed',
      razorpayOrderId: null,
      razorpayPaymentId: offlinePaymentRef ? `OFFLINE-${offlinePaymentRef}` : `OFFLINE-${Date.now()}`,
      amountPaid: Number(amountPaid) || 0,
      status: 'active'
    });

    await student.save();

    // Send welcome email if email provided
    if (email) sendWelcomeEmail(student);

    res.status(201).json({ success: true, student });
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
 * Update student status
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
      // Default batches if none exists
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

    // Compute dynamic slot capacities
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
