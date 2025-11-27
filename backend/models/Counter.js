const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  counterNumber: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'busy', 'break', 'offline'],
    default: 'active'
  },
  currentTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  type: {
    type: String,
    enum: ['reception', 'department', 'special'],
    default: 'department'
  },
  settings: {
    autoCall: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true }
  },
  // Individual waiting screen settings
  waitingScreenSettings: {
    backgroundColor: { type: String, default: '#1a5276' },
    textColor: { type: String, default: '#ffffff' },
    showAds: { type: Boolean, default: true },
    customMessage: { type: String, default: '' },
    theme: { type: String, default: 'default' }
  },
  // Statistics
  ticketsServedToday: { type: Number, default: 0 },
  lastActivity: Date
}, {
  timestamps: true
});

// Virtual for current ticket info
counterSchema.virtual('currentTicketInfo', {
  ref: 'Ticket',
  localField: 'currentTicket',
  foreignField: '_id',
  justOne: true
});

// Index for performance
counterSchema.index({ counterNumber: 1 });
counterSchema.index({ status: 1 });
counterSchema.index({ department: 1 });

module.exports = mongoose.model('Counter', counterSchema);