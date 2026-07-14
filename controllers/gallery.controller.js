const GalleryItem = require('../models/GalleryItem.model');
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

// Helper function to get category counts
async function getCategoryCounts() {
    const categories = [
        'Miniature Food',
        'Animals & Characters',
        'Clay Sculptures',
        'Decorative Art',
        'Class Activities',
        'Other'
    ];
    
    const counts = {};
    for (const cat of categories) {
        counts[cat] = await GalleryItem.countDocuments({ category: cat, isActive: true });
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
