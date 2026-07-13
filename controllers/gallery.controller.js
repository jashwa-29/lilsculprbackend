const GalleryItem = require('../models/GalleryItem.model');
const GalleryCategory = require('../models/GalleryCategory.model');
const path = require('path');
const fs = require('fs');

// Helper function to delete an image file from the server
const deleteImageFile = (imageUrl) => {
    if (!imageUrl) return;
    const filename = path.basename(imageUrl);
    const filePath = path.join(__dirname, '../uploads/', filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted image file: ${filePath}`);
    }
};

// --- Public Routes (No Auth Required) ---

/**
 * GET /api/gallery
 * Get all active gallery items with optional category filter
 */
exports.getAllGalleryItems = async (req, res) => {
    try {
        const { category } = req.query;
        
        let query = { isActive: true };
        if (category && category !== 'all') {
            query.category = category;
        }
        
        const items = await GalleryItem.find(query)
            .sort({ displayOrder: 1, createdAt: -1 });
            
        res.json({
            success: true,
            data: items,
            categories: await getCategoryCounts()
        });
    } catch (error) {
        console.error('Get All Gallery Items Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch gallery items'
        });
    }
};

/**
 * GET /api/gallery/categories
 * Get all categories with item counts
 */
exports.getCategories = async (req, res) => {
    try {
        const categories = await getCategoryCounts();
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
};

// Helper function to get category counts and icons
async function getCategoryCounts() {
    // Fetch dynamic categories
    const categories = await GalleryCategory.find().sort({ name: 1 });
    
    // Always include 'Other' as a fallback
    const categoryList = categories.map(c => ({ _id: c._id, name: c.name, icon: c.icon }));
    if (!categoryList.find(c => c.name === 'Other')) {
        categoryList.push({ _id: 'other', name: 'Other', icon: '✨' });
    }

    const counts = {};
    for (const cat of categoryList) {
        counts[cat.name] = {
            _id: cat._id,
            count: await GalleryItem.countDocuments({ category: cat.name, isActive: true }),
            icon: cat.icon
        };
    }
    return counts;
}

/**
 * GET /api/gallery/:id
 * Get a single gallery item by ID
 */
exports.getGalleryItemById = async (req, res) => {
    try {
        const item = await GalleryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Gallery item not found'
            });
        }
        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Get Gallery Item By ID Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch gallery item'
        });
    }
};

// --- Admin Routes (Protected) ---

/**
 * POST /api/gallery/admin
 * Create a new gallery item with an image upload
 */
exports.createGalleryItem = async (req, res) => {
    try {
        const { title, description, category, isActive = true } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Image file is required'
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        const newItem = new GalleryItem({
            title: title.trim(),
            description: description ? description.trim() : '',
            category: category || 'Other',
            imageUrl,
            isActive: isActive === 'true' || isActive === true
        });

        await newItem.save();

        res.status(201).json({
            success: true,
            message: 'Gallery item created successfully',
            data: newItem
        });

    } catch (error) {
        console.error('Create Gallery Item Error:', error);
        if (req.file) {
            const filePath = path.join(__dirname, '../uploads/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create gallery item'
        });
    }
};

/**
 * PUT /api/gallery/admin/:id
 * Update an existing gallery item
 */
exports.updateGalleryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, isActive } = req.body;

        const existingItem = await GalleryItem.findById(id);
        if (!existingItem) {
            if (req.file) {
                const filePath = path.join(__dirname, '../uploads/', req.file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return res.status(404).json({
                success: false,
                error: 'Gallery item not found'
            });
        }

        const updateData = {
            title: title ? title.trim() : existingItem.title,
            description: description !== undefined ? description.trim() : existingItem.description,
            category: category || existingItem.category,
            isActive: isActive !== undefined ? isActive === 'true' || isActive === true : existingItem.isActive
        };

        if (req.file) {
            deleteImageFile(existingItem.imageUrl);
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }

        const updatedItem = await GalleryItem.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Gallery item updated successfully',
            data: updatedItem
        });

    } catch (error) {
        console.error('Update Gallery Item Error:', error);
        if (req.file) {
            const filePath = path.join(__dirname, '../uploads/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to update gallery item'
        });
    }
};

/**
 * DELETE /api/gallery/admin/:id
 * Delete a gallery item
 */
exports.deleteGalleryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await GalleryItem.findById(id);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Gallery item not found'
            });
        }

        deleteImageFile(item.imageUrl);
        await GalleryItem.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Gallery item deleted successfully'
        });

    } catch (error) {
        console.error('Delete Gallery Item Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete gallery item'
        });
    }
};

/**
 * POST /api/gallery/admin/reorder
 * Reorder gallery items
 */
exports.reorderGalleryItems = async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required'
            });
        }

        const bulkOps = items.map(item => ({
            updateOne: {
                filter: { _id: item.id },
                update: { $set: { displayOrder: item.displayOrder } }
            }
        }));

        await GalleryItem.bulkWrite(bulkOps);

        res.json({
            success: true,
            message: 'Gallery items reordered successfully'
        });

    } catch (error) {
        console.error('Reorder Gallery Items Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reorder gallery items'
        });
    }
};

/**
 * GET /api/gallery/admin/categories
 * Get all categories as an array for admin management
 */
exports.getAllCategoriesAdmin = async (req, res) => {
    try {
        const categories = await GalleryCategory.find().sort({ name: 1 });
        
        // Always ensure 'Other' exists
        const hasFallback = categories.some(c => c.name === 'Other');
        let result = categories.map(async (c) => ({
            _id: c._id,
            name: c.name,
            icon: c.icon,
            count: await GalleryItem.countDocuments({ category: c.name })
        }));
        result = await Promise.all(result);

        if (!hasFallback) {
            result.push({ _id: 'other', name: 'Other', icon: '\u2728', count: await GalleryItem.countDocuments({ category: 'Other' }) });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
};

/**
 * GET /api/gallery/admin/all
 * Get all gallery items including inactive ones
 */
exports.getAllGalleryItemsAdmin = async (req, res) => {
    try {
        const items = await GalleryItem.find()
            .sort({ displayOrder: 1, createdAt: -1 });
        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Get All Gallery Items Admin Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch all gallery items'
        });
    }
};

/**
 * POST /api/gallery/admin/categories
 * Create a new gallery category
 */
exports.createCategory = async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Category name is required' });
        }

        const newCategory = new GalleryCategory({
            name: name.trim(),
            icon: icon || '✨'
        });

        await newCategory.save();
        res.status(201).json({ success: true, message: 'Category created', data: newCategory });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Category already exists' });
        }
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
};

/**
 * DELETE /api/gallery/admin/categories/:id
 * Delete a gallery category
 */
exports.deleteCategory = async (req, res) => {
    try {
        const category = await GalleryCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        if (category.name === 'Other') {
            return res.status(400).json({ success: false, error: 'Cannot delete the default Other category' });
        }

        // Reassign items to 'Other'
        await GalleryItem.updateMany({ category: category.name }, { category: 'Other' });
        await GalleryCategory.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Category deleted and items reassigned to Other' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
};
