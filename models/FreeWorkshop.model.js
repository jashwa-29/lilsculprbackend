const mongoose = require('mongoose');

const FreeWorkshopSchema = new mongoose.Schema({
    parentName: {
        type: String,
        required: [true, 'Parent Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email Address is required'],
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone Number is required'],
        trim: true
    },
    childName: {
        type: String,
        required: [true, "Child's Name is required"],
        trim: true
    },
    childAge: {
        type: String,
        required: [true, "Child's Age is required"],
        trim: true
    },
    batchTime: {
        type: String,
        default: '11:00 AM - 12:00 PM',
        required: true
    }
}, { timestamps: true });

// Ensure the same child cannot register multiple times under the same email or phone.
// But different children can be registered under the same email.
FreeWorkshopSchema.index({ email: 1, childName: 1 }, { unique: true, message: 'This child is already registered with this email.' });

const FreeWorkshop = mongoose.model('FreeWorkshop', FreeWorkshopSchema);

module.exports = FreeWorkshop;
