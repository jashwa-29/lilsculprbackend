/**
 * seedBatches.js
 * Run once to seed the default batches into the database.
 * Usage: node seed/seedBatches.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const Batch = require('../models/Batch.model');

const defaultBatches = [
  // Offline Batches (Mon & Fri)
  { type: 'offline', dayId: 'monfri', time: '4:00 – 5:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  { type: 'offline', dayId: 'monfri', time: '6:00 – 7:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  
  // Offline Batches (Tue & Thu)
  { type: 'offline', dayId: 'tuethu', time: '4:00 – 5:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  { type: 'offline', dayId: 'tuethu', time: '6:00 – 7:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },

  // Offline Batches (Sat & Sun)
  { type: 'offline', dayId: 'satsu', time: '9:30 – 11:00 AM', capacity: 8, status: 'active', instructor: 'Admin' },
  { type: 'offline', dayId: 'satsu', time: '11:30 – 1:00 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  
  // Online Batches (Mon & Fri)
  { type: 'online', dayId: 'monfri', time: '5:00 – 6:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  
  // Online Batches (Tue & Thu)
  { type: 'online', dayId: 'tuethu', time: '5:00 – 6:30 PM', capacity: 8, status: 'active', instructor: 'Admin' },
  
  // Online Batches (Sat & Sun)
  { type: 'online', dayId: 'satsu', time: '10:00 – 11:30 AM', capacity: 8, status: 'active', instructor: 'Admin' }
];

async function seedBatches() {
  let added = 0;
  for (const batchData of defaultBatches) {
    try {
      // Check if batch already exists based on unique index (type, dayId, time)
      const existing = await Batch.findOne({ 
        type: batchData.type, 
        dayId: batchData.dayId, 
        time: batchData.time 
      });

      if (!existing) {
        await Batch.create(batchData);
        added++;
        console.log(`✅ Seeded: ${batchData.type} | ${batchData.dayId} | ${batchData.time}`);
      } else {
        console.log(`⚠️  Skipped (Already exists): ${batchData.type} | ${batchData.dayId} | ${batchData.time}`);
      }
    } catch (err) {
      console.error(`❌ Error seeding batch (${batchData.type} | ${batchData.dayId} | ${batchData.time}):`, err.message);
    }
  }
  console.log(`🎉 Finished! Added ${added} new batches.`);
}

if (require.main === module) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  
  (async () => {
    try {
      const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
      if (!dbUri) throw new Error('No DB URI found in .env');

      await mongoose.connect(dbUri);
      console.log('✅ MongoDB connected');

      await seedBatches();
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
    } finally {
      await mongoose.connection.close();
      process.exit(0);
    }
  })();
} else {
  module.exports = seedBatches;
}
