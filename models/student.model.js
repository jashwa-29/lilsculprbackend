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
  // ═══ NEW: Date of Birth Field ═══
  dateOfBirth: {
    type: Date,
    default: null
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
    type: String,
    default: ''
  },
  
  // ═══ PAYMENT FIELDS ═══
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Razorpay', 'Cash', 'UPI', 'Bank Transfer', 'Other'],
    default: null
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
  
  // ═══ FEE TRACKING FIELDS ═══
  feeCoverage: {
    type: String,
    enum: ['first_month', 'pending_first_month', 'monthly'],
    default: 'pending_first_month'
  },
  feeStartMonth: {
    type: String,
  },
  feeStartDate: {
    type: Date,
  },
  
  // ═══ STATUS FIELDS ═══
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled'],
    default: 'active'
  },
  
  // ═══ LEVEL SYSTEM - UPDATED ═══
  // 0 = Newbie (not started), 1-12 = Current level
  currentLevel: { 
    type: Number, 
    min: 0, 
    max: 12, 
    default: 0 
  },
  
  // Track when student started their journey
  levelStartedAt: {
    type: Date,
    default: null
  },
  
  enrolledDate: { 
    type: Date, 
    default: Date.now 
  },
  
  // ═══ ENROLLMENT STATUS - UPDATED ═══
  enrollmentStatus: {
    type: String,
    enum: ['pending', 'active', 'paused', 'withdrawn', 'completed', 'graduated', 'level_transition'],
    default: 'pending'
  },
  
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },

  // ═══ FLEXI-BATCH FLAG ═══
  isFlexiBatch: {
    type: Boolean,
    default: false
  },
  flexiBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlexiBatch',
    default: null
  },
  batchDisplayName: {
    type: String,
    default: ''
  },
  dayIdFull: {
    type: String,
    default: ''
  },
  
  // ═══ LEVEL HISTORY - TRACKS COMPLETED LEVELS ═══
  levelHistory: [{
    level: {
      type: Number,
      min: 1,
      max: 12
    },
    startedDate: {
      type: Date,
      default: Date.now
    },
    completedDate: {
      type: Date,
      default: null
    },
    certificateIssued: { 
      type: Boolean, 
      default: false 
    },
    certificateUrl: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  
  batchJoinedDate: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// ═══ INDEXES ═══
studentSchema.index({ enrollmentStatus: 1, batchId: 1 });
studentSchema.index({ enrollmentStatus: 1, currentLevel: 1 });
studentSchema.index({ batchId: 1, batchJoinedDate: 1 });
studentSchema.index({ currentLevel: 1 });
studentSchema.index({ isFlexiBatch: 1, flexiBatchId: 1 });

// ═══ PRE-SAVE HOOK ═══
studentSchema.pre('save', function(next) {
  // Normalize enrollmentId to uppercase
  if (this.isModified('enrollmentId') && this.enrollmentId) {
    this.enrollmentId = this.enrollmentId.toUpperCase().trim();
  }
  
  // Auto-calculate childAge from dateOfBirth
  if (this.isModified('dateOfBirth') && this.dateOfBirth) {
    const age = new Date().getFullYear() - this.dateOfBirth.getFullYear();
    this.childAge = `${age} years`;
  }
  
  // If level is being set from 0 to 1, record the start date
  if (this.isModified('currentLevel') && this.currentLevel === 1 && this.levelStartedAt === null) {
    this.levelStartedAt = new Date();
  }
  
  next();
});

// ═══ VIRTUAL: Get current level progress ═══
studentSchema.virtual('levelProgress').get(function() {
  if (this.currentLevel === 0) return { status: 'not_started', label: 'Newbie' };
  if (this.enrollmentStatus === 'graduated') return { status: 'graduated', label: 'Graduated!' };
  if (this.enrollmentStatus === 'paused') return { status: 'paused', label: 'Paused' };

  const completed = this.levelHistory ? this.levelHistory.filter(h => h.completedDate).length : 0;
  return {
    status: 'in_progress',
    label: `Level ${this.currentLevel}`,
    completed,
    total: 12
  };
});

// ═══ METHOD: Start student's level journey ═══
studentSchema.methods.startLevelJourney = async function() {
  if (this.currentLevel !== 0) {
    throw new Error(`Student is already at Level ${this.currentLevel}`);
  }
  
  this.currentLevel = 1;
  this.enrollmentStatus = 'active';
  this.levelStartedAt = new Date();
  
  // Add initial level entry to history
  this.levelHistory.push({
    level: 1,
    startedDate: new Date(),
    completedDate: null,
    certificateIssued: false
  });
  
  await this.save();
  return this;
};

// ═══ METHOD: Complete current level and advance ═══
studentSchema.methods.advanceLevel = async function() {
  if (this.currentLevel === 0) {
    throw new Error('Student has not started their level journey yet');
  }
  
  if (this.currentLevel >= 12) {
    // Student is at max level, graduate them
    this.enrollmentStatus = 'graduated';
    await this.save();
    return { action: 'graduated', level: 12 };
  }
  
  // ═══ FIX: Ensure current level exists in history ═══
  let currentLevelEntry = this.levelHistory.find(h => 
    h.level === this.currentLevel && h.completedDate === null
  );
  
  // If not found, create it (backward compatibility)
  if (!currentLevelEntry) {
    // Check if it exists but is marked as completed
    const completedEntry = this.levelHistory.find(h => 
      h.level === this.currentLevel && h.completedDate !== null
    );
    
    if (completedEntry) {
      // It was already completed → we're re-completing? Move to next level
      const nextLevel = this.currentLevel + 1;
      // Check if next level already exists
      const nextEntry = this.levelHistory.find(h => h.level === nextLevel);
      if (!nextEntry) {
        this.levelHistory.push({
          level: nextLevel,
          startedDate: new Date(),
          completedDate: null,
          certificateIssued: false
        });
      }
      this.currentLevel = nextLevel;
      await this.save();
      return { action: 'advanced', fromLevel: this.currentLevel - 1, toLevel: nextLevel };
    }
    
    // Completely missing → create it
    this.levelHistory.push({
      level: this.currentLevel,
      startedDate: this.levelStartedAt || new Date(),
      completedDate: new Date(),
      certificateIssued: false
    });
    
    // Then advance
    const nextLevel = this.currentLevel + 1;
    this.levelHistory.push({
      level: nextLevel,
      startedDate: new Date(),
      completedDate: null,
      certificateIssued: false
    });
    this.currentLevel = nextLevel;
    await this.save();
    return { action: 'advanced', fromLevel: this.currentLevel - 1, toLevel: nextLevel };
  }
  
  // Normal flow
  currentLevelEntry.completedDate = new Date();
  const nextLevel = this.currentLevel + 1;
  this.currentLevel = nextLevel;
  this.levelHistory.push({
    level: nextLevel,
    startedDate: new Date(),
    completedDate: null,
    certificateIssued: false
  });
  
  await this.save();
  return { action: 'advanced', fromLevel: this.currentLevel - 1, toLevel: nextLevel };
};

// ═══ METHOD: Get current level details ═══
studentSchema.methods.getCurrentLevelDetails = function() {
  if (this.currentLevel === 0) {
    return {
      level: 0,
      status: 'not_started',
      label: 'Newbie - Not Started Yet'
    };
  }
  
  const currentEntry = this.levelHistory.find(h => 
    h.level === this.currentLevel && h.completedDate === null
  );
  
  const completedCount = this.levelHistory.filter(h => h.completedDate).length;
  
  return {
    level: this.currentLevel,
    status: this.enrollmentStatus,
    label: `Level ${this.currentLevel}`,
    startedDate: currentEntry?.startedDate || null,
    completedLevels: completedCount,
    totalLevels: 12,
    progress: Math.round((completedCount / 12) * 100)
  };
};

// ═══ VIRTUAL: Batch display name ═══
// Flexi-batch students show their actual selected days & time as their batch details
const DAY_SHORT_MAP = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
  'Saturday': 'Sat',
  'Sunday': 'Sun'
};

// ═══ HELPER: Is flexiBatchId populated with a schedule? ═══
// NOTE: flexiBatchId may be null, a bare ObjectId (string), or a populated object.
const isFlexiPopulated = (flexiBatchId) => {
  return flexiBatchId && typeof flexiBatchId === 'object' && Array.isArray(flexiBatchId.schedule);
};

// Get short day names from flexi schedule (e.g., "Tue/Wed")
studentSchema.methods.getFlexiDayShort = function() {
  if (!this.isFlexiBatch) return this.dayId || '';
  if (isFlexiPopulated(this.flexiBatchId)) {
    const days = this.flexiBatchId.schedule.map(s => DAY_SHORT_MAP[s.day] || s.day);
    return days.join('/');
  }
  return this.dayId || '';
};

// Get full day names from flexi schedule (e.g., "Tuesday & Wednesday")
studentSchema.methods.getFlexiDayFull = function() {
  if (!this.isFlexiBatch) return this.dayIdFull || this.dayId || '';
  if (isFlexiPopulated(this.flexiBatchId)) {
    const days = this.flexiBatchId.schedule.map(s => s.day);
    return days.join(' & ');
  }
  return this.dayIdFull || this.dayId || '';
};

// Virtual: short day names, e.g., "Tue/Wed"
studentSchema.virtual('flexiDayShort').get(function() {
  return this.getFlexiDayShort();
});

// Virtual: full day names, e.g., "Tuesday & Wednesday"
studentSchema.virtual('flexiDayFull').get(function() {
  return this.getFlexiDayFull();
});

// Virtual: the flexi schedule array ([] when unpopulated)
studentSchema.virtual('flexiSchedule').get(function() {
  if (isFlexiPopulated(this.flexiBatchId)) {
    return this.flexiBatchId.schedule;
  }
  return [];
});

// Virtual: is this student on a flexi-batch?
studentSchema.virtual('hasFlexiBatch').get(function() {
  return this.isFlexiBatch === true;
});

// Short display, e.g., "Tue/Wed at 11:00 AM - 12:00 PM"
studentSchema.virtual('batchDisplay').get(function() {
  if (this.isFlexiBatch) {
    const days = this.getFlexiDayShort();
    const time = this.time || '';
    return days && time ? `${days} at ${time}` : 'Flexi-Batch';
  }
  if (this.batchId) {
    if (typeof this.batchId === 'object' && this.batchId.dayId) {
      return `${this.batchId.dayId} · ${this.batchId.time || ''}`.trim();
    }
    return 'Assigned';
  }
  return 'Unassigned';
});

// Full display, e.g., "Tuesday & Wednesday at 11:00 AM - 12:00 PM"
// (stored on save by controllers; falls back to computed values if missing)
studentSchema.virtual('batchDisplayFull').get(function() {
  if (this.isFlexiBatch) {
    const days = this.getFlexiDayFull();
    const time = this.time || '';
    return days && time ? `${days} at ${time}` : 'Flexi-Batch';
  }
  if (this.batchId) {
    if (typeof this.batchId === 'object' && this.batchId.dayId) {
      return `${this.batchId.dayId} · ${this.batchId.time || ''}`.trim();
    }
    return 'Assigned';
  }
  return 'Unassigned';
});

// Ensure virtuals are included in JSON output
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);