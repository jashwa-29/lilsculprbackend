const GalleryItem = require('../models/GalleryItem.model');
const path = require('path');
const fs = require('fs');

// Helper function to delete an image file from the server
const deleteImageFile = (imageUrl) => {
    if (!imageUrl) return;
    // Extract the filename from the URL
    // Assumes URL format like /uploads/gallery-1234567890-filename.jpg
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
 * Get all active gallery items
 */
exports.getAllGalleryItems = async (req, res) => {
    try {
        const items = await GalleryItem.find({ isActive: true })
            .sort({ displayOrder: 1, createdAt: -1 }); // Show active ones, newest first
        res.json({
            success: true,
            data: items
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
        const { title, description, isActive = true } = req.body;

        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Image file is required'
            });
        }

        // Construct the image URL
        // Multer stores the file in the 'uploads' folder
        // The URL will be something like /uploads/filename.jpg
        const imageUrl = `/uploads/${req.file.filename}`;

        const newItem = new GalleryItem({
            title: title.trim(),
            description: description ? description.trim() : '',
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
        // If there was an error, delete the uploaded file to clean up
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
 * Update an existing gallery item, optionally with a new image
 */
exports.updateGalleryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, isActive } = req.body;

        const existingItem = await GalleryItem.findById(id);
        if (!existingItem) {
            // If item not found, delete the uploaded file if any
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

        // Prepare update data
        const updateData = {
            title: title ? title.trim() : existingItem.title,
            description: description !== undefined ? description.trim() : existingItem.description,
            isActive: isActive !== undefined ? isActive === 'true' || isActive === true : existingItem.isActive
        };

        // If a new file was uploaded, update image and delete the old one
        if (req.file) {
            // Delete the old image file
            deleteImageFile(existingItem.imageUrl);
            // Set the new image URL
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
        // If there was an error, delete the newly uploaded file to clean up
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
 * Delete a gallery item and its associated image file
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

        // Delete the image file from the server
        deleteImageFile(item.imageUrl);

        // Delete the document from the database
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
 * Reorder gallery items by setting displayOrder
 * Expects an array of { id, displayOrder }
 */
exports.reorderGalleryItems = async (req, res) => {
    try {
        const { items } = req.body; // items = [{ id: '...', displayOrder: 0 }, ...]

        if (!Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required'
            });
        }

        // Use bulkWrite for efficiency
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
 * Get all gallery items including inactive ones (for admin panel)
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
