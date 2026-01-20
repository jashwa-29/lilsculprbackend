// test-email.js
require('dotenv').config(); // Load environment variables
const { sendRegistrationConfirmationEmail } = require('./services/emailService');

console.log('Testing email configuration...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);

// Test data - Use a REAL email address for testing
const testRegistration = {
  registrationNo: 'TEST001',
  child: {
    fullName: 'Test Child',
    age: 8,
    grade: '3rd Grade',
    schoolName: 'Test School'
  },
  guardian: {
    email: 'jashwa4673@gmail.com', // ⚠️ CHANGE THIS TO A REAL EMAIL
    primaryGuardianName: 'Test Parent',
    phone: '9876543210'
  },
  courseDetails: {
    courseName: 'Clay Modeling - Beginners',
    levelEnrolled: 'beginner',
    timings: '4pm-5pm',
    weekdays: ['Mon', 'Wed'],
    weekend: []
  },
  emergencyContact: {
    fullName: 'Emergency Contact',
    phone: '9876543211'
  }
};

const testPayment = {
  paymentId: 'pay_TEST123',
  paymentDate: new Date(),
  amount: '7000'
};

// Validate test data
console.log('Validating test data...');
if (!testRegistration.guardian.email || !testRegistration.guardian.email.includes('@')) {
  console.error('❌ Please provide a valid email address in testRegistration.guardian.email');
  process.exit(1);
}

// Test the email
console.log('Starting email test...');
sendRegistrationConfirmationEmail(testRegistration, testPayment)
  .then(result => {
    console.log('Test result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });