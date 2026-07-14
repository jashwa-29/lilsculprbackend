const Category = require('../models/Category.model');

/**
 * GET /api/categories
 * Get all active categories
 */
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get All Categories Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};

/**
 * GET /api/categories/admin/all
 * Get all categories including inactive ones (admin only)
 */
exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ displayOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get All Categories Admin Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};

/**
 * POST /api/categories/admin
 * Create a new category
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, icon, displayOrder } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }

    // Check for duplicate
    const existing = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A category with this name already exists'
      });
    }

    const category = new Category({
      name: name.trim(),
      icon: icon || '📁',
      displayOrder: displayOrder || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
};

/**
 * PUT /api/categories/admin/:id
 * Update a category
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, isActive, displayOrder } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'A category with this name already exists'
        });
      }
      category.name = name.trim();
    }

    if (icon !== undefined) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
};

/**
 * DELETE /api/categories/admin/:id
 * Delete a category (only if not used by any gallery item)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category is used by any gallery item
    const GalleryItem = require('../models/GalleryItem.model');
    const usedCount = await GalleryItem.countDocuments({ category: id });
    
    if (usedCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category: It is used by ${usedCount} gallery item(s). Please reassign or delete those items first.`
      });
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
};
