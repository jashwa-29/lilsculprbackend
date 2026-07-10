const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin.model');

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate JWT token
 */
const generateToken = (admin) => {
  return jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // Check if account is locked
    if (admin.isLocked()) {
      const remaining = Math.ceil((admin.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    // Lock has expired — reset attempts so the counter doesn't carry over
    if (admin.lockedUntil && admin.lockedUntil < new Date()) {
      admin.loginAttempts = 0;
      admin.lockedUntil = null;
      await admin.save();
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated. Contact support.' });
    }

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      admin.loginAttempts += 1;
      if (admin.loginAttempts >= MAX_ATTEMPTS) {
        admin.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await admin.save();
        return res.status(423).json({
          success: false,
          error: `Too many failed attempts. Account locked for 15 minutes.`,
        });
      }
      await admin.save();
      const remaining = MAX_ATTEMPTS - admin.loginAttempts;
      return res.status(401).json({
        success: false,
        error: `Invalid credentials. ${remaining} attempt(s) remaining.`,
      });
    }

    // Successful login — reset attempts
    admin.loginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin);

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

/**
 * GET /api/auth/me
 * Returns current admin info from token
 */
exports.getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      admin: {
        id: req.admin._id,
        name: req.admin.name,
        email: req.admin.email,
        role: req.admin.role,
        lastLogin: req.admin.lastLogin,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin info.' });
  }
};

/**
 * POST /api/auth/logout
 * Client-side logout (just for consistency — token invalidation is client-side)
 */
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};
