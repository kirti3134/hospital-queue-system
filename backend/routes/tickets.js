const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Department = require('../models/Department');
const Activity = require('../models/Activity');
const Counter = require('../models/Counter');

// Generate new ticket - FIXED SEQUENCE ISSUE
router.post('/generate', async (req, res) => {
  try {
    const { departmentId, patientName, patientPhone, priority = 'normal' } = req.body;
    
    console.log('🎫 Generating ticket with data:', { departmentId, patientName, patientPhone, priority });

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // FIX: Proper sequence handling - increment before generating ticket
    department.currentSequence += 1;
    await department.save();

    // FIX: Generate proper ticket number with padding
    const ticketNumber = `${department.prefix}${department.currentSequence.toString().padStart(3, '0')}`;
    console.log(`✅ Generated ticket number: ${ticketNumber} for department: ${department.name}`);

    const ticket = new Ticket({
      ticketNumber,
      department: departmentId,
      patientName: patientName || null,
      patientPhone: patientPhone || null,
      priority: priority,
      estimatedWaitTime: department.estimatedWaitTime,
      status: 'waiting'
    });

    await ticket.save();

    // Populate ticket for response
    const populatedTicket = await Ticket.findById(ticket._id).populate('department');

    // Log activity
    await Activity.create({
      action: 'TICKET_GENERATED',
      ticket: ticket._id,
      details: `Ticket ${ticketNumber} generated for ${department.name}`,
      user: 'system'
    });

    // Real-time update
    const io = req.app.get('io');
    io.emit('ticket-generated', populatedTicket);
    
    // Emit to waiting areas
    io.emit('new-ticket', populatedTicket);

    console.log(`✅ Ticket ${ticketNumber} saved successfully to database`);

    res.json({
      success: true,
      ticket: populatedTicket,
      message: `Ticket ${ticketNumber} generated successfully`
    });

  } catch (error) {
    console.error('❌ Error generating ticket:', error);
    res.status(500).json({ 
      error: 'Failed to generate ticket',
      details: error.message 
    });
  }
});

// Get all tickets for a department
router.get('/department/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const tickets = await Ticket.find({ department: departmentId })
      .populate('department')
      .sort({ generatedAt: -1 });
    
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching department tickets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get waiting queue for a department
router.get('/queue/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const tickets = await Ticket.find({
      department: departmentId,
      status: 'waiting'
    })
    .populate('department')
    .sort({
      priority: -1,
      generatedAt: 1
    });
    
    console.log(`📋 Queue for department ${departmentId}: ${tickets.length} tickets`);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get department queue with enhanced data for waiting area
