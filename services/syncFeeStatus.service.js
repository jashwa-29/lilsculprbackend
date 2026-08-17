const Student = require('../models/student.model');
const FeeRecord = require('../models/FeeRecord.model');

// Month ordering helper for chronological comparisons
const MONTH_INDEX = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
};

const monthYearToValue = (month, year) => Number(year) * 12 + (MONTH_INDEX[month] || 0);

/**
 * Determine the month a student should start being billed from,
 * using feeStartMonth → feeStartDate → createdAt in that order.
 * Returns a numeric (year*12 + month) value.
 */
function getStudentStartValue(student) {
  if (student.feeStartMonth) {
    const parts = String(student.feeStartMonth).split(' ');
    if (parts.length >= 2) {
      const m = MONTH_INDEX[parts[0]];
      const y = parseInt(parts[1]);
      if (m && !isNaN(y)) return monthYearToValue(parts[0], y);
    }
  }
  if (student.feeStartDate) {
    const d = new Date(student.feeStartDate);
    return d.getFullYear() * 12 + (d.getMonth() + 1);
  }
  if (student.createdAt) {
    const d = new Date(student.createdAt);
    return d.getFullYear() * 12 + (d.getMonth() + 1);
  }
  return 1;
}

/**
 * Auto-bill active/paused students for a given month/year.
 * Creates a FeeRecord (Pending, or Paid if it's the student's enrollment
 * month and their admission payment is Completed) whenever one is missing.
 * This is idempotent — existing records are never touched.
 *
 * @param {object} opts { month, year, studentId? } — defaults to current month
 * @returns {Promise<{created: number, total: number}>}
 */
async function ensureMonthlyFeeRecords({ month, year, studentId } = {}) {
  const now = new Date();
  const targetMonth = month || now.toLocaleString('en-IN', { month: 'long' });
  const targetYear = Number(year) || now.getFullYear();
  const targetValue = monthYearToValue(targetMonth, targetYear);
  const currentValue = monthYearToValue(
    now.toLocaleString('en-IN', { month: 'long' }),
    now.getFullYear()
  );

  // Never bill for future months
  if (targetValue > currentValue) {
    return { created: 0, total: 0 };
  }

  const query = { status: { $in: ['active', 'paused'] } };
  if (studentId) query._id = studentId;
  const students = await Student.find(query);

  let created = 0;
  for (const student of students) {
    // Skip students who weren't enrolled yet in the target month
    if (targetValue < getStudentStartValue(student)) continue;

    const existing = await FeeRecord.findOne({
      studentId: student._id,
      month: targetMonth,
      year: targetYear
    });
    if (existing) continue;

    const baseFee = student.classType === 'offline' ? 2500 : 2200;
    const isEnrollmentMonth = targetValue === getStudentStartValue(student);
    const isPaid = isEnrollmentMonth && student.paymentStatus === 'Completed';

    await FeeRecord.create({
      studentId: student._id,
      enrollmentId: student.enrollmentId,
      childName: student.childName,
      parentName: student.parentName,
      email: student.email,
      contact1: student.contact1,
      month: targetMonth,
      year: targetYear,
      amount: baseFee,
      status: isPaid ? 'Paid' : 'Pending',
      paymentMethod: isPaid ? (student.paymentMethod || 'Razorpay') : null,
      paidAt: isPaid ? new Date() : null,
      notes: isPaid
        ? 'First month fee paid via enrollment (auto-billed)'
        : `Monthly fee auto-billed for ${targetMonth} ${targetYear}`
    });
    created++;
  }

  if (created > 0) {
    console.log(`✅ Auto-billed ${created} missing fee record(s) for ${targetMonth} ${targetYear}`);
  }
  return { created, total: students.length };
}

/**
 * Synchronizes the payment status of a student with their fee records.
 * If all fee records for a student are 'Paid', the student's paymentStatus becomes 'Completed'.
 * If any fee record is 'Pending', the student's paymentStatus becomes 'Pending'.
 * 
 * This ensures consistency between the Student and FeeRecord collections.
 */
async function syncStudentPaymentStatus(studentId) {
    try {
        // 1. Fetch the student
        const student = await Student.findById(studentId);
        if (!student) {
            console.warn(`Sync failed: Student not found for ID ${studentId}`);
            return false;
        }

        // 2. Fetch ALL fee records for this student
        const feeRecords = await FeeRecord.find({ studentId });

        // 3. Determine overall status
        let overallStatus = 'Pending'; // Default

        // If there are no fee records, do not change the student's status (or set to Pending)
        // This handles the case where a student is newly enrolled with pending first month.
        if (feeRecords.length === 0) {
            // Keep as is, or set to pending if it was completed somehow.
            // We'll keep the existing logic to not force it.
            return true;
        }

        // Check if ALL fee records are 'Paid'
        const allPaid = feeRecords.every(record => record.status === 'Paid');
        
        if (allPaid) {
            overallStatus = 'Completed';
        } else {
            overallStatus = 'Pending'; // Set to Pending if at least one is pending
        }

        // 4. Update the student's paymentStatus if it has changed, or if razorpayPaymentId needs clearing
        let needsSave = false;

        if (student.paymentStatus !== overallStatus) {
            student.paymentStatus = overallStatus;
            needsSave = true;
        }

        if (overallStatus === 'Completed' && student.razorpayPaymentId && student.razorpayPaymentId.startsWith('PENDING-')) {
            student.razorpayPaymentId = `MANUAL-${Date.now()}`;
            needsSave = true;
        }

        if (overallStatus === 'Completed' && (!student.amountPaid || student.amountPaid === 0) && feeRecords.length > 0) {
            student.amountPaid = feeRecords[0].amount;
            needsSave = true;
        }

        if (needsSave) {
            await student.save();
            console.log(`✅ Synced student ${student.childName} (${student.enrollmentId}) paymentStatus to ${overallStatus}`);
        }

        return true;

    } catch (error) {
        console.error(`❌ Error syncing payment status for student ${studentId}:`, error);
        return false;
    }
}

// Export the function so it can be used in controllers
module.exports = {
    syncStudentPaymentStatus,
    ensureMonthlyFeeRecords
};
