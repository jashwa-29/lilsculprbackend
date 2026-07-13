const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { runFeeReminders } = require('../controllers/feeCron.controller');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function sendReminders() {
  try {
    const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
    if (!dbUri) throw new Error('No DB URI found in .env');

    await mongoose.connect(dbUri);
    console.log('✅ MongoDB connected');

    const result = await runFeeReminders();
    console.log('📊 Results:', result);

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📌 Database connection closed');
    process.exit(0);
  }
}

sendReminders();
