const express = require('express');
const router = express.Router();
const Counter = require('../models/Counter');
const Ticket = require('../models/Ticket');
const Activity = require('../models/Activity');
const Department = require('../models/Department');

// Get all counters with enhanced population
router.get('/', async (req, res) => {
  try {
    const counters = await Counter.find()
      .populate('department', 'name code prefix')
      .populate({
        path: 'currentTicket',
        populate: {
          path: 'department',
          select: 'name code'
        }
      })
      .sort('counterNumber');
    
    res.json(counters);
  } catch (error) {
    console.error('❌ Error fetching counters:', error);
    res.status(500).json({ error: 'Failed to fetch counters' });
  }
});

// Get counter by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate({
        path: 'currentTicket',
        populate: {
          path: 'department',
          model: 'Department'
        }
      });

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    // Get queue for this counter's department
    const queue = await Ticket.find({
      department: counter.department._id,
      status: 'waiting'
    }).sort({
      priority: -1,
      generatedAt: 1
    });

    res.json({
      counter,
      queue,
      waitingCount: queue.length
    });
  } catch (error) {
    console.error('❌ Error fetching counter details:', error);
    res.status(500).json({ error: 'Failed to fetch counter details' });
  }
});

// Get counter full details with queue
router.get('/:id/full-details', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate({
        path: 'currentTicket',
        populate: {
          path: 'department',
          model: 'Department'
        }
      });

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    const queue = await Ticket.find({
      department: counter.department._id,
      status: 'waiting'
    }).sort({
      priority: -1,
      generatedAt: 1
    });

    res.json({
      counter,
      queue,
      waitingCount: queue.length
    });
  } catch (error) {
    console.error('❌ Error fetching counter full details:', error);
    res.status(500).json({ error: 'Failed to fetch counter details' });
  }
});

// Get active counters only
router.get('/status/active', async (req, res) => {
  try {
    const activeCounters = await Counter.find({
      status: { $in: ['active', 'busy'] }
    })
      .populate('department', 'name code')
      .populate({
        path: 'currentTicket',
        select: 'ticketNumber patientName calledAt'
      })
      .sort('counterNumber');

    console.log(`✅ Active counters: ${activeCounters.length}`);
    res.json(activeCounters);
  } catch (error) {
    console.error('❌ Error fetching active counters:', error);
    res.status(500).json({ error: 'Failed to fetch active counters' });
  }
});

// Enhanced call next ticket with better error handling
router.post('/:id/call-next', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate('currentTicket');

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    if (counter.status === 'offline' || counter.status === 'break') {
      return res.status(400).json({ error: 'Counter is not active' });
    }

    // Find next ticket with priority handling
    const nextTicket = await Ticket.findOne({
      department: counter.department._id,
      status: 'waiting'
    }).sort({
      priority: -1,
      generatedAt: 1
    });

    if (!nextTicket) {
      return res.status(404).json({ error: 'No tickets in queue for this department' });
    }

    // Update ticket status
    nextTicket.status = 'called';
    nextTicket.assignedCounter = counter._id;
    nextTicket.calledAt = new Date();
    await nextTicket.save();

    // Update counter
    counter.currentTicket = nextTicket._id;
    counter.status = 'busy';
    counter.lastActivity = new Date();
    await counter.save();

    // Populate data for response
    const populatedTicket = await Ticket.findById(nextTicket._id)
      .populate('department')
      .populate('assignedCounter');

    const populatedCounter = await Counter.findById(counter._id)
      .populate('department')
      .populate('currentTicket');

    // Log activity
    await Activity.create({
      action: 'TICKET_CALLED',
      ticket: nextTicket._id,
      counter: counter._id,
      details: `Ticket ${nextTicket.ticketNumber} called to Counter ${counter.counterNumber}`,
      user: req.user?._id || 'system'
    });

    // Real-time updates
    const io = req.app.get('io');
    
    // Emit to all waiting areas
    io.emit('token-called', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    // Emit to specific counter room
    io.to(`counter-${counter._id}`).emit('counter-ticket-called', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    console.log(`✅ Ticket ${nextTicket.ticketNumber} called to Counter ${counter.counterNumber}`);

    res.json({
      success: true,
      ticket: populatedTicket,
      counter: populatedCounter,
      message: `Ticket ${nextTicket.ticketNumber} called successfully`
    });

  } catch (error) {
    console.error('❌ Error calling next ticket:', error);
    res.status(500).json({ 
      error: 'Failed to call next ticket',
      details: error.message 
    });
  }
});

