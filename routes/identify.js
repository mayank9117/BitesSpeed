const express = require('express');
const router = express.Router();
const identifyController = require('../controllers/identifyController');

// Define the POST /identify route
router.post('/', identifyController.identify);

module.exports = router;
