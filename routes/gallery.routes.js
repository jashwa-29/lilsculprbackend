const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const galleryController = require('../controllers/gallery.controller');
const { protect } = require('../middleware/auth.middleware');

// --- Multer Configuration for Gallery Images ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'gallery-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// --- Routes ---

// Public routes (no authentication)
router.get('/', galleryController.getAllGalleryItems);
router.get('/categories', galleryController.getCategories);
router.get('/:id', galleryController.getGalleryItemById);

// Admin routes (require authentication)
router.use(protect);

router.get('/admin/all', galleryController.getAllGalleryItemsAdmin);
router.post('/admin', upload.single('image'), galleryController.createGalleryItem);
router.put('/admin/:id', upload.single('image'), galleryController.updateGalleryItem);
router.delete('/admin/:id', galleryController.deleteGalleryItem);
router.post('/admin/reorder', galleryController.reorderGalleryItems);

router.get('/admin/categories', galleryController.getAllCategoriesAdmin);
router.post('/admin/categories', galleryController.createCategory);
router.delete('/admin/categories/:id', galleryController.deleteCategory);

module.exports = router;
