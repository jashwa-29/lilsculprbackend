const mongoose = require('mongoose');

const flexiBatchSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true,
  },
  schedule: [
    {
      day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      time: {
        type: String,
        required: true
      },
      timeStart: {
        type: String,
        required: true
      },
      timeEnd: {
        type: String,
        required: true
      }
    }
  ],
  classType: {
    type: String,
    enum: ['offline', 'online'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes
flexiBatchSchema.index({ studentId: 1, status: 1 });
flexiBatchSchema.index({ classType: 1, status: 1 });

// ═══════════════════════════════════════════════════════════
// VIRTUAL: Display helpers for dropdowns/lists
// ═══════════════════════════════════════════════════════════
const DAY_SHORT_MAP = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
  'Saturday': 'Sat',
  'Sunday': 'Sun'
};

// e.g., "Tue/Wed · 11:00 AM - 12:00 PM"
flexiBatchSchema.virtual('displayName').get(function() {
  const days = this.schedule.map(s => DAY_SHORT_MAP[s.day] || s.day);
  const daysText = days.join('/');
  const timeText = this.schedule[0]?.time || '';
  return `${daysText} · ${timeText}`;
});

// e.g., "Tuesday & Wednesday · 11:00 AM - 12:00 PM"
flexiBatchSchema.virtual('displayNameFull').get(function() {
  const daysText = this.schedule.map(s => s.day).join(' & ');
  const timeText = this.schedule[0]?.time || '';
  return `${daysText} · ${timeText}`;
});

// e.g., "Tue/Wed"
flexiBatchSchema.virtual('dayShort').get(function() {
  return this.schedule.map(s => DAY_SHORT_MAP[s.day] || s.day).join('/');
});

// e.g., "Tuesday & Wednesday"
flexiBatchSchema.virtual('dayFull').get(function() {
  return this.schedule.map(s => s.day).join(' & ');
});

flexiBatchSchema.virtual('isFlexi').get(function() {
  return true;
});

// Ensure virtuals are included in JSON output
flexiBatchSchema.set('toJSON', { virtuals: true });
flexiBatchSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FlexiBatch', flexiBatchSchema);
