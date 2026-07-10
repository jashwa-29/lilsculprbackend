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
  
  const completed = this.levelHistory.filter(h => h.completedDate).length;
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

module.exports = mongoose.model('Student', studentSchema);