router.get('/department/:departmentId/queue-enhanced', async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    const tickets = await Ticket.find({
      department: departmentId,
      status: 'waiting'
    })
    .populate('department', 'name code prefix estimatedWaitTime')
    .sort({
      priority: -1,
      generatedAt: 1
    });

    // Get active counters for this department
    const activeCounters = await Counter.find({
      department: departmentId,
      status: { $in: ['active', 'busy'] }
    }).populate('currentTicket');

    // Get current called ticket
    const currentCalledTicket = await Ticket.findOne({
      department: departmentId,
      status: 'called'
    })
    .populate('department')
    .populate('assignedCounter');

    res.json({
      tickets,
      activeCounters: activeCounters.length,
      currentCalledTicket,
      waitingCount: tickets.length,
      estimatedWaitTime: tickets.length * 5 // Simple calculation
    });
  } catch (error) {
    console.error('Error fetching enhanced queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last ticket for a department
router.get('/department/:departmentId/last', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const lastTicket = await Ticket.findOne({ department: departmentId })
      .sort({ generatedAt: -1 })
      .populate('department');
    
    res.json(lastTicket);
  } catch (error) {
    console.error('Error fetching last ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

// Call next ticket
router.post('/call-next', async (req, res) => {
  try {
    const { counterId } = req.body;
    
    const counter = await Counter.findById(counterId).populate('department');
    if (!counter) {
      return res.status(404).json({ error: 'Counter not found' });
    }

    // Find next ticket based on priority rules
    const nextTicket = await Ticket.findOne({
      department: counter.department._id,
      status: 'waiting'
    }).sort({
      priority: -1,
      generatedAt: 1
    });

    if (!nextTicket) {
      return res.status(404).json({ error: 'No tickets in queue' });
    }

    // Update ticket
    nextTicket.status = 'called';
    nextTicket.assignedCounter = counterId;
    nextTicket.calledAt = new Date();
    await nextTicket.save();

    // Update counter
    counter.currentTicket = nextTicket._id;
    counter.status = 'busy';
    await counter.save();

    // Populate data for response
    const populatedTicket = await Ticket.findById(nextTicket._id)
      .populate('department')
      .populate('assignedCounter');

    const populatedCounter = await Counter.findById(counterId)
      .populate('department')
      .populate('currentTicket');

    // Log activity
    await Activity.create({
      action: 'TICKET_CALLED',
      ticket: nextTicket._id,
      counter: counterId,
      details: `Ticket ${nextTicket.ticketNumber} called to Counter ${counter.counterNumber}`,
      user: 'system'
    });

    // Real-time updates
    const io = req.app.get('io');
    io.emit('token-called', { 
      ticket: populatedTicket, 
      counter: populatedCounter 
    });

    res.json({ 
      success: true,
      ticket: populatedTicket, 
      counter: populatedCounter 
    });
  } catch (error) {
    console.error('Error calling next ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete current ticket
router.post('/complete/:ticketId', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.status = 'completed';
    ticket.servedAt = new Date();
    await ticket.save();

    // Free up counter
    const counter = await Counter.findOne({ currentTicket: ticket._id });
    if (counter) {
      counter.currentTicket = null;
      counter.status = 'active';
      await counter.save();
    }

    const populatedTicket = await Ticket.findById(ticket._id).populate('department');

    // Log activity
    await Activity.create({
      action: 'TICKET_COMPLETED',
      ticket: ticket._id,
      details: `Ticket ${ticket.ticketNumber} completed`,
      user: 'system'
    });

    const io = req.app.get('io');
    io.emit('ticket-completed', populatedTicket);

    res.json({ 
      success: true,
      ticket: populatedTicket 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Call specific ticket to counter
router.post('/call-specific', async (req, res) => {
  try {
    const { ticketId, counterId } = req.body;
    
    const ticket = await Ticket.findById(ticketId).populate('department');
    const counter = await Counter.findById(counterId);

    if (!ticket || !counter) {
      return res.status(404).json({ error: 'Ticket or counter not found' });
    }

    if (ticket.status !== 'waiting') {
      return res.status(400).json({ error: 'Ticket is not in waiting status' });
    }

    if (counter.status === 'busy') {
      return res.status(400).json({ error: 'Counter is busy' });
    }

    // Update ticket
    ticket.status = 'called';
    ticket.assignedCounter = counterId;
    ticket.calledAt = new Date();
    await ticket.save();

    // Update counter
    counter.currentTicket = ticketId;
    counter.status = 'busy';
    await counter.save();

    // Log activity
    await Activity.create({
      action: 'TICKET_CALLED_SPECIFIC',
      ticket: ticket._id,
      counter: counter._id,
      details: `Ticket ${ticket.ticketNumber} specifically called to Counter ${counter.counterNumber}`,
      user: 'system'
    });

    const populatedTicket = await Ticket.findById(ticketId)
      .populate('department')
      .populate('assignedCounter');

    const populatedCounter = await Counter.findById(counterId)
      .populate('currentTicket');

    const io = req.app.get('io');
    io.emit('token-called', { 
      ticket: populatedTicket, 
      counter: populatedCounter 
    });

    res.json({ 
      success: true,
      ticket: populatedTicket, 
      counter: populatedCounter 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Skip ticket (move to end of queue)
router.post('/:id/skip', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Update generatedAt to current time to move to end of queue
    ticket.generatedAt = new Date();
    await ticket.save();

    // Log activity
    await Activity.create({
      action: 'TICKET_SKIPPED',
      ticket: ticket._id,
      details: `Ticket ${ticket.ticketNumber} was skipped and moved to end of queue`,
      user: 'system'
    });

    const io = req.app.get('io');
    io.emit('ticket-skipped', ticket);

    res.json({ 
      success: true,
      ticket 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tickets with filters
router.get('/', async (req, res) => {
  try {
    const { status, department, limit = 50 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;

    const tickets = await Ticket.find(filter)
      .populate('department')
      .populate('assignedCounter')
      .sort({ generatedAt: -1 })
      .limit(parseInt(limit));

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;