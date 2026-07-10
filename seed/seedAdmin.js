/**
 * seedAdmin.js
 * Run once to seed the default superadmin account.
 * Usage: node seed/seedAdmin.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Admin = require('../models/Admin.model');

const ADMIN_SEED = {
  name: 'Lil Sculpr Admin',
  email: process.env.ADMIN_EMAIL || 'admin@lilsculpr.com',
  password: process.env.ADMIN_SEED_PASSWORD || 'LilSculpr@2026!',
  role: 'superadmin',
  isActive: true,
};

async function seedAdmin() {
  try {
    const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
    if (!dbUri) throw new Error('No DB URI found in .env');

    await mongoose.connect(dbUri);
    console.log('✅ MongoDB connected');

    const existing = await Admin.findOne({ email: ADMIN_SEED.email });
    if (existing) {
      console.log(`⚠️  Admin already exists: ${existing.email}`);
      console.log('   To reset password, delete the document and re-run this script.');
    } else {
      const admin = new Admin(ADMIN_SEED);
      await admin.save();
      console.log('✅ Superadmin seeded successfully!');
      console.log(`   Email   : ${ADMIN_SEED.email}`);
      console.log(`   Password: ${ADMIN_SEED.password}`);
      console.log('   ⚠️  Change the password after first login!');
    }
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedAdmin();
