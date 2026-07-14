const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes
router.get('/', categoryController.getAllCategories);

// Admin routes (protected)
router.get('/admin/all', protect, categoryController.getAllCategoriesAdmin);
router.post('/admin', protect, categoryController.createCategory);
router.put('/admin/:id', protect, categoryController.updateCategory);
router.delete('/admin/:id', protect, categoryController.deleteCategory);

module.exports = router;
