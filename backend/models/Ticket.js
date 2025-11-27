const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  patientName: String,
  patientPhone: String,
  priority: {
    type: String,
    enum: ['normal', 'priority', 'emergency', 'senior', 'child'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['waiting', 'called', 'serving', 'completed', 'cancelled'],
    default: 'waiting'
  },
  assignedCounter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  calledAt: Date,
  servedAt: Date,
  estimatedWaitTime: Number,
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);