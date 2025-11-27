const express = require('express');
const router = express.Router();
const SystemSetting = require('../models/SystemSetting');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const Department = require('../models/Department');
const Display = require('../models/Displayy');
const Activity = require('../models/Activity');

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/logo';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log('📁 Logo upload directory:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'logo-' + uniqueSuffix + path.extname(file.originalname);
    console.log('📝 Generated logo filename:', filename);
    cb(null, filename);
  }
});

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/videos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log('📁 Video upload directory:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'video-' + uniqueSuffix + path.extname(file.originalname);
    console.log('📝 Generated video filename:', filename);
    cb(null, filename);
  }
});

// File filters
const imageFileFilter = (req, file, cb) => {
  console.log('🔍 Multer received file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  if (file.mimetype.startsWith('image/')) {
    console.log('✅ File accepted - is image');
    cb(null, true);
  } else {
    console.log('❌ File rejected - not an image');
    cb(new Error('Only image files are allowed!'), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  console.log('🔍 Video file received:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  if (file.mimetype.startsWith('video/')) {
    console.log('✅ Video file accepted');
    cb(null, true);
  } else {
    console.log('❌ Video file rejected - not a video');
    cb(new Error('Only video files are allowed!'), false);
  }
};

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  }
});

// Enhanced logo upload with debugging
router.post('/upload-logo', (req, res, next) => {
  console.log('🚀 ========== UPLOAD LOGO ENDPOINT HIT ==========');
  console.log('📋 Request method:', req.method);
  console.log('📦 Content-Type:', req.headers['content-type']);
  console.log('📏 Content-Length:', req.headers['content-length']);
  console.log('🌐 Request URL:', req.url);
  
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    console.log('❌ WRONG CONTENT-TYPE:', contentType);
    return res.status(400).json({
      success: false,
      error: 'Request must be multipart/form-data'
    });
  }
  
  console.log('✅ Correct Content-Type detected');
  next();
}, logoUpload.single('logo'), async (req, res) => {
  try {
    console.log('🔄 Processing logo upload after multer...');
    console.log('📁 Multer processed file:', req.file);
    
    if (!req.file) {
      console.log('❌ No file received from multer');
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded. Please select a valid image file (JPEG, PNG, GIF, SVG).' 
      });
    }

    console.log('✅ File successfully processed by multer:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // Verify file was actually written to disk
    if (!fs.existsSync(req.file.path)) {
      console.log('❌ File not found on disk:', req.file.path);
      return res.status(500).json({
        success: false,
        error: 'File upload failed - file not saved to disk'
      });
    }

    // Find current settings
    let settings = await SystemSetting.findOne();
    if (!settings) {
      console.log('📝 No settings found, creating new settings with logo...');
      settings = new SystemSetting({
        hospitalName: 'City Hospital Delhi',
        hospitalLogo: `/uploads/logo/${req.file.filename}`,
        language: 'en',
        autoCall: true,
        soundNotifications: true,
        displayAnnouncements: true,
        maxWaitTime: 30,
        priorityRules: 'emergency,priority,senior,child,normal',
        themes: {
          primaryColor: '#2980b9',
          secondaryColor: '#2c3e50',
          backgroundColor: '#ecf0f1',
          fontFamily: 'Segoe UI'
        },
        advertisements: [
          {
            text: 'Quality Healthcare Services - Welcome to Razi Hospital',
            duration: 30,
            active: true
          }
        ],
        waitingScreen: {
          backgroundColor: '#1a5276',
          textColor: '#ffffff',
          showAds: true,
          customMessage: ''
        },
        dispenserSettings: {
          backgroundColor: '#ffffff',
          textColor: '#000000',
          autoPrint: true,
          welcomeMessage: 'Welcome to Razi Hospital'
        }
      });
    } else {
      console.log('📝 Updating existing settings with new logo...');
      // Delete old logo file if exists
      if (settings.hospitalLogo && settings.hospitalLogo !== '') {
        const oldLogoPath = path.join(__dirname, '..', settings.hospitalLogo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
          console.log('🗑️ Old logo deleted:', oldLogoPath);
        }
      }
      
      settings.hospitalLogo = `/uploads/logo/${req.file.filename}`;
    }

    settings.updatedAt = new Date();
    await settings.save();

    console.log('✅ Logo uploaded and saved successfully:', settings.hospitalLogo);

    const io = req.app.get('io');
    io.emit('settings-updated', settings);

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: settings.hospitalLogo,
      settings: settings
    });
  } catch (error) {
    console.error('❌ Error uploading logo:', error);
    
    // Delete the uploaded file if there was an error
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Uploaded file deleted due to error');
        }
      } catch (deleteError) {
        console.error('❌ Error deleting uploaded file:', deleteError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Video upload endpoint
router.post('/upload-video', (req, res, next) => {
  console.log('🚀 ========== UPLOAD VIDEO ENDPOINT HIT ==========');
  console.log('📋 Request method:', req.method);
  console.log('📦 Content-Type:', req.headers['content-type']);
  
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    console.log('❌ WRONG CONTENT-TYPE for video:', contentType);
    return res.status(400).json({
      success: false,
      error: 'Request must be multipart/form-data'
    });
  }
  
  console.log('✅ Correct Content-Type for video detected');
  next();
}, videoUpload.single('video'), async (req, res) => {
  try {
    console.log('🔄 Processing video upload after multer...');
    console.log('📁 Multer processed file:', req.file);
    
    if (!req.file) {
      console.log('❌ No video file received from multer');
      return res.status(400).json({ 
        success: false,
        error: 'No video uploaded. Please select a valid video file (MP4, AVI, MOV, etc.).' 
      });
    }

    console.log('✅ Video successfully processed by multer:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // Verify file was actually written to disk
    if (!fs.existsSync(req.file.path)) {
      console.log('❌ Video file not found on disk:', req.file.path);
      return res.status(500).json({
        success: false,
        error: 'Video upload failed - file not saved to disk'
      });
    }

    console.log('✅ Video verified on disk:', req.file.path);

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      videoUrl: `/uploads/videos/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    
    // Delete the uploaded file if there was an error
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Uploaded video deleted due to error');
        }
      } catch (deleteError) {
        console.error('❌ Error deleting uploaded video:', deleteError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Background image upload (reuses logo upload functionality)
router.post('/upload-background', logoUpload.single('background'), async (req, res) => {
  try {
    console.log('🔄 Processing background image upload...');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No background image uploaded' 
      });
    }

    console.log('✅ Background image uploaded successfully:', req.file.filename);

    res.json({
      success: true,
      message: 'Background image uploaded successfully',
      imageUrl: `/uploads/logo/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('❌ Error uploading background image:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get system settings
router.get('/', async (req, res) => {
  try {
    console.log('📥 Fetching system settings...');
    let settings = await SystemSetting.findOne();
    
    if (!settings) {
      console.log('📝 No settings found, creating default settings...');
      settings = new SystemSetting({
        hospitalName: 'Razi Hospital',
        hospitalLogo: '',
        language: 'en',
        autoCall: true,
        soundNotifications: true,
        displayAnnouncements: true,
        maxWaitTime: 30,
        priorityRules: 'emergency,priority,senior,child,normal',
        themes: {
          primaryColor: '#2980b9',
          secondaryColor: '#2c3e50',
          backgroundColor: '#ecf0f1',
          fontFamily: 'Segoe UI'
        },
        advertisements: [
          {
            text: 'Quality Healthcare Services - Welcome to Razi Hospital',
            duration: 30,
            active: true
          }
        ],
        waitingScreen: {
          backgroundColor: '#1a5276',
          textColor: '#ffffff',
          showAds: true,
          customMessage: '',
          backgroundImage: ''
        },
        dispenserSettings: {
          backgroundColor: '#ffffff',
          textColor: '#000000',
          autoPrint: true,
          welcomeMessage: 'Welcome to Razi Hospital',
          backgroundImage: ''
        },
        counterScreen: {
          backgroundColor: '#f8f9fa',
          textColor: '#333333'
        }
      });
      await settings.save();
      console.log('✅ Default settings created successfully');
    }
    
    console.log('✅ Settings fetched successfully:', settings.hospitalName);
    res.json(settings);
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update system settings
router.put('/', async (req, res) => {
  try {
    console.log('📤 Updating system settings...', req.body);
    
    let settings = await SystemSetting.findOne();
    if (!settings) {
      console.log('📝 No existing settings, creating new...');
      settings = new SystemSetting(req.body);
    } else {
      console.log('📝 Updating existing settings...');
      settings = Object.assign(settings, req.body);
    }
    
    settings.updatedAt = new Date();
    await settings.save();

    console.log('✅ Settings updated successfully:', settings.hospitalName);

    const io = req.app.get('io');
    io.emit('settings-updated', settings);

    res.json(settings);
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update advertisements
router.put('/advertisements', async (req, res) => {
  try {
    console.log('📤 Updating advertisements...', req.body);
    
    const settings = await SystemSetting.findOne();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    settings.advertisements = req.body.advertisements || [];
    settings.updatedAt = new Date();
    await settings.save();

    console.log('✅ Advertisements updated successfully');

    const io = req.app.get('io');
    io.emit('advertisements-updated', settings.advertisements);

    res.json(settings);
  } catch (error) {
    console.error('❌ Error updating advertisements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset to default settings
router.post('/reset', async (req, res) => {
  try {
    console.log('🔄 Resetting settings to defaults...');
    
    await SystemSetting.deleteMany({});
    
    const defaultSettings = new SystemSetting({
      hospitalName: 'Razi Hospital',
      hospitalLogo: '',
      language: 'en',
      autoCall: true,
      soundNotifications: true,
      displayAnnouncements: true,
      maxWaitTime: 30,
      priorityRules: 'emergency,priority,senior,child,normal',
      themes: {
        primaryColor: '#2980b9',
        secondaryColor: '#2c3e50',
        backgroundColor: '#ecf0f1',
        fontFamily: 'Segoe UI'
      },
      advertisements: [
        {
          text: 'Quality Healthcare Services - Welcome to Razi Hospital',
          duration: 30,
          active: true
        }
      ],
      waitingScreen: {
        backgroundColor: '#1a5276',
        textColor: '#ffffff',
        showAds: true,
        customMessage: '',
        backgroundImage: ''
      },
      dispenserSettings: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        autoPrint: true,
        welcomeMessage: 'Welcome to Razi Hospital',
        backgroundImage: ''
      },
      counterScreen: {
        backgroundColor: '#f8f9fa',
        textColor: '#333333'
      }
    });
    
    await defaultSettings.save();

    const io = req.app.get('io');
    io.emit('settings-updated', defaultSettings);

    console.log('✅ Settings reset to defaults successfully');
    res.json(defaultSettings);
  } catch (error) {
    console.error('❌ Error resetting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced multer error handling middleware
router.use((error, req, res, next) => {
  console.log('🚨 ========== MULTER ERROR HANDLER ==========');
  console.log('🔍 Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  
  if (error instanceof multer.MulterError) {
    console.log('📁 Multer-specific error:', error.code);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB for images, 50MB for videos.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field. Make sure the file field name is correct.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      error: 'Only image files are allowed!'
    });
  }

  if (error.message === 'Only video files are allowed!') {
    return res.status(400).json({
      success: false,
      error: 'Only video files are allowed!'
    });
  }
  
  console.error('❌ General upload error:', error);
  res.status(500).json({
    success: false,
    error: error.message
  });
});

// DELETE ALL DATA - CORRECTED ENDPOINT
router.delete('/delete-all-data', async (req, res) => {
  try {
    console.log('🚨 ========== DELETE ALL DATA REQUESTED ==========');
    
    // Delete all data from all collections
    const deleteResults = {
      tickets: { deletedCount: 0 },
      counters: { deletedCount: 0 },
      departments: { deletedCount: 0 },
      activityLogs: { deletedCount: 0 }
    };

    // Delete tickets
    try {
      const ticketResult = await Ticket.deleteMany({});
      deleteResults.tickets = ticketResult;
      console.log(`🗑️ Deleted ${ticketResult.deletedCount} tickets`);
    } catch (ticketError) {
      console.error('❌ Error deleting tickets:', ticketError);
      deleteResults.tickets.error = ticketError.message;
    }

    // Delete counters
    try {
      const counterResult = await Counter.deleteMany({});
      deleteResults.counters = counterResult;
      console.log(`🗑️ Deleted ${counterResult.deletedCount} counters`);
    } catch (counterError) {
      console.error('❌ Error deleting counters:', counterError);
      deleteResults.counters.error = counterError.message;
    }

    // Delete departments
    try {
      const departmentResult = await Department.deleteMany({});
      deleteResults.departments = departmentResult;
      console.log(`🗑️ Deleted ${departmentResult.deletedCount} departments`);
    } catch (departmentError) {
      console.error('❌ Error deleting departments:', departmentError);
      deleteResults.departments.error = departmentError.message;
    }

    // Delete activity logs
    try {
      const activityLogResult = await ActivityLog.deleteMany({});
      deleteResults.activityLogs = activityLogResult;
      console.log(`🗑️ Deleted ${activityLogResult.deletedCount} activity logs`);
    } catch (activityError) {
      console.error('❌ Error deleting activity logs:', activityError);
      deleteResults.activityLogs.error = activityError.message;
    }

    // Reset all counters to inactive state
    try {
      await Counter.updateMany({}, { 
        status: 'inactive', 
        currentTicket: null,
        lastActivity: new Date()
      });
      console.log('🔄 All counters reset to inactive state');
    } catch (resetError) {
      console.error('❌ Error resetting counters:', resetError);
    }

    // Emit socket events to update all clients
    const io = req.app.get('io');
    io.emit('system-data-reset', { 
      message: 'All system data has been deleted',
      timestamp: new Date(),
      results: deleteResults
    });

    // Emit individual events for different components
    io.emit('tickets-cleared', []);
    io.emit('counters-updated', []);
    io.emit('departments-updated', []);
    io.emit('activity-logs-cleared', []);

    console.log('✅ All data deleted successfully');
    
    res.json({ 
      success: true, 
      message: 'All system data deleted successfully',
      timestamp: new Date(),
      results: deleteResults
    });
    
  } catch (error) {
    console.error('❌ Error deleting all data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete all data',
      error: error.message 
    });
  }
});
module.exports = router;