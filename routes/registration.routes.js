// registration.routes.js - Updated version with offline registration
const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const {
  validateRegistration,
  createRegistrationAfterPayment,
  createOfflineRegistration,          // Add this
  validateOfflineRegistration,        // Add this
  getRegistrations,
  getRegistrationById,
  getRegistrationByNumber,
  updateRegistration,
  deleteRegistration,
  getNextRegistrationNumber,
  getLastRegistrationNumber,
  getRegistrationStats,
  getDashboardStats,
  toggleActiveStatus,
  bulkUpdateStatus,
  hardDeleteRegistration
} = require("../controllers/registration.controller");

// ========== PUBLIC ROUTES ==========

// Step 1: Validate registration before payment
router.post("/validate", upload.single("childPhoto"), validateRegistration);

// Step 2: Create registration after successful payment
router.post("/create-after-payment", upload.single("childPhoto"), createRegistrationAfterPayment);

// ========== ADMIN ROUTES ==========

// OFFLINE REGISTRATION ROUTES (For admin use)
router.post("/offline/validate", upload.single("childPhoto"), validateOfflineRegistration);
router.post("/offline/create", upload.single("childPhoto"), createOfflineRegistration);

// STATS ROUTES
router.get("/stats", getRegistrationStats);
router.get("/stats/overview", getDashboardStats);

// REGISTRATION NUMBER ROUTES
router.get("/next-number", getNextRegistrationNumber);
router.get("/last-number", getLastRegistrationNumber);

// REGISTRATIONS COLLECTION ROUTES
router.get("/", getRegistrations);

// BULK OPERATIONS
router.patch("/bulk-status", bulkUpdateStatus);

// PARAMETERIZED ROUTES
router.get("/number/:registrationNo", getRegistrationByNumber);
router.patch("/:id/toggle-active", toggleActiveStatus);
router.get("/:id", getRegistrationById);
router.put("/:id", upload.single("childPhoto"), updateRegistration);
router.delete("/:id", deleteRegistration);
router.delete("/:id/hard", hardDeleteRegistration);

module.exports = router;