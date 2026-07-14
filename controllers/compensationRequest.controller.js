const CompensationRequest = require('../models/CompensationRequest.model');
const CompensationToken = require('../models/CompensationToken.model');
const CompensationRecord = require('../models/CompensationRecord.model');
const Student = require('../models/student.model');
const emailService = require('../services/email.service');

/**
 * POST /api/compensation-requests
 * Parent submits a compensation request
 */
exports.createRequest = async (req, res) => {
  try {
    const {
      studentId,
      requestedDate,
      requestedBatchType,
      requestedDayId,
      requestedTime,
      reason
    } = req.body;

    if (!studentId || !requestedDate || !requestedBatchType || !requestedDayId || !requestedTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, requestedDate, requestedBatchType, requestedDayId, requestedTime'
      });
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student already has a pending request for this date
    const existingRequest = await CompensationRequest.findOne({
      studentId,
      requestedDate,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending compensation request for this date.'
      });
    }

    // Check if student already has a booked compensation for this date
    const existingBooking = await CompensationRecord.findOne({
      studentId,
      date: requestedDate
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: 'You already have a compensation class booked for this date.'
      });
    }

    // Create the request
    const request = new CompensationRequest({
      studentId,
      parentName: student.parentName,
      childName: student.childName,
      contact1: student.contact1,
      email: student.email,
      requestedDate,
      requestedBatchType,
      requestedDayId,
      requestedTime,
      reason: reason || '',
      status: 'pending'
    });

    await request.save();

    // Send notification to admin (via email)
    try {
      await emailService.sendCompensationRequestNotification(request, student);
    } catch (emailError) {
      console.warn('⚠️ Failed to send admin notification email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Compensation request submitted successfully. Please wait for admin approval.',
      data: request
    });

  } catch (error) {
    console.error('Create Compensation Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit compensation request: ' + error.message
    });
  }
};

/**
 * GET /api/compensation-requests
 * Admin gets all compensation requests
 */
exports.getAllRequests = async (req, res) => {
  try {
    const { status, studentId, page = 1, limit = 50 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (studentId) query.studentId = studentId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      CompensationRequest.find(query)
        .populate('studentId', 'childName parentName contact1 email enrollmentId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CompensationRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get All Compensation Requests Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compensation requests'
    });
  }
};

/**
 * GET /api/compensation-requests/stats
 * Get statistics for compensation requests
 */
exports.getRequestStats = async (req, res) => {
  try {
    const [pending, accepted, rejected] = await Promise.all([
      CompensationRequest.countDocuments({ status: 'pending' }),
      CompensationRequest.countDocuments({ status: 'accepted' }),
      CompensationRequest.countDocuments({ status: 'rejected' })
    ]);

    res.json({
      success: true,
      data: {
        pending,
        accepted,
        rejected,
        total: pending + accepted + rejected
      }
    });

  } catch (error) {
    console.error('Get Request Stats Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request statistics'
    });
  }
};

/**
 * PUT /api/compensation-requests/:id/accept
 * Admin accepts a compensation request
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, adminName } = req.body;

    const request = await CompensationRequest.findById(id)
      .populate('studentId');

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Compensation request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request is already ${request.status}. Cannot accept.`
      });
    }

    // Check if there's an available token for this student
    const availableToken = await CompensationToken.findOne({
      studentId: request.studentId._id,
      status: 'available',
      expiryDate: { $gt: new Date() }
    }).sort({ generatedDate: 1 });

    // If no token, auto-generate one (admin override)
    let token = availableToken;
    if (!token) {
      token = new CompensationToken({
        studentId: request.studentId._id,
        generatedDate: new Date(),
        status: 'available',
        reason: 'admin_granted',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: `Admin granted token for compensation request ${request._id}`
      });
      await token.save();
    }

    // Create compensation record
    const record = new CompensationRecord({
      studentId: request.studentId._id,
      date: request.requestedDate,
      batchType: request.requestedBatchType,
      dayId: request.requestedDayId,
      time: request.requestedTime,
      status: 'Booked',
      tokenUsed: token._id
    });

    await record.save();

    // Mark token as used
    token.status = 'used';
    token.consumedBy = record._id;
    token.consumedAt = new Date();
    await token.save();

    // Update request
    request.status = 'accepted';
    request.adminNotes = adminNotes || '';
    request.compensationRecordId = record._id;
    request.processedBy = adminName || 'Admin';
    request.processedAt = new Date();
    await request.save();

    // Send confirmation email to parent
    if (request.email) {
      try {
        await emailService.sendCompensationRequestAccepted(request, record);
      } catch (emailError) {
        console.warn('⚠️ Failed to send acceptance email:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: 'Compensation request accepted successfully.',
      data: {
        request,
        record,
        token
      }
    });

  } catch (error) {
    console.error('Accept Compensation Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept compensation request: ' + error.message
    });
  }
};

/**
 * PUT /api/compensation-requests/:id/reject
 * Admin rejects a compensation request
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes, adminName } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const request = await CompensationRequest.findById(id)
      .populate('studentId');

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Compensation request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request is already ${request.status}. Cannot reject.`
      });
    }

    // Update request
    request.status = 'rejected';
    request.rejectionReason = rejectionReason;
    request.adminNotes = adminNotes || '';
    request.processedBy = adminName || 'Admin';
    request.processedAt = new Date();
    await request.save();

    // Send rejection email to parent
    if (request.email) {
      try {
        await emailService.sendCompensationRequestRejected(request);
      } catch (emailError) {
        console.warn('⚠️ Failed to send rejection email:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: 'Compensation request rejected.',
      data: request
    });

  } catch (error) {
    console.error('Reject Compensation Request Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject compensation request: ' + error.message
    });
  }
};

/**
 * GET /api/compensation-requests/:id
 * Get a single compensation request
 */
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await CompensationRequest.findById(id)
      .populate('studentId')
      .populate('compensationRecordId');

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Compensation request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get Compensation Request By ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compensation request'
    });
  }
};

/**
 * GET /api/compensation-requests/student/:studentId
 * Get all requests for a specific student (for parent portal)
 */
exports.getStudentRequests = async (req, res) => {
  try {
    const { studentId } = req.params;

    const requests = await CompensationRequest.find({ studentId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Get Student Compensation Requests Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student compensation requests'
    });
  }
};
