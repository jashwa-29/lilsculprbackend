require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category.model');
const GalleryItem = require('./models/GalleryItem.model');

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lilsculpr";

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const defaultCategories = [
            { name: 'Miniature Food', icon: '🍔' },
            { name: 'Animals & Characters', icon: '🐶' },
            { name: 'Clay Sculptures', icon: '🏺' },
            { name: 'Decorative Art', icon: '🖼️' },
            { name: 'Class Activities', icon: '🧑‍🎨' },
            { name: 'Other', icon: '📁' }
        ];

        console.log('Creating default categories...');
        const categoryDocs = {};
        let order = 1;
        for (const cat of defaultCategories) {
            let existing = await Category.findOne({ name: cat.name });
            if (!existing) {
                existing = await Category.create({
                    name: cat.name,
                    icon: cat.icon,
                    displayOrder: order++
                });
                console.log(`Created category: ${cat.name}`);
            }
            categoryDocs[cat.name] = existing._id;
        }

        console.log('Migrating gallery items...');
        // We use lean() to get the raw document since the schema expects an ObjectId now
        const items = await GalleryItem.collection.find({}).toArray();
        let migratedCount = 0;

        for (const item of items) {
            // Check if category is still a string
            if (typeof item.category === 'string') {
                const newCatId = categoryDocs[item.category] || categoryDocs['Other'];
                await GalleryItem.collection.updateOne(
                    { _id: item._id },
                    { $set: { category: newCatId } }
                );
                migratedCount++;
            }
        }

        console.log(`Migration complete! Migrated ${migratedCount} gallery items.`);
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
