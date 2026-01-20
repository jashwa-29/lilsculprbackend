const mongoose = require('mongoose');

const SpecialCourseSchema = new mongoose.Schema({
    registrationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Carnival/Workshop Information
    carnivalName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    
    // Parent Information
    parentName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    
    // Child Information
    childName: {
        type: String,
        required: true,
        trim: true
    },
    childAge: {
        type: String,
        required: true,
        trim: true
    },
    
    // Workshop Details
    selectedBatch: {
        type: String,
        required: true,
        trim: true
    },
    batchTime: {
        type: String,
        required: true,
        trim: true
    },
    selectedDate: {
        type: Date,
        required: true
    },
    materialType: {
        type: Boolean,
        default: false
    },
    
    // Registration Status
    status: {
        type: String,
        enum: ['pending_payment', 'registered', 'expired', 'cancelled'],
        default: 'pending_payment'
    },
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'expired', 'failed', 'refunded'],
        default: 'pending'
    },
    
    // Payment Information
    payment: {
        razorpay_payment_id: String,
        razorpay_order_id: String,
        razorpay_signature: String,
        amount: Number,
        currency: {
            type: String,
            default: 'INR'
        },
        status: String,
        payment_date: Date,
        method: String,
        bank: String,
        wallet: String,
        vpa: String
    },
    
    // Payment Expiry
    payment_expires_at: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
        }
    },
    payment_confirmed_at: Date,
    
    // Expiration Tracking
    expiredAt: Date,
    expiration_reason: String,
    
    // Metadata
    ip_address: String,
    user_agent: String,
    source: {
        type: String,
        default: 'website_form'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
SpecialCourseSchema.index({ carnivalName: 1, selectedDate: 1 });
SpecialCourseSchema.index({ carnivalName: 1, selectedDate: 1, selectedBatch: 1 });
SpecialCourseSchema.index({ email: 1, carnivalName: 1, selectedDate: 1 });
SpecialCourseSchema.index({ phone: 1, carnivalName: 1, selectedDate: 1 });
SpecialCourseSchema.index({ selectedDate: 1, selectedBatch: 1 });
SpecialCourseSchema.index({ status: 1, payment_status: 1 });
SpecialCourseSchema.index({ payment_expires_at: 1 });
SpecialCourseSchema.index({ createdAt: -1 });

// Virtual for formatted date
SpecialCourseSchema.virtual('dateString').get(function() {
    return this.selectedDate ? this.selectedDate.toISOString().split('T')[0] : null;
});

// Virtual for formatted date (display)
SpecialCourseSchema.virtual('formattedDate').get(function() {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for short date
SpecialCourseSchema.virtual('shortDate').get(function() {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
});

// Method to check if registration is expired
SpecialCourseSchema.methods.isExpired = function() {
    if (this.status === 'expired') return true;
    if (this.status === 'pending_payment' && this.payment_expires_at) {
        return new Date() > this.payment_expires_at;
    }
    return false;
};

// Method to get time left in minutes
SpecialCourseSchema.methods.getTimeLeft = function() {
    if (this.status !== 'pending_payment' || !this.payment_expires_at) return 0;
    
    const now = new Date();
    const expires = new Date(this.payment_expires_at);
    const diffMs = expires - now;
    
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60)); // Convert to minutes
};

// Method to check if registration is complete
SpecialCourseSchema.methods.isRegistrationComplete = function() {
    return this.status === 'registered' && this.payment_status === 'paid';
};

// Pre-save middleware to handle expiration
SpecialCourseSchema.pre('save', function(next) {
    const now = new Date();
    
    // Auto-expire if payment time has passed
    if (this.status === 'pending_payment' && 
        this.payment_expires_at && 
        now > this.payment_expires_at) {
        this.status = 'expired';
        this.payment_status = 'expired';
        this.expiration_reason = 'Payment timeout (auto-expire on save)';
        this.expiredAt = now;
    }
    
    // Update timestamps
    if (this.isModified()) {
        this.updatedAt = now;
    }
    
    next();
});

const SpecialCourse = mongoose.model('SpecialCourse', SpecialCourseSchema);

module.exports = SpecialCourse;