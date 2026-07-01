const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  enrollmentId: {
    type: String,
    required: true,
    unique: true
  },
  childName: {
    type: String,
    required: true,
    trim: true
  },
  childAge: {
    type: String,
    required: true
  },
  childClass: {
    type: String,
    required: true
  },
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  parentName: {
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
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  classType: {
    type: String, // 'offline' or 'online'
    required: true
  },
  dayId: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  slotKey: {
    type: String,
    required: true
  },
  kitOptIn: {
    type: Boolean,
    default: false
  },
  photoUrl: {
    type: String, // Path to uploaded file or Cloudinary URL
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  amountPaid: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
