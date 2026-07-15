const GalleryItem = require('../models/GalleryItem.model');
const Category = require('../models/Category.model');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

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

// ─── Get category counts ──────────────────────────────────────────────
async function getCategoryCounts() {
    const categories = await Category.find({ isActive: true });
    const counts = {};
    for (const cat of categories) {
        counts[cat._id.toString()] = await GalleryItem.countDocuments({ 
            category: cat._id, 
            isActive: true 
        });
    }
    return counts;
}

// ─── Populate category with name and icon ──────────────────────────────
const populateCategory = { path: 'category', select: 'name icon' };

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
            // Check if category is an ObjectId or a name
            let categoryId = category;
            // If it's not a valid ObjectId, try to find by name
            if (!mongoose.Types.ObjectId.isValid(category)) {
                const cat = await Category.findOne({ 
                    name: category,
                    isActive: true 
                });
                if (cat) {
                    categoryId = cat._id;
                } else {
                    // If category not found, return empty
                    return res.json({
                        success: true,
                        data: [],
                        categories: await getCategoryCounts()
                    });
                }
            }
            query.category = categoryId;
        }
        
        const items = await GalleryItem.find(query)
            .populate(populateCategory)
            .sort({ displayOrder: 1, createdAt: -1 });
            
        // Format items for frontend
        const formattedItems = items.map(item => ({
            ...item.toObject(),
            categoryName: item.category?.name || 'Other',
            categoryIcon: item.category?.icon || '📁'
        }));
            
        res.json({
            success: true,
            data: formattedItems,
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
        const categories = await Category.find({ isActive: true })
            .sort({ displayOrder: 1, name: 1 });
        
        // Get counts for each category
        const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
            const count = await GalleryItem.countDocuments({ 
                category: cat._id, 
                isActive: true 
            });
            return {
                ...cat.toObject(),
                itemCount: count
            };
        }));
        
        res.json({
            success: true,
            data: categoriesWithCounts
        });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
};

/**
 * GET /api/gallery/:id
 * Get a single gallery item by ID
 */
exports.getGalleryItemById = async (req, res) => {
    try {
        const item = await GalleryItem.findById(req.params.id)
            .populate(populateCategory);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Gallery item not found'
            });
        }
        res.json({
            success: true,
            data: {
                ...item.toObject(),
                categoryName: item.category?.name || 'Other',
                categoryIcon: item.category?.icon || '📁'
            }
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

        // Validate category
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) {
            // Clean up uploaded file
            const filePath = path.join(__dirname, '../uploads/', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                success: false,
                error: 'Invalid category. Please select a valid category.'
            });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        const newItem = new GalleryItem({
            title: title.trim(),
            description: description ? description.trim() : '',
            category: category,
            imageUrl,
            isActive: isActive === 'true' || isActive === true
        });

        await newItem.save();

        // Populate category before sending response
        await newItem.populate(populateCategory);

        res.status(201).json({
            success: true,
            message: 'Gallery item created successfully',
            data: {
                ...newItem.toObject(),
                categoryName: newItem.category?.name || 'Other',
                categoryIcon: newItem.category?.icon || '📁'
            }
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
            isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : existingItem.isActive
        };

        // Validate and update category if provided
        if (category) {
            const categoryDoc = await Category.findById(category);
            if (!categoryDoc) {
                if (req.file) {
                    const filePath = path.join(__dirname, '../uploads/', req.file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                return res.status(400).json({
                    success: false,
                    error: 'Invalid category. Please select a valid category.'
                });
            }
            updateData.category = category;
        }

        if (req.file) {
            deleteImageFile(existingItem.imageUrl);
            updateData.imageUrl = `/uploads/${req.file.filename}`;
        }

        const updatedItem = await GalleryItem.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate(populateCategory);

        res.json({
            success: true,
            message: 'Gallery item updated successfully',
            data: {
                ...updatedItem.toObject(),
                categoryName: updatedItem.category?.name || 'Other',
                categoryIcon: updatedItem.category?.icon || '📁'
            }
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
 * GET /api/gallery/admin/all
 * Get all gallery items including inactive ones
 */
exports.getAllGalleryItemsAdmin = async (req, res) => {
    try {
        const items = await GalleryItem.find()
            .populate(populateCategory)
            .sort({ displayOrder: 1, createdAt: -1 });
        
        const formattedItems = items.map(item => ({
            ...item.toObject(),
            categoryName: item.category?.name || 'Other',
            categoryIcon: item.category?.icon || '📁'
        }));
            
        res.json({
            success: true,
            data: formattedItems
        });
    } catch (error) {
        console.error('Get All Gallery Items Admin Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch all gallery items'
        });
    }
};