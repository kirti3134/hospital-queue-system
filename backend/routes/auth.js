const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Counter = require('../models/Counter');
const Department = require('../models/Department');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-here';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-here';

// Generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      userId: user._id, 
      username: user.username,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Universal login for all components
router.post('/login', async (req, res) => {
  try {
    const { username, password, component } = req.body;

    console.log(`🔐 Login attempt: ${username} for ${component}`);

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username
    const user = await User.findOne({ username, isActive: true })
      .populate('counter')
      .populate('department');

    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Try again later.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', username);
      
      // Increment login attempts
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        console.log(`🔒 Account locked for user: ${username}`);
      }
      
      await user.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.sessionExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours session

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    // Check component-specific access
    let hasAccess = false;
    let redirectPath = '/';

    switch (component) {
      case 'admin':
        hasAccess = user.role === 'admin';
        redirectPath = '/admin';
        break;
      case 'counter':
        hasAccess = ['admin', 'operator', 'counter'].includes(user.role);
        redirectPath = user.counter ? `/counter/${user.counter._id}` : '/counter/select';
        break;
      case 'dispenser':
        hasAccess = ['admin', 'dispenser'].includes(user.role) || user.permissions.canGenerateTickets;
        redirectPath = '/dispenser';
        break;
      case 'waiting':
        hasAccess = ['admin', 'display'].includes(user.role);
        redirectPath = '/waiting';
        break;
      case 'display':
        hasAccess = ['admin', 'display'].includes(user.role);
        redirectPath = '/display/main';
        break;
      default:
        hasAccess = true;
    }

    if (!hasAccess) {
      console.log(`❌ Access denied for ${user.role} to ${component}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied for this component'
      });
    }

    console.log(`✅ Login successful: ${username} (${user.role})`);

    // Login successful
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        counter: user.counter,
        department: user.department,
        permissions: user.permissions
      },
      redirectPath,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, counterId } = req.query;
    const filter = { isActive: true };
    
    if (role) filter.role = role;
    if (counterId) filter.counter = counterId;

    const users = await User.find(filter)
      .populate('counter')
      .populate('department')
      .select('-password -refreshTokens')
      .sort({ username: 1 });

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Create user
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, counterId, departmentId, permissions } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = {
      username,
      password: hashedPassword,
      role,
      permissions: permissions || {}
    };

    // Add counter reference for counter users
    if (role === 'counter' && counterId) {
      userData.counter = counterId;
    }

    // Add department reference if needed
    if (departmentId) {
      userData.department = departmentId;
    }

    const user = new User(userData);
    await user.save();

    // Populate the created user for response
    const populatedUser = await User.findById(user._id)
      .populate('counter')
      .populate('department')
      .select('-password -refreshTokens');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: populatedUser
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
});

// Update user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, role, counterId, departmentId, permissions, password } = req.body;
    const userId = req.params.id;

    const updateData = {
      username,
      role,
      permissions: permissions || {},
      lastModified: new Date()
    };

    // Add counter reference for counter users
    if (role === 'counter' && counterId) {
      updateData.counter = counterId;
    } else {
      updateData.counter = null;
    }

    // Add department reference if needed
    if (departmentId) {
      updateData.department = departmentId;
    }

    // Update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('counter')
      .populate('department')
      .select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false, lastModified: new Date() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

// Get user by ID
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('counter')
      .populate('department')
      .select('-password -refreshTokens');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    });
  }
});

// Create counter user
router.post('/counters/:id/create-user', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const counterId = req.params.id;
    const { username, password } = req.body;

    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found'
      });
    }

    // Check if user already exists for this counter
    const existingUser = await User.findOne({ counter: counterId, isActive: true });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists for this counter'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      username: username || `counter${counter.counterNumber}`,
      password: hashedPassword,
      role: 'counter',
      counter: counterId,
      department: counter.department,
      permissions: {
        canCallTokens: true,
        canGenerateTickets: false
      }
    });

    await user.save();

    const populatedUser = await User.findById(user._id)
      .populate('counter')
      .populate('department')
      .select('-password -refreshTokens');

    res.status(201).json({
      success: true,
      message: 'Counter user created successfully',
      user: populatedUser
    });

  } catch (error) {
    console.error('Create counter user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating counter user'
    });
  }
});

// Simple logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Find user with this refresh token and remove it
      await User.updateOne(
        { 'refreshTokens.token': refreshToken },
        { $pull: { refreshTokens: { token: refreshToken } } }
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.userId,
      'refreshTokens.token': refreshToken,
      'refreshTokens.expiresAt': { $gt: new Date() },
      isActive: true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const { accessToken, newRefreshToken } = generateTokens(user);

    // Update refresh token
    await User.updateOne(
      { _id: user._id, 'refreshTokens.token': refreshToken },
      { 
        $set: { 
          'refreshTokens.$.token': newRefreshToken,
          'refreshTokens.$.expiresAt': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        } 
      }
    );

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

module.exports = router;