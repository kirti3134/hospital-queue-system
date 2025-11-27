const mongoose = require('mongoose');

const temporaryCallRequestSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    required: true
  },
  type: {
    type: String,
    enum: ['call', 'recall'],
    default: 'call'
  },
  isRecall: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['emergency', 'priority', 'senior', 'child', 'normal'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  sourceCounter: {
    type: String,
    required: true
  },
  sourceSystem: {
    type: String,
    default: 'counter_interface'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processingStartedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
temporaryCallRequestSchema.index({ status: 1, priority: -1, requestedAt: 1 });
temporaryCallRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // Auto delete after 24 hours

module.exports = mongoose.model('TemporaryCallRequest', temporaryCallRequestSchema);