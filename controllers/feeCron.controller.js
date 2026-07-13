const Student = require('../models/student.model');
const FeeRecord = require('../models/FeeRecord.model');
const emailService = require('../services/email.service');

/**
 * Get all students with pending fees for the current month
 */
async function getStudentsWithPendingFees() {
  const now = new Date();
  const currentMonth = now.toLocaleString('en-IN', { month: 'long' });
  const currentYear = now.getFullYear();

  const students = await Student.find({
    status: 'active',
    enrollmentStatus: { $in: ['active', 'pending'] }
  });

  const pendingStudents = [];

  for (const student of students) {
    const existingFee = await FeeRecord.findOne({
      studentId: student._id,
      month: currentMonth,
      year: currentYear,
      status: 'Paid'
    });

    if (!existingFee) {
      pendingStudents.push(student);
    }
  }

  return pendingStudents;
}

/**
 * Run the fee reminder cron job
 */
async function runFeeReminders() {
  console.log('🔄 Running monthly fee reminder check...');
  try {
    const pendingStudents = await getStudentsWithPendingFees();
    
    if (pendingStudents.length === 0) {
      console.log('✅ No pending fees found for this month');
      return { success: true, sent: 0, message: 'No pending fees' };
    }

    console.log(`📧 Sending reminders to ${pendingStudents.length} students`);
    const result = await emailService.sendBulkFeeReminders(pendingStudents);
    
    console.log(`✅ Reminders sent: ${result.sent}, Failed: ${result.failed}`);
    return { success: true, ...result };

  } catch (error) {
    console.error('❌ Fee reminder cron failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  runFeeReminders,
  getStudentsWithPendingFees
};
