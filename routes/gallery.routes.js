const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const galleryController = require('../controllers/gallery.controller');
const { protect } = require('../middleware/auth.middleware');

// --- Multer Configuration for Gallery Images ---
// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename with timestamp and random number
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'gallery-' + uniqueSuffix + ext);
    }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Initialize multer with the config
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// --- Routes ---

// Public routes (no authentication)
router.get('/', galleryController.getAllGalleryItems);
router.get('/:id', galleryController.getGalleryItemById);

// Admin routes (require authentication)
// Apply the 'protect' middleware to all routes defined after this point
router.use(protect); 

// Admin: Get all items (including inactive)
router.get('/admin/all', galleryController.getAllGalleryItemsAdmin);

// Admin: Create a new item with image upload
// 'upload.single('image')' expects a form field named 'image'
router.post('/admin', upload.single('image'), galleryController.createGalleryItem);

// Admin: Update an existing item with optional new image
router.put('/admin/:id', upload.single('image'), galleryController.updateGalleryItem);

// Admin: Delete an item
router.delete('/admin/:id', galleryController.deleteGalleryItem);

// Admin: Reorder items
router.post('/admin/reorder', galleryController.reorderGalleryItems);

module.exports = router;
