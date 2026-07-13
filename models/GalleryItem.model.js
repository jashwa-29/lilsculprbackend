const mongoose = require('mongoose');

const galleryItemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    imageUrl: {
        type: String,
        required: true
    },
    // ═══ NEW: Category field ═══
    category: {
        type: String,
        required: true,
        enum: ['Miniature Food', 'Animals & Characters', 'Clay Sculptures', 'Decorative Art', 'Class Activities', 'Other'],
        default: 'Other'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Optional: Order of display, can be used for manual sorting later
    displayOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster category queries
galleryItemSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
