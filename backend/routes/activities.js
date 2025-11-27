const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');

// Get all activities
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const activities = await Activity.find()
      .populate('ticket')
      .populate('counter')
      .populate('department')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;