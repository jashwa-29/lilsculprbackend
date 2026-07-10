const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin.model');

/**
 * Middleware: Verify JWT token and attach admin to req
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: 'Admin account not found or deactivated.' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed.' });
  }
};

/**
 * Middleware: Require superadmin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Access denied. Superadmin only.' });
  }
  next();
};

module.exports = { protect, requireSuperAdmin };
