const mongoose = require('mongoose');

const compensationRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  batchType: {
    type: String, // 'offline' or 'online'
    required: true
  },
  dayId: {
    type: String, // e.g. 'monfri'
    required: true
  },
  time: {
    type: String, // e.g. '4:00–5:00 PM'
    required: true
  },
  status: {
    type: String,
    enum: ['Booked', 'Attended', 'Missed'],
    default: 'Booked'
  },
  bookedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CompensationRecord', compensationRecordSchema);
