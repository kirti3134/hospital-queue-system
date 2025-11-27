const mongoose = require('mongoose');

const displaySchema = new mongoose.Schema({
  displayId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  location: String,
  type: {
    type: String,
    enum: ['waiting', 'counter', 'department', 'reception', 'custom'],
    default: 'waiting'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  settings: {
    showLogo: { type: Boolean, default: true },
    showAds: { type: Boolean, default: true },
    adInterval: { type: Number, default: 30 },
    theme: { type: String, default: 'default' },
    customMessage: { type: String, default: '' },
    backgroundColor: { type: String, default: '#1a5276' },
    textColor: { type: String, default: '#ffffff' }
  },
  currentContent: mongoose.Schema.Types.Mixed,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Display', displaySchema);