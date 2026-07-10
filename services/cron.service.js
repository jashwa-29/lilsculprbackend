const cron = require('node-cron');
const CompensationToken = require('../models/CompensationToken.model');

// Run every day at midnight (0 0 * * *)
cron.schedule('0 0 * * *', async () => {
  console.log('🕒 Running daily token expiration check...');
  try {
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
    console.error('❌ Token expiry cron failed:', error);
  }
});

console.log('✅ Cron scheduler initialized');
