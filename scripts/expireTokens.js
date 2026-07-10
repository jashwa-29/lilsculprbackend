const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CompensationToken = require('../models/CompensationToken.model');

async function expireTokens() {
  try {
    const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
    if (!dbUri) throw new Error('No DB URI found in .env');

    await mongoose.connect(dbUri);
    console.log('✅ MongoDB connected');

    const now = new Date();
    const result = await CompensationToken.updateMany(
      {
        status: 'available',
        expiryDate: { $lte: now }
      },
      { $set: { status: 'expired' } }
    );

    console.log(`✅ Expired ${result.modifiedCount} tokens`);

  } catch (error) {
    console.error('❌ Token expiry failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📌 Database connection closed');
    process.exit(0);
  }
}

expireTokens();
