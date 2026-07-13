/**
 * syncBatches.js
 * Scans all existing students in the database and creates batches 
 * for any (classType, dayId, time) combination that doesn't already exist.
 * Usage: node scripts/syncBatches.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const Batch = require('../models/Batch.model');
const Student = require('../models/student.model');

async function syncBatches() {
  try {
    console.log('🔍 Scanning existing students for their batch details...');
    
    // Find all distinct students and their batch info
    // (If dayId or time is missing, we skip)
    const students = await Student.find({}, 'classType dayId time');
    
    let added = 0;
    const batchMap = new Set();
    
    for (const student of students) {
      if (!student.classType || !student.dayId || !student.time) continue;
      
      const key = `${student.classType}|${student.dayId}|${student.time}`;
      if (!batchMap.has(key)) {
        batchMap.add(key);
        
        // Check if batch exists
        const existing = await Batch.findOne({ 
          type: student.classType, 
          dayId: student.dayId, 
          time: student.time 
        });

        if (!existing) {
          await Batch.create({
            type: student.classType,
            dayId: student.dayId,
            time: student.time,
            capacity: 8, // Default capacity
            status: 'active',
            instructor: 'Admin'
          });
          added++;
          console.log(`✅ Created Missing Batch: ${student.classType} | ${student.dayId} | ${student.time}`);
        }
      }
    }
    
    console.log(`🎉 Finished! Created ${added} missing batches based on existing students.`);
  } catch (err) {
    console.error('❌ Error syncing batches:', err);
  }
}

if (require.main === module) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  
  (async () => {
    try {
      const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
      if (!dbUri) throw new Error('No DB URI found in .env');

      await mongoose.connect(dbUri);
      console.log('✅ MongoDB connected');

      await syncBatches();
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
    } finally {
      await mongoose.connection.close();
      process.exit(0);
    }
  })();
} else {
  module.exports = syncBatches;
}
