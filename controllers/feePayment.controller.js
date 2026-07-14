const Student = require('../models/student.model');
const FeeRecord = require('../models/FeeRecord.model');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const { syncStudentPaymentStatus } = require('../services/syncFeeStatus.service');

// Initialize Razorpay
let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} catch (error) {
  console.warn('⚠️ Razorpay not initialized:', error.message);
}

/**
 * Get student details for fee payment
 * POST /api/fee-payment/student-details
 */
exports.getStudentForFeePayment = async (req, res) => {
  try {
    const { enrollmentId, contact1 } = req.body;

    if (!enrollmentId || !contact1) {
      return res.status(400).json({
        success: false,
        error: 'Enrollment ID and Contact Number are required'
      });
    }

    const normalizedId = enrollmentId.toUpperCase().trim();
    const student = await Student.findOne({
      enrollmentId: normalizedId,
      contact1: contact1.trim()
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found. Please check your Enrollment ID and Contact Number.'
      });
    }

    const now = new Date();
    const currentMonth = now.toLocaleString('en-IN', { month: 'long' });
    const currentYear = now.getFullYear();

    const existingFee = await FeeRecord.findOne({
      studentId: student._id,
      month: currentMonth,
      year: currentYear
    });

    const monthlyFee = student.classType === 'offline' ? 2500 : 2200;
    const amount = monthlyFee;

    const isPaid = existingFee && existingFee.status === 'Paid';

    // Get fee history for last 6 months only (performance)
    const feeHistory = await FeeRecord.find({
      studentId: student._id
    })
    .sort({ year: -1, month: -1 })
    .limit(6);

    res.json({
      success: true,
      student: {
        id: student._id,
        childName: student.childName,
        parentName: student.parentName,
        enrollmentId: student.enrollmentId,
        classType: student.classType,
        contact1: student.contact1,
        email: student.email || '',
        batch: `${student.dayId} - ${student.time}`,
        currentLevel: student.currentLevel || 0
      },
      feeDetails: {
        currentMonth,
        currentYear,
        monthlyFee: amount,
        isPaid,
        feeHistory: feeHistory.map(f => ({
          month: f.month,
          year: f.year,
          status: f.status,
          amount: f.amount,
          paidAt: f.paidAt,
          paymentMethod: f.paymentMethod
        }))
      }
    });

  } catch (error) {
    console.error('Get Student For Fee Payment Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student details. Please try again.'
    });
  }
};

/**
 * Create Razorpay order for monthly fee
 * POST /api/fee-payment/create-order
 */
exports.createFeePaymentOrder = async (req, res) => {
  try {
    const { studentId, month, year, amount } = req.body;

    if (!studentId || !month || !year || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Student ID, month, year, and amount are required'
      });
    }

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Payment service is currently unavailable. Please try again later.'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const existingFee = await FeeRecord.findOne({
      studentId,
      month,
      year: Number(year),
      status: 'Paid'
    });

    if (existingFee) {
      return res.status(400).json({
        success: false,
        error: `Fee for ${month} ${year} is already paid`
      });
    }

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `fee_${student.enrollmentId}_${month}_${year}`,
      notes: {
        studentId: studentId.toString(),
        enrollmentId: student.enrollmentId,
        childName: student.childName,
        month: month,
        year: year
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount,
      student: {
        id: student._id,
        childName: student.childName,
        enrollmentId: student.enrollmentId
      }
    });

  } catch (error) {
    console.error('Create Fee Payment Order Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
};

/**
 * Verify fee payment and update fee record
 * POST /api/fee-payment/verify
 */
exports.verifyFeePayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      studentId,
      month,
      year,
      amount,
      paymentMethod
    } = req.body;

    if (!razorpay_payment_id || !studentId || !month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment details'
      });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const existingFee = await FeeRecord.findOne({
      studentId,
      month,
      year: Number(year),
      status: 'Paid'
    });

    if (existingFee) {
      return res.json({
        success: true,
        message: `Fee for ${month} ${year} was already paid`,
        feeRecord: existingFee
      });
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
      amount: Number(amount) || (student.classType === 'offline' ? 2500 : 2200),
      status: 'Paid',
      paymentMethod: paymentMethod || 'Razorpay',
      paidAt: new Date(),
      notes: `Paid via Razorpay - ${razorpay_payment_id}`
    };

    const feeRecord = await FeeRecord.findOneAndUpdate(
      { studentId: student._id, month, year: Number(year) },
      { $set: feeData },
      { upsert: true, new: true }
    );

    // Sync the student's overall payment status
    await syncStudentPaymentStatus(studentId);

    // Send confirmation email (non-blocking)
    if (student.email) {
      emailService.sendFeePaymentConfirmation(student, feeRecord).catch(err => {
        console.warn('⚠️ Failed to send fee confirmation email:', err.message);
      });
    }

    // Update student fee coverage if first month
    const now = new Date();
    const currentMonth = now.toLocaleString('en-IN', { month: 'long' });
    const currentYear = now.getFullYear();
    if (month === currentMonth && year === currentYear && student.feeCoverage === 'pending_first_month') {
      student.feeCoverage = 'first_month';
      await student.save();
    }

    res.json({
      success: true,
      message: 'Payment verified and fee record updated',
      feeRecord,
      student: {
        childName: student.childName,
        enrollmentId: student.enrollmentId
      }
    });

  } catch (error) {
    console.error('Verify Fee Payment Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment. Please contact support.'
    });
  }
};

