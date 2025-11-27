const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  text: String,
  image: String,
  video: String, // New field for video ads
  duration: Number,
  active: Boolean,
  type: { type: String, enum: ['text', 'image', 'video'], default: 'text' }
});

const themeSchema = new mongoose.Schema({
  primaryColor: String,
  secondaryColor: String,
  backgroundColor: String,
  fontFamily: String
});

const waitingScreenSettingsSchema = new mongoose.Schema({
  backgroundColor: { type: String, default: '#1a5276' },
  textColor: { type: String, default: '#ffffff' },
  showAds: { type: Boolean, default: true },
  customMessage: { type: String, default: '' },
  adInterval: { type: Number, default: 30 },
  theme: { type: String, default: 'default' }
});

const dispenserSettingsSchema = new mongoose.Schema({
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#000000' },
  welcomeMessage: { type: String, default: 'Welcome to Razi Hospital' },
  showInstructions: { type: Boolean, default: true },
  autoPrint: { type: Boolean, default: true }
});

const systemSettingSchema = new mongoose.Schema({
  hospitalName: {
    type: String,
    required: true
  },
  hospitalLogo: String,
  language: {
    type: String,
    default: 'en'
  },
  autoCall: {
    type: Boolean,
    default: true
  },
  soundNotifications: {
    type: Boolean,
    default: true
  },
  displayAnnouncements: {
    type: Boolean,
    default: true
  },
  maxWaitTime: {
    type: Number,
    default: 30
  },
  priorityRules: {
    type: String,
    default: 'emergency,priority,senior,child,normal'
  },
  themes: themeSchema,
  advertisements: [advertisementSchema],
  // New settings
  waitingScreen: waitingScreenSettingsSchema,
  dispenserSettings: dispenserSettingsSchema,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SystemSetting', systemSettingSchema);