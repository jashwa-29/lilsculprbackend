const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  parentName: {
    type: String,
    required: true,
    trim: true
  },
  childName: {
    type: String,
    required: true,
    trim: true
  },
  contact1: {
    type: String,
    required: true,
    trim: true
  },
  contact2: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['waiting', 'notified', 'enrolled', 'removed'],
    default: 'waiting'
  },
  priority: {
    type: Number,
    default: 1 // 1 = highest priority
  },
  notes: {
    type: String,
    trim: true
  },
  notifiedAt: Date,
  enrolledAt: Date,
  removedAt: Date,
  removedReason: String
}, { timestamps: true });

// Compound unique index — prevents same student on same batch twice (DB-level enforcement)
waitlistSchema.index({ studentId: 1, batchId: 1 }, { unique: true });
// Indexes for performance
waitlistSchema.index({ batchId: 1, status: 1, priority: 1 });
waitlistSchema.index({ createdAt: 1 });

// Static method to get next in queue
waitlistSchema.statics.getNextInQueue = async function(batchId) {
  return await this.findOne({
    batchId,
    status: 'waiting'
  })
  .sort({ priority: 1, createdAt: 1 })
  .populate('studentId')
  .populate('batchId');
};

// Method to notify a waitlisted parent
waitlistSchema.methods.notify = async function() {
  this.status = 'notified';
  this.notifiedAt = new Date();
  await this.save();
  return this;
};

// Method to enroll a waitlisted student
waitlistSchema.methods.enroll = async function(batchId) {
  this.status = 'enrolled';
  this.enrolledAt = new Date();
  await this.save();
  
  // Update student's batch
  await mongoose.model('Student').findByIdAndUpdate(this.studentId, {
    batchId: batchId || this.batchId,
    enrollmentStatus: 'active'
  });
  
  return this;
};

module.exports = mongoose.model('Waitlist', waitlistSchema);
