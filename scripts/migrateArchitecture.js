const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Batch = require('../models/Batch.model');
const Student = require('../models/student.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const CompensationRecord = require('../models/CompensationRecord.model');
const CompensationToken = require('../models/CompensationToken.model');
const Config = require('../models/config.model');

async function runMigration() {
  try {
    const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
    if (!dbUri) throw new Error('No DB URI found in .env');

    await mongoose.connect(dbUri);
    console.log('✅ MongoDB connected');

    // STEP 1: Convert Config batches to Batch documents (without level)
    console.log('📊 STEP 1: Converting Config to Batch documents...');
    const config = await Config.findOne({ key: 'BATCHES' });
    
    if (!config) {
      console.error('❌ BATCHES config not found!');
      return;
    }

    const batches = config.value;
    const newBatchMap = new Map();

    for (const [type, bt] of Object.entries(batches)) {
      for (const day of bt.days) {
        for (const time of day.slots) {
          const slotKey = `${type}|${day.id}|${time}`;
          
          // Check if batch already exists
          let existingBatch = await Batch.findOne({ 
            type, 
            dayId: day.id, 
            time 
          });
          
          if (!existingBatch) {
            existingBatch = new Batch({
              type,
              dayId: day.id,
              time,
              capacity: 8,
              status: 'active',
              enrolledStudents: []
              // ═══ NO LEVEL FIELD ═══
            });
            await existingBatch.save();
            console.log(`✅ Created Batch: ${slotKey}`);
          }
          
          newBatchMap.set(slotKey, existingBatch._id);
        }
      }
    }

    // STEP 2: Migrate existing students to Batches
    console.log('\n👨🎓 STEP 2: Migrating students to Batches...');
    const students = await Student.find({ 
      status: 'active',
      slotKey: { $exists: true }
    });

    for (const student of students) {
      const batchId = newBatchMap.get(student.slotKey);
      if (batchId) {
        // ═══ PRESERVE STUDENT'S EXISTING LEVEL ═══
        // Only set level if student doesn't have one
        if (!student.currentLevel) {
          student.currentLevel = 1;
        }
        
        student.batchId = batchId;
        student.enrollmentStatus = 'active';
        await student.save();
        
        // Add student to batch's enrolledStudents array
        await Batch.findByIdAndUpdate(batchId, {
          $addToSet: { enrolledStudents: student._id }
        });
        console.log(`✅ Mapped ${student.childName} to ${student.slotKey} (Level ${student.currentLevel})`);
      } else {
        console.warn(`⚠️ No batch found for ${student.childName} (${student.slotKey})`);
      }
    }

    // STEP 3: Generate Compensation Tokens from past absences (30-day limit)
    console.log('\n🎫 STEP 3: Converting recent absences to Compensation Tokens...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const absences = await AttendanceRecord.aggregate([
      { 
        $match: { 
          status: 'A',
          date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
        } 
      },
      { $sort: { date: 1 } },
      { 
        $group: {
          _id: '$studentId',
          absences: { $push: '$$ROOT' }
        }
      }
    ]);

    let tokensCreated = 0;

    for (const group of absences) {
      const studentId = group._id;
      const absenceRecords = group.absences;
      
      const compensations = await CompensationRecord.find({ 
        studentId 
      });

      const existingTokens = await CompensationToken.find({
        studentId,
        generatedFrom: { $in: absenceRecords.map(a => a._id) }
      });
      const tokenAbsenceIds = new Set(existingTokens.map(t => t.generatedFrom.toString()));

      for (const absence of absenceRecords) {
        if (tokenAbsenceIds.has(absence._id.toString())) continue;
        
        const isCompensated = compensations.some(c => {
          const compDate = new Date(c.date);
          const absentDate = new Date(absence.date);
          return compDate.toDateString() === absentDate.toDateString();
        });

        if (!isCompensated) {
          const generatedDate = new Date(absence.date);
          const expiryDate = new Date(generatedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (expiryDate > new Date()) {
            const token = new CompensationToken({
              studentId,
              generatedFrom: absence._id,
              generatedDate: generatedDate,
              status: 'available',
              reason: 'absence',
              expiryDate: expiryDate,
              notes: `Auto-generated from attendance on ${absence.date}`
            });
            await token.save();
            tokensCreated++;
            console.log(`✅ Token created for student ${studentId} from ${absence.date}`);
          }
        }
      }
    }

    console.log(`\n✅ Migration complete! Created ${tokensCreated} compensation tokens.`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📌 Database connection closed');
    process.exit(0);
  }
}

runMigration();