/**
 * Get fee payment history for a student (Admin only)
 * GET /api/fee-payment/history/:studentId
 */
exports.getFeeHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit = 12 } = req.query;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const fees = await FeeRecord.find({ studentId })
      .sort({ year: -1, month: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      student: {
        childName: student.childName,
        enrollmentId: student.enrollmentId
      },
      fees
    });

  } catch (error) {
    console.error('Get Fee History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee history'
    });
  }
};

/**
 * Get payment summary for dashboard (Admin only)
 * GET /api/fee-payment/summary
 */
exports.getPaymentSummary = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.toLocaleString('en-IN', { month: 'long' });
    const currentYear = now.getFullYear();

    const currentMonthPaid = await FeeRecord.countDocuments({
      month: currentMonth,
      year: currentYear,
      status: 'Paid'
    });
    const currentMonthPending = await FeeRecord.countDocuments({
      month: currentMonth,
      year: currentYear,
      status: 'Pending'
    });
    const currentMonthTotal = currentMonthPaid + currentMonthPending;

    const totalPaid = await FeeRecord.countDocuments({ status: 'Paid' });
    const totalPending = await FeeRecord.countDocuments({ status: 'Pending' });
    
    const totalRevenue = await FeeRecord.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyTrends = await FeeRecord.aggregate([
      {
        $group: {
          _id: { month: '$month', year: '$year' },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$amount', 0] } }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      success: true,
      summary: {
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          total: currentMonthTotal,
          paid: currentMonthPaid,
          pending: currentMonthPending,
          collectionRate: currentMonthTotal > 0 ? ((currentMonthPaid / currentMonthTotal) * 100).toFixed(1) + '%' : '0%'
        },
        allTime: {
          totalPaid,
          totalPending,
          totalRevenue: totalRevenue[0]?.total || 0
        },
        monthlyTrends
      }
    });

  } catch (error) {
    console.error('Get Payment Summary Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment summary'
    });
  }
};

/**
 * Get all fee records
 * GET /api/fee-payment/all
 */
exports.getAllFeeRecords = async (req, res) => {
  try {
    const records = await FeeRecord.find()
      .populate('studentId', 'firstName lastName enrollmentId batch')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('Get All Fee Records Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee records'
    });
  }
};

/**
 * Delete a fee record
 * DELETE /api/fee-payment/:id
 */
exports.deleteFeeRecord = async (req, res) => {
  try {
    const record = await FeeRecord.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Fee record not found'
      });
    }

    await FeeRecord.findByIdAndDelete(req.params.id);

    // Sync the student's overall payment status
    await syncStudentPaymentStatus(record.studentId);

    res.json({
      success: true,
      message: 'Fee record deleted successfully'
    });
  } catch (error) {
    console.error('Delete Fee Record Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete fee record'
    });
  }
};
