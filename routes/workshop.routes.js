const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const workshopController = require('../controllers/workshop.controller');
const { protect } = require('../middleware/auth.middleware');

// --- Multer Configuration for Workshop Images ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/workshops/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'workshop-' + uniqueSuffix + path.extname(file.originalname));
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

// Upload a workshop image (admin only). Returns an absolute URL that the
// workshops page and registration pages can use directly.
router.post('/upload-image', protect, upload.single('image'), workshopController.uploadImage);

router.get('/active', workshopController.getActive);
router.get('/', workshopController.getAll);
router.get('/:id', workshopController.getById);
router.post('/', workshopController.create);
router.put('/:id', workshopController.update);
router.delete('/:id', workshopController.remove);

module.exports = router;