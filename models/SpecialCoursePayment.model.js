const mongoose = require('mongoose');

const SpecialCoursePaymentSchema = new mongoose.Schema({
    registrationId: {
        type: String,
        required: true,
        ref: 'SpecialCourse'
    },
    
    razorpay_payment_id: {
        type: String,
        required: true,
        unique: true
    },
    razorpay_order_id: String,
    razorpay_signature: String,
    
    // Payment Details
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    
    // Payment Status
    status: {
        type: String,
        enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
        required: true
    },
    
    // Payment Method Details
    method: String,
    bank: String,
    wallet: String,
    card_id: String,
    vpa: String,
    
    // Razorpay Webhook Data
    webhook_data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Error Details (if any)
    error_code: String,
    error_description: String,
    
    // Timestamps
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

SpecialCoursePaymentSchema.index({ registrationId: 1 });
SpecialCoursePaymentSchema.index({ razorpay_payment_id: 1 }, { unique: true });
SpecialCoursePaymentSchema.index({ status: 1 });
SpecialCoursePaymentSchema.index({ created_at: 1 });

const SpecialCoursePayment = mongoose.model('SpecialCoursePayment', SpecialCoursePaymentSchema);
module.exports = SpecialCoursePayment;