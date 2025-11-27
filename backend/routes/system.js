const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const Department = require('../models/Department');
const Display = require('../models/Displayy');
const Activity = require('../models/Activity');

// Delete all system data (except settings)
router.delete('/delete-all-data', async (req, res) => {
  try {
    // Delete all data from collections except SystemSetting
    await Promise.all([
      Ticket.deleteMany({}),
      Counter.updateMany({}, {
        $set: {
          currentTicket: null,
          status: 'active'
        }
      }),
      Department.updateMany({}, {
        $set: {
          currentSequence: 0
        }
      }),
      Activity.deleteMany({}),
      Display.updateMany({}, {
        $set: {
          currentContent: null,
          lastUpdated: new Date()
        }
      })
    ]);

    // Log the activity (this will be the only activity left)
    await Activity.create({
      action: 'ALL_DATA_DELETED',
      details: 'All system data was deleted by administrator',
      timestamp: new Date()
    });

    const io = req.app.get('io');
    io.emit('all-data-deleted');

    res.json({ 
      message: 'All data deleted successfully',
      deleted: {
        tickets: 'all',
        activities: 'all',
        counters: 'reset',
        departments: 'reset',
        displays: 'reset'
      }
    });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset system
router.post('/reset', async (req, res) => {
  try {
    // Clear all tickets
    await Ticket.deleteMany({});
    
    // Reset counters
    await Counter.updateMany({}, {
      $set: {
        currentTicket: null,
        status: 'active'
      }
    });

    // Reset departments sequence
    await Department.updateMany({}, {
      $set: {
        currentSequence: 0
      }
    });

    // Log activity
    await Activity.create({
      action: 'SYSTEM_RESET',
      details: 'System was reset to initial state',
      timestamp: new Date()
    });

    const io = req.app.get('io');
    io.emit('system-reset');

    res.json({ message: 'System reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system status
router.get('/status', async (req, res) => {
  try {
    const [
      totalTickets,
      waitingTickets,
      activeCounters,
      totalCounters
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'waiting' }),
      Counter.countDocuments({ status: 'active' }),
      Counter.countDocuments()
    ]);

    res.json({
      totalTickets,
      waitingTickets,
      activeCounters,
      totalCounters,
      systemStatus: 'running',
      lastUpdate: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;