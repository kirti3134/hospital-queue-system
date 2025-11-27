const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  prefix: {
    type: String,
    required: true,
    uppercase: true,
    maxlength: 3
  },
  currentSequence: {
    type: Number,
    default: 0
  },
  estimatedWaitTime: {
    type: Number,
    default: 15,
    min: 0,
    max: 120
  },
  active: {
    type: Boolean,
    default: true
  },
  displaySettings: {
    backgroundColor: { type: String, default: '#1a5276' },
    textColor: { type: String, default: '#ffffff' },
    showInDispenser: { type: Boolean, default: true }
  },
  counters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  }]
}, {
  timestamps: true
});

// Add index for better performance
departmentSchema.index({ code: 1 });
departmentSchema.index({ active: 1 });

module.exports = mongoose.model('Department', departmentSchema);