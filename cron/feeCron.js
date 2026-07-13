const cron = require('node-cron');
const { runFeeReminders } = require('../controllers/feeCron.controller');

// Check if cron should be initialized (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  // Run on the 3rd of every month at 9:00 AM (early reminder)
  cron.schedule('0 9 3 * *', async () => {
    console.log('📅 Running early fee reminder (3rd)...');
    try {
      await runFeeReminders();
    } catch (error) {
      console.error('❌ Fee reminder cron failed:', error);
    }
  });

  // Run on the 5th of every month at 9:00 AM (final reminder)
  cron.schedule('0 9 5 * *', async () => {
    console.log('📅 Running final fee reminder (5th)...');
    try {
      await runFeeReminders();
    } catch (error) {
      console.error('❌ Fee reminder cron failed:', error);
    }
  });

  console.log('✅ Fee reminder cron scheduler initialized');
}

module.exports = { runFeeReminders };