// Complete current ticket
router.post('/:id/complete', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate('currentTicket');

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    if (!counter.currentTicket) {
      return res.status(400).json({ error: 'No active ticket to complete' });
    }

    const ticket = counter.currentTicket;

    // Update ticket
    ticket.status = 'completed';
    ticket.servedAt = new Date();
    await ticket.save();

    // Update counter
    counter.currentTicket = null;
    counter.status = 'active';
    counter.ticketsServedToday = (counter.ticketsServedToday || 0) + 1;
    counter.lastActivity = new Date();
    await counter.save();

    // Populate data for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('department');

    const populatedCounter = await Counter.findById(counter._id)
      .populate('department');

    // Log activity
    await Activity.create({
      action: 'TICKET_COMPLETED',
      ticket: ticket._id,
      counter: counter._id,
      details: `Ticket ${ticket.ticketNumber} completed at Counter ${counter.counterNumber}`,
      user: req.user?._id || 'system'
    });

    // Real-time updates
    const io = req.app.get('io');
    io.emit('token-completed', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    io.to(`counter-${counter._id}`).emit('counter-ticket-completed', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    console.log(`✅ Ticket ${ticket.ticketNumber} completed at Counter ${counter.counterNumber}`);

    res.json({
      success: true,
      ticket: populatedTicket,
      counter: populatedCounter,
      message: `Ticket ${ticket.ticketNumber} completed successfully`
    });

  } catch (error) {
    console.error('❌ Error completing ticket:', error);
    res.status(500).json({ 
      error: 'Failed to complete ticket',
      details: error.message 
    });
  }
});

// Recall current ticket
router.post('/:id/recall', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate('currentTicket');

    if (!counter || !counter.currentTicket) {
      return res.status(404).json({ error: 'No active ticket to recall' });
    }

    const ticket = counter.currentTicket;

    // Populate data for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('department')
      .populate('assignedCounter');

    const populatedCounter = await Counter.findById(counter._id)
      .populate('department')
      .populate('currentTicket');

    // Log activity
    await Activity.create({
      action: 'TICKET_RECALLED',
      ticket: ticket._id,
      counter: counter._id,
      details: `Ticket ${ticket.ticketNumber} recalled at Counter ${counter.counterNumber}`,
      user: req.user?._id || 'system'
    });

    // Real-time updates
    const io = req.app.get('io');
    io.emit('token-recalled', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    io.to(`counter-${counter._id}`).emit('counter-ticket-recalled', {
      ticket: populatedTicket,
      counter: populatedCounter
    });

    console.log(`🔁 Ticket ${ticket.ticketNumber} recalled at Counter ${counter.counterNumber}`);

    res.json({
      success: true,
      ticket: populatedTicket,
      counter: populatedCounter,
      message: `Ticket ${ticket.ticketNumber} recalled successfully`
    });

  } catch (error) {
    console.error('❌ Error recalling ticket:', error);
    res.status(500).json({ 
      error: 'Failed to recall ticket',
      details: error.message 
    });
  }
});

