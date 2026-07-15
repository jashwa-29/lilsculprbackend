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
    // ═══ FIX: Reference Category model instead of hardcoded enum ═══
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster queries
galleryItemSchema.index({ category: 1, isActive: 1 });
galleryItemSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('GalleryItem', galleryItemSchema);