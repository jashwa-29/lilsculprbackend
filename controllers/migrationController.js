// lilsculprbackend/controllers/migrationController.js
const Student = require('../models/student.model');
const Batch = require('../models/Batch.model');
const fs = require('fs');
const path = require('path');

exports.linkStudentsToBatches = async (req, res) => {
    try {
        const { dryRun = false } = req.query; // Add dryRun option via query param
        
        console.log('🔄 Starting student-batch linking migration...');
        console.log(`📋 Dry run mode: ${dryRun}`);
        
        // Get all active students and batches
        const students = await Student.find({ status: 'active' });
        const batches = await Batch.find({ status: 'active' });
        
        if (!students.length || !batches.length) {
            return res.status(400).json({
                success: false,
                message: 'No students or batches found to process'
            });
        }
        
        // Create batch lookup map
        const batchLookup = {};
        batches.forEach(batch => {
            const key = `${batch.type}|${batch.dayId}|${batch.time}`;
            batchLookup[key] = batch;
        });
        
        // Track results
        const results = {
            totalStudents: students.length,
            totalBatches: batches.length,
            updated: [],
            alreadyLinked: [],
            noMatch: [],
            errors: [],
            skipped: []
        };
        
        // Process each student
        for (const student of students) {
            try {
                // Check if student already has a valid batch reference
                if (student.batchId) {
                    const existingBatch = await Batch.findById(student.batchId);
                    if (existingBatch) {
                        results.alreadyLinked.push({
                            studentId: student._id,
                            name: student.childName,
                            enrollmentId: student.enrollmentId,
                            batchId: existingBatch._id,
                            batchDetails: `${existingBatch.type}|${existingBatch.dayId}|${existingBatch.time}`
                        });
                        continue;
                    }
                }
                
                // Build lookup key
                const studentKey = `${student.classType}|${student.dayId}|${student.time}`;
                const matchingBatch = batchLookup[studentKey];
                
                if (matchingBatch) {
                    // Only update if not in dry run mode
                    if (dryRun === 'false' || dryRun === false) {
                        await Student.findByIdAndUpdate(student._id, {
                            $set: { 
                                batchId: matchingBatch._id
                            }
                        });

                        // Also add student to batch's enrolledStudents if not already there
                        if (!matchingBatch.enrolledStudents.includes(student._id)) {
                            matchingBatch.enrolledStudents.push(student._id);
                            await matchingBatch.save();
                        }
                    }
                    
                    results.updated.push({
                        studentId: student._id,
                        name: student.childName,
                        enrollmentId: student.enrollmentId,
                        oldKey: studentKey,
                        newBatchId: matchingBatch._id,
                        newBatchDetails: `${matchingBatch.type}|${matchingBatch.dayId}|${matchingBatch.time}`,
                        dryRun: dryRun === 'true' || dryRun === true
                    });
                } else {
                    results.noMatch.push({
                        studentId: student._id,
                        name: student.childName,
                        enrollmentId: student.enrollmentId,
                        key: studentKey,
                        classType: student.classType,
                        dayId: student.dayId,
                        time: student.time
                    });
                }
                
            } catch (error) {
                results.errors.push({
                    studentId: student._id,
                    name: student.childName,
                    error: error.message
                });
            }
        }
        
        // Generate summary
        const summary = {
            totalProcessed: students.length,
            updated: results.updated.length,
            alreadyLinked: results.alreadyLinked.length,
            noMatch: results.noMatch.length,
            errors: results.errors.length,
            dryRun: dryRun === 'true' || dryRun === true
        };
        
        // Create backup and report (only if not dry run)
        if (dryRun === 'false' || dryRun === false) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(__dirname, '../migration-backups');
            
            // Create backup directory if it doesn't exist
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // Save backup of active students before migration
            const backupFile = path.join(backupDir, `students-backup-${timestamp}.json`);
            const studentData = await Student.find({ status: 'active' }).lean();
            fs.writeFileSync(backupFile, JSON.stringify(studentData, null, 2));
            
            // Save report
            const reportFile = path.join(backupDir, `migration-report-${timestamp}.json`);
            fs.writeFileSync(reportFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                summary,
                results
            }, null, 2));

            console.log(`✅ Backup saved to: ${backupFile}`);
            console.log(`📋 Report saved to: ${reportFile}`);
        }
        
        // Send response
        res.status(200).json({
            success: true,
            message: dryRun === 'true' || dryRun === true 
                ? 'Dry run completed - no changes were made' 
                : 'Migration completed successfully',
            summary,
            details: results,
            // Show first few examples for preview
            preview: {
                updated: results.updated.slice(0, 5),
                alreadyLinked: results.alreadyLinked.slice(0, 5),
                noMatch: results.noMatch.slice(0, 5)
            }
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    }
};
