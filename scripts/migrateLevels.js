require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/student.model');
const Batch = require('../models/Batch.model');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lilsculpr', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // 1. Update all students to have currentLevel = 1 if missing
    const studentResult = await Student.updateMany(
      { currentLevel: { $exists: false } },
      { $set: { currentLevel: 1, levelHistory: [] } }
    );
    console.log(`Updated ${studentResult.modifiedCount} students with currentLevel: 1`);

    // 2. Remove level field from all batches (if it exists)
    const batchResult = await Batch.updateMany(
      {},
      { $unset: { level: 1 } }
    );
    console.log(`Removed level field from ${batchResult.modifiedCount} batches`);

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();