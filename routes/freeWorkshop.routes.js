const express = require('express');
const router = express.Router();
const freeWorkshopController = require('../controllers/freeWorkshop.controller');

// Route to register for the free workshop
router.post('/register', freeWorkshopController.registerForWorkshop);

// Route to get real-time slot availability
router.get('/slots', freeWorkshopController.getWorkshopSlots);

// Route to get all registrations (admin use)
router.get('/', freeWorkshopController.getAllRegistrations);

module.exports = router;
