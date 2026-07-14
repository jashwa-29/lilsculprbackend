const Student = require('../models/student.model');

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
        const FeeRecord = require('../models/FeeRecord.model');
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

        // 4. Update the student's paymentStatus if it has changed
        if (student.paymentStatus !== overallStatus) {
            student.paymentStatus = overallStatus;
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
    syncStudentPaymentStatus
};
