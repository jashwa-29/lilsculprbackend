const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const blogController = require('../controllers/blog.controller');
const { protect } = require('../middleware/auth.middleware');

// --- Multer Configuration for Blog Images (saved in uploads/blogs/) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/blogs/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
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

// ─── Public routes ──────────────────────────────────────────────────────
router.get('/', blogController.getPublished);
router.get('/:slugOrId', blogController.getBySlugOrId);

// ─── Admin routes (require authentication) ──────────────────────────────
router.use(protect);

router.post('/admin/upload-image', upload.single('image'), blogController.uploadImage);
router.get('/admin/all', blogController.getAll);
router.post('/admin', blogController.create);
router.put('/admin/:id', blogController.update);
router.delete('/admin/:id', blogController.remove);

module.exports = router;
