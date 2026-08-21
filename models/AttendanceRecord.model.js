const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  status: {
    type: String,
    enum: ['P', 'A', 'C', 'none'], // Present, Absent, compensation, Not Marked
    default: 'none'
  }
}, { timestamps: true });

// Ensure unique index for student and date
attendanceRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
