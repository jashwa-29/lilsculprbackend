const mongoose = require('mongoose');

const compensationTokenSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  
  // Traceability
  generatedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceRecord'
  },
  generatedDate: {
    type: Date,
    default: Date.now
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['available', 'used', 'expired'],
    default: 'available'
  },
  
  // STRICT 30-DAY EXPIRY
  expiryDate: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Usage tracking
  consumedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompensationRecord'
  },
  consumedAt: { 
    type: Date 
  },
  
  // Additional metadata
  reason: { 
    type: String, 
    enum: ['absence', 'admin_granted', 'credit_transfer'],
    default: 'absence'
  },
  notes: { 
    type: String, 
    trim: true 
  }
}, { timestamps: true });

// Optimized indexes for token queries
compensationTokenSchema.index({ studentId: 1, status: 1 });
compensationTokenSchema.index({ expiryDate: 1 });
compensationTokenSchema.index({ generatedFrom: 1 });
// Compound index for available token queries
compensationTokenSchema.index({ studentId: 1, status: 1, expiryDate: 1 });

module.exports = mongoose.model('CompensationToken', compensationTokenSchema);
