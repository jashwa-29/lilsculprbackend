const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const Student = require('../models/student.model');
const FeeRecord = require('../models/FeeRecord.model');

/**
 * Backfill razorpayOrderId / razorpayPaymentId on existing FeeRecords.
 *
 * Sources:
 *  1. The Student's razorpayOrderId / razorpayPaymentId for the enrollment (first) month.
 *  2. The FeeRecord.notes field, which stores payment refs like:
 *       - "Paid via Razorpay - pay_XXXX"
 *       - "MANUAL-XXXX"
 *       - "OFFLINE-XXXX"
 *       - "PENDING-XXXX"
 */
async function backfillFeePaymentIds() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lilsculpr');
    console.log('✅ Connected to MongoDB');

    const students = await Student.find({});
    let updated = 0;

    for (const student of students) {
      const studentRzpOrder = student.razorpayOrderId || null;
      const studentRzpPayment = student.razorpayPaymentId || null;

      // Parse enrollment month/year from feeStartMonth ("June 2026")
      let enrollMonth = null;
      let enrollYear = null;
      if (student.feeStartMonth) {
        const parts = String(student.feeStartMonth).trim().split(/\s+/);
        enrollMonth = parts[0] || null;
        enrollYear = parts[1] ? Number(parts[1]) : null;
      }

      const fees = await FeeRecord.find({ studentId: student._id });
      for (const fee of fees) {
        let orderId = fee.razorpayOrderId || null;
        let paymentId = fee.razorpayPaymentId || null;

        // 1. Enrollment month → use the student's payment details
        if (enrollMonth && fee.month === enrollMonth && Number(fee.year) === enrollYear) {
          orderId = orderId || studentRzpOrder;
          paymentId = paymentId || studentRzpPayment;
        }

        // 2. Parse payment reference out of notes
        if (!paymentId && fee.notes) {
          const rzpMatch = String(fee.notes).match(/Razorpay\s*-\s*([A-Za-z0-9_\-]+)/i);
          if (rzpMatch) paymentId = rzpMatch[1];

          const refMatch = String(fee.notes).match(/\b(MANUAL|OFFLINE|PENDING)-[A-Za-z0-9_\-]+/);
          if (!paymentId && refMatch) paymentId = refMatch[0];
        }

        if ((orderId && orderId !== fee.razorpayOrderId) || (paymentId && paymentId !== fee.razorpayPaymentId)) {
          if (orderId) fee.razorpayOrderId = orderId;
          if (paymentId) fee.razorpayPaymentId = paymentId;
          await fee.save();
          updated++;
          console.log(`  📌 ${student.childName} · ${fee.month} ${fee.year} → order: ${orderId || '—'}, payment: ${paymentId || '—'}`);
        }
      }
    }

    console.log(`\n✅ Backfill complete! Updated ${updated} fee records.`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📌 Database connection closed');
    process.exit(0);
  }
}

backfillFeePaymentIds();