const express = require('express');
const router = express.Router();
const Display = require('../models/Displayy');
const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');
const Department = require('../models/Department');

// Get all displays
router.get('/', async (req, res) => {
  try {
    const displays = await Display.find().populate('department');
    res.json(displays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get display by ID
router.get('/:id', async (req, res) => {
  try {
    const display = await Display.findById(req.params.id).populate('department');
    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }
    res.json(display);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update display settings
router.put('/:id', async (req, res) => {
  try {
    const display = await Display.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('department');
    
    const io = req.app.get('io');
    io.emit('display-updated', display);
    
    res.json(display);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get display data with ACTIVE counters only
router.get('/:id/data', async (req, res) => {
  try {
    const display = await Display.findById(req.params.id).populate('department');
    
    // Get only ACTIVE counters (active or busy status)
    const counters = await Counter.find({
      status: { $in: ['active', 'busy'] }
    })
      .populate('department')
      .populate('currentTicket')
      .sort('counterNumber');

    console.log(`Found ${counters.length} active counters`);

    // Get current called tickets
    const currentTickets = await Ticket.find({
      status: { $in: ['called', 'serving'] }
    })
      .populate('department')
      .populate('assignedCounter')
      .limit(5);

    // Get department counts
    const departments = await Department.find({ active: true });
    const departmentCounts = await Promise.all(
      departments.map(async (dept) => {
        const count = await Ticket.countDocuments({
          department: dept._id,
          status: 'waiting'
        });
        return {
          _id: dept._id,
          name: dept.name,
          waitingCount: count
        };
      })
    );

    const displayData = {
      display: display || {
        _id: req.params.id,
        name: 'Waiting Area Display',
        type: 'waiting'
      },
      currentTickets: currentTickets || [],
      departmentCounts: departmentCounts || [],
      counters: counters || [],
      lastUpdated: new Date()
    };

    res.json(displayData);
  } catch (error) {
    console.error('Error fetching display data:', error);
    
    // Return fallback data with empty counters
    const fallbackData = {
      display: {
        _id: req.params.id,
        name: 'Waiting Area Display',
        type: 'waiting'
      },
      currentTickets: [],
      departmentCounts: [],
      counters: [],
      lastUpdated: new Date()
    };
    
    res.json(fallbackData);
  }
});

module.exports = router;