const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true
  },
  childName: {
    type: String,
    required: true,
    trim: true
  },
  parentName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  contact1: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  },
  day: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastNotifiedYear: {
    type: Number,
    default: null
  }
}, { timestamps: true });

// Indexes
birthdaySchema.index({ year: 1, month: 1, day: 1 });
birthdaySchema.index({ isActive: 1 });
birthdaySchema.index({ month: 1, day: 1 });

// Static method to get birthdays for a specific date
birthdaySchema.statics.getBirthdaysForDate = async function(date) {
  const targetDate = new Date(date);
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  
  return await this.find({
    month,
    day,
    isActive: true
  }).populate('studentId');
};

// Static method to get upcoming birthdays
birthdaySchema.statics.getUpcomingBirthdays = async function(days = 7) {
  const today = new Date();
  
  const upcoming = [];
  
  for (let i = 0; i < days; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const month = futureDate.getMonth() + 1;
    const day = futureDate.getDate();
    
    const birthdays = await this.find({
      month,
      day,
      isActive: true
    }).populate('studentId');
    
    upcoming.push({
      date: futureDate,
      month,
      day,
      birthdays
    });
  }
  
  return upcoming;
};

module.exports = mongoose.model('Birthday', birthdaySchema);
