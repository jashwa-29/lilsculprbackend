const mongoose = require('mongoose');

const compensationRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  parentName: {
    type: String,
    required: true
  },
  childName: {
    type: String,
    required: true
  },
  contact1: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true
  },
  // Requested class details
  requestedDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  requestedBatchType: {
    type: String,
    enum: ['offline', 'online'],
    required: true
  },
  requestedDayId: {
    type: String,
    required: true
  },
  requestedTime: {
    type: String,
    required: true
  },
  // Reason for absence
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  // Admin response
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  // Admin notes
  adminNotes: {
    type: String,
    trim: true,
    default: ''
  },
  // If accepted, link to the compensation record
  compensationRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompensationRecord',
    default: null
  },
  // If rejected, reason for rejection
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  // Admin who processed the request
  processedBy: {
    type: String,
    trim: true,
    default: ''
  },
  processedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes
compensationRequestSchema.index({ studentId: 1, status: 1 });
compensationRequestSchema.index({ status: 1, createdAt: 1 });
compensationRequestSchema.index({ requestedDate: 1 });

module.exports = mongoose.model('CompensationRequest', compensationRequestSchema);
