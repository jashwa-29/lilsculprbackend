const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const Student = require('../models/student.model');

async function backfillLevelHistory() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lilsculpr');
    console.log('✅ Connected to MongoDB');

    const students = await Student.find({});
    let fixedCount = 0;

    for (const student of students) {
      const currentLevel = student.currentLevel || 0;
      
      // Skip if no history or missing entries
      if (currentLevel > 0 && student.levelHistory.length === 0) {
        // Student has a level but no history → backfill all levels 1..currentLevel
        const newHistory = [];
        for (let i = 1; i <= currentLevel; i++) {
          newHistory.push({
            level: i,
            startedDate: i === 1 ? student.createdAt || new Date() : new Date(),
            completedDate: i === currentLevel ? null : new Date(),
            certificateIssued: false
          });
        }
        student.levelHistory = newHistory;
        await student.save();
        fixedCount++;
        console.log(`✅ Fixed ${student.childName}: Level ${currentLevel} with ${currentLevel} history entries`);
      } 
      else if (currentLevel > 0 && student.levelHistory.length > 0) {
        // Check if history entries cover all levels up to currentLevel
        const existingLevels = student.levelHistory.map(h => h.level);
        const missingLevels = [];
        for (let i = 1; i <= currentLevel; i++) {
          if (!existingLevels.includes(i)) {
            missingLevels.push(i);
          }
        }
        
        if (missingLevels.length > 0) {
          // Add missing levels
          for (const level of missingLevels) {
            student.levelHistory.push({
              level: level,
              startedDate: student.createdAt || new Date(),
              completedDate: level === currentLevel ? null : new Date(),
              certificateIssued: false
            });
          }
          await student.save();
          fixedCount++;
          console.log(`✅ Fixed ${student.childName}: Added missing levels ${missingLevels.join(', ')}`);
        }
      }
    }

    console.log(`\n✅ Migration complete! Fixed ${fixedCount} students.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

backfillLevelHistory();