// Transfer ticket to another department
router.post('/:id/transfer', async (req, res) => {
  try {
    const { newDepartmentId } = req.body;
    const counter = await Counter.findById(req.params.id)
      .populate('department')
      .populate('currentTicket');

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    if (!counter.currentTicket) {
      return res.status(400).json({ error: 'No active ticket to transfer' });
    }

    // Find the new department
    const newDepartment = await Department.findById(newDepartmentId);
    if (!newDepartment) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if transferring to same department
    if (counter.department._id.toString() === newDepartmentId) {
      return res.status(400).json({ error: 'Cannot transfer to the same department' });
    }

    const ticket = counter.currentTicket;

    // Update ticket - reset status and assign to new department
    ticket.department = newDepartmentId;
    ticket.status = 'waiting';
    ticket.assignedCounter = null;
    ticket.calledAt = null;
    ticket.servedAt = null;
    ticket.transferredAt = new Date();
    await ticket.save();

    // Update counter
    counter.currentTicket = null;
    counter.status = 'active';
    counter.lastActivity = new Date();
    await counter.save();

    // Populate data for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('department')
      .populate('assignedCounter');

    const populatedCounter = await Counter.findById(counter._id)
      .populate('department');

    // Log activity
    await Activity.create({
      action: 'TICKET_TRANSFERRED',
      ticket: ticket._id,
      counter: counter._id,
      details: `Ticket ${ticket.ticketNumber} transferred from ${counter.department.name} to ${newDepartment.name}`,
      user: req.user?._id || 'system'
    });

    // Real-time updates
    const io = req.app.get('io');
    
    // Emit transfer event
    io.emit('token-transferred', {
      ticket: populatedTicket,
      originalCounter: populatedCounter,
      newDepartment: newDepartment
    });

    // Emit to original department room
    io.to(`department-${counter.department._id}`).emit('ticket-transferred-out', {
      ticket: populatedTicket,
      fromCounter: populatedCounter,
      toDepartment: newDepartment
    });

    // Emit to new department room
    io.to(`department-${newDepartmentId}`).emit('ticket-transferred-in', {
      ticket: populatedTicket,
      fromDepartment: counter.department,
      toDepartment: newDepartment
    });

    // Emit counter update
    io.emit('counter-updated', populatedCounter);

    console.log(`🔄 Ticket ${ticket.ticketNumber} transferred from ${counter.department.name} to ${newDepartment.name}`);

    res.json({
      success: true,
      ticket: populatedTicket,
      counter: populatedCounter,
      newDepartment: newDepartment,
      message: `Ticket ${ticket.ticketNumber} transferred to ${newDepartment.name} successfully`
    });

  } catch (error) {
    console.error('❌ Error transferring ticket:', error);
    res.status(500).json({ 
      error: 'Failed to transfer ticket',
      details: error.message 
    });
  }
});

// Update counter status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'busy', 'break', 'offline'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const counter = await Counter.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        lastActivity: new Date()
      },
      { new: true }
    )
    .populate('department')
    .populate('currentTicket');

    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    // Log activity
    await Activity.create({
      action: 'COUNTER_STATUS_CHANGED',
      counter: counter._id,
      details: `Counter ${counter.counterNumber} status changed to ${status}`,
      user: req.user?._id || 'system'
    });

    // Real-time update
    const io = req.app.get('io');
    io.emit('counter-updated', counter);

    res.json(counter);
  } catch (error) {
    console.error('❌ Error updating counter status:', error);
    res.status(500).json({ error: 'Failed to update counter status' });
  }
});

