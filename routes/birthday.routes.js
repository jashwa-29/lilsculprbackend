const express = require('express');
const router = express.Router();
const birthdayController = require('../controllers/birthday.controller');

// Sync birthdays
router.post('/sync', birthdayController.syncBirthdays);

// Get today's birthdays
router.get('/today', birthdayController.getTodayBirthdays);

// Get upcoming birthdays
router.get('/upcoming', birthdayController.getUpcomingBirthdays);

// Get all birthdays
router.get('/', birthdayController.getAllBirthdays);

// Update birthday
router.put('/:id', birthdayController.updateBirthday);

// Delete birthday
router.delete('/:id', birthdayController.deleteBirthday);

module.exports = router;
