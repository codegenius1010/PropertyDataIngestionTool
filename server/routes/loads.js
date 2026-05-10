const express = require('express');
const loadsController = require('../controllers/loadsController');

const router = express.Router();

// Get all loads with pagination
router.get('/', loadsController.getLoads);

// Get single load by ID
router.get('/:loadId', loadsController.getLoadById);

// Get properties for a load
router.get('/:loadId/properties', loadsController.getLoadProperties);

// Get automations log for a load
router.get('/:loadId/automations', loadsController.getLoadAutomations);

// Get load statistics
router.get('/stats/overview', loadsController.getLoadStats);

module.exports = router;
