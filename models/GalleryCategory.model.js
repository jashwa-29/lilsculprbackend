const mongoose = require('mongoose');

const galleryCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    icon: {
        type: String,
        default: '✨'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GalleryCategory', galleryCategorySchema);
