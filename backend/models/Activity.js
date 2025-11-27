const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  details: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', activitySchema);