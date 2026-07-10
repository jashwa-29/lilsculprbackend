const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const Student = require('../models/student.model');

async function migrateDateOfBirth() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lilsculpr');
    console.log('✅ Connected to MongoDB');

    const students = await Student.find({});
    let updatedCount = 0;

    for (const student of students) {
      // Skip if dateOfBirth already exists
      if (student.dateOfBirth) continue;

      // Try to parse childAge as a date
      let dob = null;
      
      // If childAge is in format "7 years" or "7"
      if (student.childAge) {
        const ageMatch = student.childAge.match(/(\d+)/);
        if (ageMatch) {
          const age = parseInt(ageMatch[1]);
          if (!isNaN(age) && age > 0 && age < 18) {
            // Approximate DOB by subtracting age from current date
            const now = new Date();
            dob = new Date(now.getFullYear() - age, now.getMonth(), 1);
            // Set to first of month as approximation
          }
        }
      }

      // If parsing failed, use enrolledDate as fallback
      if (!dob && student.enrolledDate) {
        dob = student.enrolledDate;
      }

      if (dob) {
        student.dateOfBirth = dob;
        await student.save();
        updatedCount++;
        console.log(`✅ Updated ${student.childName} with DOB: ${dob.toISOString().split('T')[0]}`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updatedCount} students.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📌 Database connection closed');
    process.exit(0);
  }
}

migrateDateOfBirth();
