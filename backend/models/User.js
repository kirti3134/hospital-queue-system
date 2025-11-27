const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'operator', 'dispenser', 'display', 'counter'],
    default: 'operator'
  },
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  permissions: {
    canGenerateTickets: { type: Boolean, default: false },
    canCallTokens: { type: Boolean, default: false },
    canManageCounters: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  // Add token management fields
  refreshTokens: [{
    token: String,
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  sessionExpiry: Date
}, {
  timestamps: true
});

// Add index for counter users
userSchema.index({ counter: 1 });
userSchema.index({ role: 1 });
userSchema.index({ sessionExpiry: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', userSchema);