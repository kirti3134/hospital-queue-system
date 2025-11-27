const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

// Get all active departments with enhanced data
router.get('/', async (req, res) => {
  try {
    const { active = true } = req.query;
    
    const departments = await Department.find({ active: active !== 'false' })
      .populate('counters')
      .sort('name');
    
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const waitingCount = await Ticket.countDocuments({
          department: dept._id,
          status: 'waiting'
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const servedToday = await Ticket.countDocuments({
          department: dept._id,
          status: 'completed',
          servedAt: { $gte: today }
        });

        const activeCounters = await Counter.countDocuments({
          department: dept._id,
          status: { $in: ['active', 'busy'] }
        });

        return {
          _id: dept._id,
          name: dept.name,
          code: dept.code,
          prefix: dept.prefix,
          estimatedWaitTime: dept.estimatedWaitTime,
          active: dept.active,
          displaySettings: dept.displaySettings,
          counters: dept.counters,
          waitingCount,
          servedToday,
          activeCounters,
          totalCounters: dept.counters.length,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt
        };
      })
    );

    res.json(departmentsWithCounts);
  } catch (error) {
    console.error('❌ Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get all departments (including inactive) for admin
router.get('/all', async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('counters')
      .sort('name');
    
    res.json(departments);
  } catch (error) {
    console.error('❌ Error fetching all departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Create department with validation
router.post('/', async (req, res) => {
  try {
    const { name, code, prefix, estimatedWaitTime = 15, displaySettings } = req.body;
    
    // Validate required fields
    if (!name || !code || !prefix) {
      return res.status(400).json({ 
        error: 'Name, code, and prefix are required' 
      });
    }

    // Check if code already exists
    const existingDept = await Department.findOne({ 
      code: code.toUpperCase() 
    });
    
    if (existingDept) {
      return res.status(400).json({ 
        error: 'Department code already exists' 
      });
    }

    const department = new Department({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      prefix: prefix.toUpperCase().trim(),
      estimatedWaitTime: Math.max(5, Math.min(120, estimatedWaitTime)),
      displaySettings: displaySettings || {
        backgroundColor: '#1a5276',
        textColor: '#ffffff',
        showInDispenser: true
      }
    });

    await department.save();
    
    console.log(`✅ Department created: ${name} (${code})`);
    
    res.status(201).json({
      success: true,
      department,
      message: `Department ${name} created successfully`
    });
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({ 
      error: 'Failed to create department',
      details: error.message 
    });
  }
});

// Update department
router.put('/:id', async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({
      success: true,
      department,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating department:', error);
    res.status(500).json({ 
      error: 'Failed to update department',
      details: error.message 
    });
  }
});

// Delete department with enhanced checks
router.delete('/:id', async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if department has counters
    const counterCount = await Counter.countDocuments({ 
      department: department._id 
    });
    
    if (counterCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete department with ${counterCount} active counter(s). Remove counters first.` 
      });
    }

    // Check if department has active tickets
    const activeTickets = await Ticket.countDocuments({
      department: department._id,
      status: { $in: ['waiting', 'called'] }
    });
    
    if (activeTickets > 0) {
      return res.status(400).json({ 
        error: `Cannot delete department with ${activeTickets} active ticket(s) in queue.` 
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    console.log(`✅ Department deleted: ${department.name}`);

    res.json({
      success: true,
      message: `Department ${department.name} deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting department:', error);
    res.status(500).json({ 
      error: 'Failed to delete department',
      details: error.message 
    });
  }
});

// Get department queue
router.get('/:id/queue', async (req, res) => {
  try {
    const tickets = await Ticket.find({
      department: req.params.id,
      status: 'waiting'
    })
    .populate('department', 'name prefix')
    .sort({
      priority: -1, // Emergency, Priority, Normal
      generatedAt: 1 // FIFO for same priority
    })
    .select('ticketNumber patientName priority generatedAt');
    
    res.json(tickets);
  } catch (error) {
    console.error('❌ Error fetching department queue:', error);
    res.status(500).json({ error: 'Failed to fetch department queue' });
  }
});

// Get department statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      waitingCount,
      servedToday,
      totalServed,
      avgWaitTime
    ] = await Promise.all([
      // Waiting count
      Ticket.countDocuments({
        department: department._id,
        status: 'waiting'
      }),
      // Served today
      Ticket.countDocuments({
        department: department._id,
        status: 'completed',
        servedAt: { $gte: today }
      }),
      // Total served
      Ticket.countDocuments({
        department: department._id,
        status: 'completed'
      }),
      // Average wait time
      Ticket.aggregate([
        {
          $match: {
            department: department._id,
            status: 'completed',
            servedAt: { $exists: true },
            calledAt: { $exists: true }
          }
        },
        {
          $project: {
            waitTime: { $subtract: ['$servedAt', '$calledAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgWaitTime: { $avg: '$waitTime' }
          }
        }
      ])
    ]);

    res.json({
      departmentId: department._id,
      departmentName: department.name,
      waitingCount,
      servedToday,
      totalServed,
      avgWaitTime: avgWaitTime[0]?.avgWaitTime || 0,
      estimatedWaitTime: department.estimatedWaitTime,
      activeCounters: department.counters.length
    });
  } catch (error) {
    console.error('❌ Error fetching department stats:', error);
    res.status(500).json({ error: 'Failed to fetch department statistics' });
  }
});

// Toggle department active status
router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    department.active = !department.active;
    await department.save();

    res.json({
      success: true,
      department,
      message: `Department ${department.active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling department status:', error);
    res.status(500).json({ error: 'Failed to toggle department status' });
  }
});

module.exports = router;