// Create new counter
router.post('/', async (req, res) => {
  try {
    const { counterNumber, name, department, type = 'department' } = req.body;
    
    console.log('📝 Creating counter with data:', { counterNumber, name, department, type });
    
    // Validate required fields
    if (!counterNumber || !department) {
      return res.status(400).json({ 
        error: 'Counter number and department are required' 
      });
    }

    // Check if counter number already exists
    const existingCounter = await Counter.findOne({ counterNumber });
    if (existingCounter) {
      return res.status(400).json({ error: 'Counter number already exists' });
    }

    // Validate department exists
    const departmentObj = await Department.findById(department);
    if (!departmentObj) {
      return res.status(400).json({ error: 'Department not found' });
    }

    const counter = new Counter({
      counterNumber: parseInt(counterNumber),
      name: name || `Counter ${counterNumber}`,
      department: departmentObj._id,
      type,
      status: 'active'
    });

    await counter.save();
    
    // Update department with this counter
    await Department.findByIdAndUpdate(
      department,
      { $push: { counters: counter._id } }
    );
    
    const populatedCounter = await Counter.findById(counter._id)
      .populate('department')
      .populate('currentTicket');

    // Log activity
    await Activity.create({
      action: 'COUNTER_CREATED',
      counter: counter._id,
      details: `Counter ${counterNumber} (${name}) created for ${departmentObj.name}`,
      user: req.user?._id || 'system'
    });

    // Real-time update
    const io = req.app.get('io');
    io.emit('counter-created', populatedCounter);

    console.log(`✅ Counter ${counterNumber} created successfully for department: ${departmentObj.name}`);
    
    res.status(201).json({
      success: true,
      counter: populatedCounter,
      message: `Counter ${counterNumber} created successfully for ${departmentObj.name}`
    });
  } catch (error) {
    console.error('❌ Error creating counter:', error);
    res.status(500).json({ 
      error: 'Failed to create counter',
      details: error.message 
    });
  }
});

// Delete counter
router.delete('/:id', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    
    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    // Check if counter has active ticket
    if (counter.currentTicket) {
      return res.status(400).json({ error: 'Cannot delete counter with active ticket' });
    }

    // Remove counter from department
    await Department.findByIdAndUpdate(
      counter.department,
      { $pull: { counters: counter._id } }
    );

    await Counter.findByIdAndDelete(req.params.id);

    // Log activity
    await Activity.create({
      action: 'COUNTER_DELETED',
      details: `Counter ${counter.counterNumber} deleted`,
      user: req.user?._id || 'system'
    });

    // Real-time update
    const io = req.app.get('io');
    io.emit('counter-deleted', req.params.id);

    res.json({
      success: true,
      message: 'Counter deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting counter:', error);
    res.status(500).json({ error: 'Failed to delete counter' });
  }
});

// Get counter statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    
    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    // Get today's served count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTickets = await Ticket.countDocuments({
      assignedCounter: counter._id,
      status: 'completed',
      servedAt: { $gte: today }
    });

    // Get average service time
    const avgServiceTime = await Ticket.aggregate([
      {
        $match: {
          assignedCounter: counter._id,
          status: 'completed',
          servedAt: { $exists: true },
          calledAt: { $exists: true }
        }
      },
      {
        $project: {
          serviceTime: { $subtract: ['$servedAt', '$calledAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgServiceTime: { $avg: '$serviceTime' }
        }
      }
    ]);

    res.json({
      counterId: counter._id,
      counterNumber: counter.counterNumber,
      ticketsServedToday: todayTickets,
      avgServiceTime: avgServiceTime[0]?.avgServiceTime || 0,
      currentStatus: counter.status,
      lastActivity: counter.lastActivity
    });
  } catch (error) {
    console.error('❌ Error fetching counter stats:', error);
    res.status(500).json({ error: 'Failed to fetch counter statistics' });
  }
});

// Get available departments for counter creation
router.get('/available/departments', async (req, res) => {
  try {
    const departments = await Department.find({ active: true })
      .select('name code prefix estimatedWaitTime')
      .sort('name');
    
    res.json(departments);
  } catch (error) {
    console.error('❌ Error fetching available departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get accessible counters
router.get('/accessible', async (req, res) => {
  try {
    const counters = await Counter.find({ status: { $in: ['active', 'busy'] } })
      .populate('department')
      .populate('currentTicket')
      .sort('counterNumber');

    console.log(`✅ Accessible counters: ${counters.length}`);
    
    res.json({ 
      success: true,
      counters 
    });
  } catch (error) {
    console.error('❌ Error fetching accessible counters:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch accessible counters' 
    });
  }
});

module.exports = router;