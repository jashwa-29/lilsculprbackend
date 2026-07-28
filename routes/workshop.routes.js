const express = require('express');
const router = express.Router();
const workshopController = require('../controllers/workshop.controller');

router.get('/active', workshopController.getActive);
router.get('/', workshopController.getAll);
router.get('/:id', workshopController.getById);
router.post('/', workshopController.create);
router.put('/:id', workshopController.update);
router.delete('/:id', workshopController.remove);

module.exports = router;