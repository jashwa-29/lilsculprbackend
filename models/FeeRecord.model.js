const mongoose = require('mongoose');

const feeRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  enrollmentId: {
    type: String,
    required: true
  },
  childName: {
    type: String,
    required: true
  },
  parentName: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  contact1: {
    type: String
  },
  month: {
    type: String,
    required: true  // e.g. 'July'
  },
  year: {
    type: Number,
    required: true  // e.g. 2026
  },
  amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Other'],
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate records per student per month/year
feeRecordSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
