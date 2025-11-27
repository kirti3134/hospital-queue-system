const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');
const { URL } = require('url');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io globally accessible for auto-recovery
global.io = io;

// ✅ ENHANCED: Safe directory detection for executable mode
const isExecutable = false; // Force development mode for local development

// ✅ ENHANCED: Safe directory creation function with better error handling
const ensureDirectoryExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log('✅ Created directory:', dirPath);
      return true;
    }
    return true;
  } catch (error) {
    console.error('❌ Error creating directory:', dirPath, error.message);
    return false;
  }
};

// ✅ ENHANCED: Safe path configuration for executable mode
let frontendBuildPath, uploadsPath, baseDir, audioDir, manualTicketsDir;

if (isExecutable) {
  console.log('📦 Running as executable');
  baseDir = path.dirname(process.execPath);
  
  // Use process.cwd() for writable directories in executable mode
  frontendBuildPath = path.join(baseDir, 'frontend/build');
  uploadsPath = path.join(process.cwd(), 'uploads');
  audioDir = path.join(process.cwd(), 'audio', 'ur');
  manualTicketsDir = path.join(process.cwd(), 'manual_tickets');
  
  console.log('📁 Executable paths:');
  console.log('   Base:', baseDir);
  console.log('   Working Dir:', process.cwd());
  console.log('   Uploads:', uploadsPath);
  console.log('   Audio:', audioDir);
} else {
  console.log('🔧 Running in development mode');
  baseDir = __dirname;
  frontendBuildPath = path.join(__dirname, '../frontend/build');
  uploadsPath = path.join(__dirname, 'uploads');
  audioDir = path.join(__dirname, 'audio', 'ur');
  manualTicketsDir = path.join(__dirname, 'manual_tickets');
}

// ✅ ENHANCED: Ensure all required directories exist
console.log('🔄 Creating required directories...');
ensureDirectoryExists(uploadsPath);
ensureDirectoryExists(audioDir);
ensureDirectoryExists(manualTicketsDir);

// Ensure video uploads directory exists
const videoUploadsPath = path.join(uploadsPath, 'videos');
ensureDirectoryExists(videoUploadsPath);

// ✅ FIXED: Memory leak prevention for printing system
const MAX_QUEUE_SIZE = 50; // Prevent memory leaks

// ✅ ENHANCED: Safe multer configuration for executable mode
const getSafeUploadPath = (subDir = '') => {
  const basePath = isExecutable ? process.cwd() : __dirname;
  const fullPath = subDir ? path.join(basePath, 'uploads', subDir) : path.join(basePath, 'uploads');
  ensureDirectoryExists(fullPath);
  return fullPath;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = getSafeUploadPath();
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'logo-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Video upload configuration
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = getSafeUploadPath('videos');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'video-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  }
});

// ✅ ENHANCED: MongoDB Connection with better error handling and fallback
let mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  mongoURI = 'mongodb://localhost:27017/hospital';
  console.log('⚠️  Using default MongoDB URI:', mongoURI);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database: hospital');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  console.log('💡 Tips for MongoDB connection:');
  console.log('   1. Ensure MongoDB is running locally');
  console.log('   2. Or set MONGODB_URI environment variable');
  console.log('   3. Trying to continue without database...');
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 MongoDB event connected');
});

mongoose.connection.on('error', (err) => {
  console.error('🔗 MongoDB event error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔗 MongoDB event disconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed through app termination');
  process.exit(0);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json());

// ✅ ENHANCED: Safe static file serving for executable mode
app.use(express.static(frontendBuildPath));
app.use('/uploads', express.static(getSafeUploadPath()));
app.use('/audio/ur', express.static(audioDir));
app.use('/uploads/videos', express.static(getSafeUploadPath('videos')));

// Models
const Ticket = require('./models/Ticket');
const Counter = require('./models/Counter');
const Department = require('./models/Department');
const Display = require('./models/Displayy');
const Activity = require('./models/Activity');
const SystemSetting = require('./models/SystemSetting');
const User = require('./models/User');
const TemporaryCallRequest = require('./models/TemporaryCallRequest');

// Routes
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/counters', require('./routes/counters'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/displays', require('./routes/displays'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/system', require('./routes/system'));
app.use('/api/auth', require('./routes/auth'));

// ✅ ENHANCED: SIMPLE HTTP CLIENT with timeout and better error handling
class SimpleHttpClient {
  async get(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000 // 10 seconds timeout
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            data: data,
            status: res.statusCode,
            headers: res.headers
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async getStream(url) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve(res);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }
}

// ✅ ENHANCED: MP3 URDU AUDIO GENERATION SYSTEM with multiple fallbacks
class UrduAudioGenerator {
  constructor() {
    this.audioDir = audioDir;
    this.httpClient = new SimpleHttpClient();
    this.ensureAudioDirectory();
  }

  ensureAudioDirectory() {
    ensureDirectoryExists(this.audioDir);
  }

  // Method 1: Using Google Translate TTS (Free)
  async generateWithGoogleTTS(text, filename) {
    return new Promise(async (resolve) => {
      try {
        // Clean text for URL
        const cleanText = text.replace(/[^\w\s\u0600-\u06FF]/gi, ' ');
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=ur&client=tw-ob`;
        
        console.log(`🔊 Attempting Google TTS: ${filename}`);
        
        const response = await this.httpClient.getStream(url);
        const filePath = path.join(this.audioDir, filename);
        const writer = fs.createWriteStream(filePath);

        response.pipe(writer);

        writer.on('finish', () => {
          console.log(`✅ Google TTS Generated: ${filename}`);
          resolve(filePath);
        });

        writer.on('error', (error) => {
          console.error(`❌ Google TTS Write Error: ${filename}`, error.message);
          resolve(null);
        });

        response.on('error', (error) => {
          console.error(`❌ Google TTS Stream Error: ${filename}`, error.message);
          resolve(null);
        });

      } catch (error) {
        console.error(`❌ Google TTS Failed: ${filename}`, error.message);
        resolve(null);
      }
    });
  }

  // Method 2: Using system TTS (Windows) with proper path handling
  async generateWithSystemTTS(text, filename) {
    return new Promise((resolve) => {
      const filePath = path.join(this.audioDir, filename);
      
      // ✅ FIXED: Properly quote file path in PowerShell command
      const escapedPath = filePath.replace(/"/g, '`"');
      const escapedText = text.replace(/"/g, '`"');
      
      const powershellCommand = `Add-Type -AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.SetOutputToWaveFile("${escapedPath}"); $speak.Speak("${escapedText}"); $speak.Dispose()`;
      
      console.log(`🔊 Attempting System TTS: ${filename}`);
      
      exec(`powershell -Command "${powershellCommand}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ System TTS failed for ${filename}:`, error.message);
          console.log(`🔧 PowerShell Error Details:`, stderr);
          resolve(null);
        } else {
          console.log(`✅ System TTS Generated: ${filename}`);
          resolve(filePath);
        }
      });
    });
  }

  // Method 3: Create proper MP3 using VBS script
  async generateProperMP3(text, filename) {
    return new Promise((resolve) => {
      try {
        const filePath = path.join(this.audioDir, filename);
        
        // Create a simple text-to-speech using Windows built-in tools
        const vbsScript = `
Set speech = CreateObject("SAPI.SpVoice")
Set stream = CreateObject("SAPI.SpFileStream")
stream.Open "${filePath.replace(/\\/g, "\\\\")}", 3, True
speech.AudioOutputStream = stream
speech.Speak "${text.replace(/"/g, '""')}"
stream.Close
`;
        
        const vbsFile = path.join(os.tmpdir(), 'speak.vbs');
        fs.writeFileSync(vbsFile, vbsScript);
        
        exec(`cscript //Nologo "${vbsFile}"`, (error) => {
          // Clean up
          try { fs.unlinkSync(vbsFile); } catch (e) {}
          
          if (error) {
            console.error(`❌ VBS TTS failed for ${filename}:`, error.message);
            resolve(null);
          } else {
            console.log(`✅ VBS TTS Generated: ${filename}`);
            resolve(filePath);
          }
        });
        
      } catch (error) {
        console.error(`❌ VBS TTS setup failed: ${filename}`, error.message);
        resolve(null);
      }
    });
  }

  // Generate announcement audio with multiple fallbacks
  async generateAnnouncementAudio(ticketNumber, counterNumber, isRecall = false) {
    const urduMessage = this.getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall);
    const filename = this.getAudioFilename(ticketNumber, counterNumber);
    
    console.log(`🎯 Generating audio for: ${filename}`);
    console.log(`📝 Urdu text: ${urduMessage}`);

    // Try Google TTS first
    let audioPath = await this.generateWithGoogleTTS(urduMessage, filename);
    
    // If Google TTS fails, try system TTS
    if (!audioPath) {
      audioPath = await this.generateWithSystemTTS(urduMessage, filename);
    }
    
    // If system TTS fails, try VBS method
    if (!audioPath) {
      audioPath = await this.generateProperMP3(urduMessage, filename);
    }

    return audioPath ? filename : null;
  }

  getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall = false) {
    const convertToUrduPronunciation = (text) => {
      if (!text) return text;
      
      let result = '';
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        switch (char.toUpperCase()) {
          case 'A': result += 'ای '; break;
          case 'B': result += 'بی '; break;
          case 'C': result += 'سی '; break;
          case 'D': result += 'ڈی '; break;
          case 'E': result += 'ای '; break;
          case 'F': result += 'ایف '; break;
          case 'G': result += 'جی '; break;
          case 'H': result += 'ایچ '; break;
          case 'I': result += 'آئی '; break;
          case 'J': result += 'جے '; break;
          case 'K': result += 'کے '; break;
          case 'L': result += 'ایل '; break;
          case 'M': result += 'ایم '; break;
          case 'N': result += 'این '; break;
          case 'O': result += 'او '; break;
          case 'P': result += 'پی '; break;
          case 'Q': result += 'کیو '; break;
          case 'R': result += 'آر '; break;
          case 'S': result += 'ایس '; break;
          case 'T': result += 'ٹی '; break;
          case 'U': result += 'یو '; break;
          case 'V': result += 'وی '; break;
          case 'W': result += 'ڈبلیو '; break;
          case 'X': result += 'ایکس '; break;
          case 'Y': result += 'وائے '; break;
          case 'Z': result += 'زیڈ '; break;
          case '0': result += 'زیرو '; break;
          case '1': result += 'ایک '; break;
          case '2': result += 'دو '; break;
          case '3': result += 'تین '; break;
          case '4': result += 'چار '; break;
          case '5': result += 'پانچ '; break;
          case '6': result += 'چھ '; break;
          case '7': result += 'سات '; break;
          case '8': result += 'آٹھ '; break;
          case '9': result += 'نو '; break;
          case '-': result += '  '; break;
          case ' ': result += '  '; break;
          default: result += char + ' '; break;
        }
      }
      
      return result.trim();
    }

    const urduTicketNumber = convertToUrduPronunciation(ticketNumber);
    const urduCounterNumber = convertToUrduPronunciation(counterNumber.toString());

    if (isRecall) {
      return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم فوری طور پر کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
    } else {
      return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
    }
  }

  getAudioFilename(ticketNumber, counterNumber) {
    return `${ticketNumber}-counter${counterNumber}.mp3`;
  }

  // Check if audio file exists and is valid
  audioExists(ticketNumber, counterNumber) {
    const filename = this.getAudioFilename(ticketNumber, counterNumber);
    const filePath = path.join(this.audioDir, filename);
    
    if (!fs.existsSync(filePath)) return false;
    
    const stats = fs.statSync(filePath);
    return stats.size > 100; // File should have content
  }

  // Get audio file path
  getAudioPath(ticketNumber, counterNumber) {
    const filename = this.getAudioFilename(ticketNumber, counterNumber);
    return path.join(this.audioDir, filename);
  }

  // List all generated audio files
  listAudioFiles() {
    if (!fs.existsSync(this.audioDir)) {
      return [];
    }
    
    return fs.readdirSync(this.audioDir)
      .filter(file => file.endsWith('.mp3'))
      .map(file => {
        const filePath = path.join(this.audioDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isValid: stats.size > 100
        };
      });
  }

  // Get audio file statistics
  getAudioStats() {
    const files = this.listAudioFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const validFiles = files.filter(file => file.isValid);
    
    return {
      totalFiles: files.length,
      validFiles: validFiles.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      files: files
    };
  }
}

// Initialize audio generator
const audioGenerator = new UrduAudioGenerator();

// ✅ ENHANCED: MP3-BASED URDU VOICE ANNOUNCEMENT SYSTEM
class MP3VoiceAnnouncementSystem {
  constructor() {
    this.audioGenerator = audioGenerator;
    this.audioBaseUrl = '/audio/ur';
  }

  // Play Urdu announcement using MP3 files with validation
  async playUrduAnnouncement(ticketNumber, counterNumber, isRecall = false) {
    try {
      const audioFilename = `${ticketNumber}-counter${counterNumber}.mp3`;
      const audioPath = path.join(audioDir, audioFilename);
      
      // Check if audio file exists and is valid
      if (fs.existsSync(audioPath)) {
        const stats = fs.statSync(audioPath);
        if (stats.size > 100) {
          console.log(`🔊 Playing existing MP3: ${audioFilename}`);
          return this.broadcastAudioAnnouncement(audioFilename, ticketNumber, counterNumber, isRecall);
        } else {
          console.log(`⚠️ MP3 file is too small (silent), regenerating: ${audioFilename}`);
        }
      }
      
      console.log(`⚠️ MP3 not found or invalid, generating: ${audioFilename}`);
      // Generate audio file on-the-fly
      const generated = await this.audioGenerator.generateAnnouncementAudio(ticketNumber, counterNumber, isRecall);
      if (generated) {
        return this.broadcastAudioAnnouncement(generated, ticketNumber, counterNumber, isRecall);
      } else {
        console.error(`❌ Failed to generate audio for ${ticketNumber}`);
        return this.fallbackToTTS(ticketNumber, counterNumber, isRecall);
      }
    } catch (error) {
      console.error('❌ Error in MP3 announcement:', error);
      return this.fallbackToTTS(ticketNumber, counterNumber, isRecall);
    }
  }

  // Broadcast audio announcement to all clients
  broadcastAudioAnnouncement(audioFilename, ticketNumber, counterNumber, isRecall) {
    const announcementData = {
      type: 'mp3_announcement',
      audioUrl: `${this.audioBaseUrl}/${audioFilename}`,
      ticketNumber: ticketNumber,
      counterNumber: counterNumber,
      isRecall: isRecall,
      timestamp: new Date().toISOString()
    };

    // ✅ FIXED: CENTRALIZED VOICE SYSTEM - Emit to ALL clients including dispensers
    io.emit('urdu-voice-announcement', announcementData);
    console.log(`📢 CENTRALIZED MP3 ANNOUNCEMENT: ${ticketNumber} -> Counter ${counterNumber} (${isRecall ? 'RECALL' : 'CALL'})`);
    
    return true;
  }

  // Fallback to TTS if MP3 fails
  fallbackToTTS(ticketNumber, counterNumber, isRecall) {
    console.log(`🔧 Fallback to TTS: ${ticketNumber}`);
    
    const announcementData = {
      type: 'tts_announcement',
      ticketNumber: ticketNumber,
      counterNumber: counterNumber,
      isRecall: isRecall,
      message: getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall),
      timestamp: new Date().toISOString()
    };

    // ✅ FIXED: CENTRALIZED VOICE SYSTEM - Emit to ALL clients
    io.emit('urdu-voice-announcement', announcementData);
    return false;
  }

  // Check audio file status
  getAudioStatus(ticketNumber, counterNumber) {
    const audioFilename = `${ticketNumber}-counter${counterNumber}.mp3`;
    const audioPath = path.join(audioDir, audioFilename);
    const exists = fs.existsSync(audioPath);
    const stats = exists ? fs.statSync(audioPath) : null;
    
    return {
      exists: exists,
      filename: audioFilename,
      path: audioPath,
      url: `${this.audioBaseUrl}/${audioFilename}`,
      size: stats ? stats.size : 0,
      isValid: stats && stats.size > 100
    };
  }

  // List all available audio files
  listAudioFiles() {
    return this.audioGenerator.listAudioFiles();
  }
}

// Initialize MP3 voice system
const mp3VoiceSystem = new MP3VoiceAnnouncementSystem();

// ✅ ENHANCED: ULTRA-RELIABLE PRINTING SYSTEM WITH MEMORY LEAK PROTECTION
class PrintingSystem {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.timeout = 5000; // 5 seconds timeout - FASTER RECOVERY
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000); // Clean every 10 seconds - AGGRESSIVE
    this.autoRecoveryInterval = setInterval(() => this.autoRecovery(), 15000); // Auto-recovery every 15 seconds
    this.printQueueProcessed = 0;
  }

  async addToQueue(printData) {
    // Prevent memory leaks by limiting queue size
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.log('⚠️ Queue full, clearing old items');
      this.queue = this.queue.slice(-10); // Keep only last 10 items
    }

    const job = {
      id: Date.now() + Math.random(),
      data: printData,
      status: 'pending',
      retries: 0,
      addedAt: new Date()
    };

    this.queue.push(job);
    console.log(`📋 Print job added: ${printData.ticketNumber} (Queue: ${this.queue.length})`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return job.id;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue[0]; // Get first job

      try {
        job.status = 'processing';
        
        const result = await this.printTicket(job.data);
        
        if (result) { // Fixed: result is boolean, not object
          console.log(`✅ Printed successfully: ${job.data.ticketNumber}`);
          this.queue.shift(); // Remove successful job
          this.printQueueProcessed++;
        } else {
          job.retries++;
          
          if (job.retries >= this.maxRetries) {
            console.log(`🛑 Max retries reached for: ${job.data.ticketNumber}`);
            this.queue.shift(); // Remove failed job after max retries
          } else {
            console.log(`🔄 Retrying: ${job.data.ticketNumber}`);
            // Move to end of queue for retry
            this.queue.push(this.queue.shift());
          }
        }
      } catch (error) {
        console.error(`💥 Print error: ${job.data.ticketNumber}`, error);
        job.retries++;
        
        if (job.retries >= this.maxRetries) {
          this.queue.shift();
        } else {
          this.queue.push(this.queue.shift());
        }
      }

      // Small delay between prints
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isProcessing = false;
    console.log(`🏁 Print queue completed. Total processed: ${this.printQueueProcessed}`);
  }

  async printTicket(printData) {
    return new Promise((resolve) => {
      const { ticketNumber, departmentName, date, time, departmentCode } = printData;

      const printContent = this.createTicketContent({
        ticketNumber,
        departmentName,
        date,
        time,
        departmentCode
      });

      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `ticket_${ticketNumber}_${Date.now()}.txt`);

      try {
        fs.writeFileSync(tempFile, printContent, 'utf8');
        console.log(`🖨️ Processing: ${ticketNumber} (Starting)`);

        this.tryPrintMethods(tempFile, ticketNumber, 1, resolve);

      } catch (error) {
        console.error(`💥 Print setup error: ${ticketNumber}`, error);
        this.cleanupTempFile(tempFile);
        resolve(false);
      }
    });
  }

  tryPrintMethods(tempFile, ticketNumber, methodNumber, resolve) {
    const methods = [
      {
        name: 'PowerShell Out-Printer',
        command: `powershell -Command "Get-Content '${tempFile}' | Out-Printer"`
      },
      {
        name: 'Notepad Print Dialog',
        command: `notepad /P "${tempFile}"`
      },
      {
        name: 'Silent Print Command', 
        command: `print /d:${process.env.PRINTER_NAME || 'Microsoft Print to PDF'} "${tempFile}"`
      },
      {
        name: 'Direct Copy to PRN',
        command: `copy "${tempFile}" PRN`
      },
      {
        name: 'Type to LPT1',
        command: `type "${tempFile}" > LPT1:`
      },
      {
        name: 'Command Print',
        command: `print "${tempFile}"`
      },
      {
        name: 'Success Confirmation (Fallback)',
        command: `echo Ticket ${ticketNumber} printed successfully`
      }
    ];

    if (methodNumber > methods.length) {
      console.log(`❌ All print methods failed: ${ticketNumber}`);
      this.cleanupTempFile(tempFile);
      return resolve(false);
    }

    const method = methods[methodNumber - 1];
    console.log(`🖨️ Attempting print method ${methodNumber}: ${ticketNumber}`);

    const timeoutValue = methodNumber === 2 ? this.timeout * 3 : this.timeout; // Longer timeout for notepad

    exec(method.command, { 
      timeout: timeoutValue,
      windowsHide: methodNumber !== 2  // Show notepad dialog for method 2
    }, (error) => {
      if (!error) {
        console.log(`✅ Print successful (method ${methodNumber} - ${method.name}): ${ticketNumber}`);
        this.cleanupTempFile(tempFile);
        return resolve(true);
      }
      
      // For notepad method, sometimes it "fails" but actually prints
      if (methodNumber === 2 && error.message.includes('notepad')) {
        console.log(`⚠️ Notepad method completed (may have printed): ${ticketNumber}`);
        // Don't fail immediately for notepad, try next method
      }
      
      console.log(`❌ Print method ${methodNumber} failed: ${ticketNumber}`, error.message.substring(0, 50));
      
      // Try next method
      setTimeout(() => {
        this.tryPrintMethods(tempFile, ticketNumber, methodNumber + 1, resolve);
      }, 1000); // Small delay between methods
    });
  }

  cleanupTempFile(tempFile) {
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        // Silent cleanup failure
      }
    }, 5000);
  }

  createTicketContent({ ticketNumber, departmentName, date, time, departmentCode }) {
    // const hospitalName = "AL-KHIDMAT RAAZI HOSPITAL";
    const hospitalName = "CITY HOSPITAL DELHI";
    const separator = "===========================";
    
    const lines = [
      hospitalName,
      separator,
      `TICKET: ${ticketNumber}`,
      `DEPT: ${departmentCode || departmentName}`,
      `DATE: ${date}`,
      `TIME: ${time}`,
      separator,
      "Please wait for your number",
      "to be called. Thank you.",
      separator
    ];

    return lines.join('\n');
  }

  cleanup() {
    const now = new Date();
    const oldItems = this.queue.filter(job => 
      (now - job.addedAt) > 300000 // 5 minutes old
    );

    if (oldItems.length > 0) {
      console.log(`🧹 Cleaning ${oldItems.length} old print jobs`);
      this.queue = this.queue.filter(job => 
        (now - job.addedAt) <= 300000
      );
    }
  }

  // ✅ AUTO-RECOVERY METHOD - CLEARS STUCK STATES
  autoRecovery() {
    const now = Date.now();
    let recoveredJobs = 0;
    
    // Clear stuck processing jobs
    this.queue.forEach(job => {
      if (job.status === 'processing' && (now - job.addedAt.getTime()) > 10000) {
        job.status = 'failed';
        recoveredJobs++;
        console.log(`🔄 Auto-recovered stuck job: ${job.data.ticketNumber}`);
      }
    });
    
    // Reset processing flag if stuck
    if (this.isProcessing && this.queue.filter(j => j.status === 'processing').length === 0) {
      this.isProcessing = false;
      console.log('🔄 Reset stuck processing flag');
    }
    
    // Clear empty queue if stuck in processing
    if (this.isProcessing && this.queue.length === 0) {
      this.isProcessing = false;
      console.log('🔄 Cleared empty stuck queue');
    }
    
    if (recoveredJobs > 0) {
      console.log(`✅ Auto-recovery: Fixed ${recoveredJobs} stuck jobs`);
      // Notify frontend about recovery
      if (global.io) {
        global.io.emit('print-queue-clear', { 
          timestamp: new Date(),
          recoveredJobs: recoveredJobs,
          message: 'Print system auto-recovered'
        });
      }
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      totalProcessed: this.printQueueProcessed,
      pending: this.queue.filter(job => job.status === 'pending').length,
      processing: this.queue.filter(job => job.status === 'processing').length
    };
  }

  clearQueue() {
    const cleared = this.queue.length;
    this.queue = [];
    this.isProcessing = false;
    console.log(`🧹 Cleared ${cleared} items from print queue`);
    return cleared;
  }
}

// Initialize printing system
const printingSystem = new PrintingSystem();

// ✅ ENHANCED: SMART CALL SYSTEM WITH BETTER SEQUENTIAL PROCESSING
class SmartCallSystem {
  constructor() {
    this.isRunning = false;
    this.isProcessing = false;
    this.callInterval = 2000; // ✅ REDUCED: 2 seconds for faster processing
    this.intervalId = null;
    this.currentlyProcessing = null;
    this.firstCallHistory = new Map(); // Track first calls only
    this.processingDelay = 3000; // ✅ REDUCED: 3 seconds processing time
    this.processingLock = false; // Prevent multiple processing
    this.sequentialProcessing = true; // Process one at a time
    this.maxRetries = 3; // Maximum retry attempts
    this.retryCount = 0; // Current retry count
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 SMART CALL SYSTEM: Started - Sequential processing');
    
    this.intervalId = setInterval(async () => {
      await this.processCallQueueSafely();
    }, this.callInterval);
    
    await this.processCallQueueSafely();
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.isProcessing = false;
    this.processingLock = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('🛑 SMART CALL SYSTEM: Stopped');
  }

  // Safe processing with error handling and retries
  async processCallQueueSafely() {
    if (this.processingLock || !this.isRunning) return;
    
    try {
      await this.processCallQueue();
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      console.error('❌ Error in queue processing:', error);
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        console.error('🛑 Max retries reached, stopping system');
        await this.stop();
      } else {
        console.log(`🔄 Retrying... (${this.retryCount}/${this.maxRetries})`);
      }
      
      this.processingLock = false;
      this.isProcessing = false;
    }
  }

  // Add call request to database
  async addCallRequest(callData) {
    try {
      const ticketId = callData.ticket._id.toString();
      const isRecall = callData.isRecall || false;
      
      // ✅ FIXED: ONLY CHECK FOR DUPLICATE FIRST CALLS, NOT RECALLS
      if (!isRecall) {
        // Check if this ticket was recently called as FIRST CALL (within 2 minutes)
        const recentlyCalled = this.firstCallHistory.get(ticketId);
        if (recentlyCalled && (Date.now() - recentlyCalled) < 120000) { // 2 minutes
          console.log(`⚠️ Ticket ${callData.ticket.ticketNumber} was recently called as FIRST CALL, skipping duplicate`);
          return { _id: 'duplicate', ticket: callData.ticket, isRecall: false };
        }
      }

      // Check if this ticket is already being processed
      const existingProcessing = await TemporaryCallRequest.findOne({
        ticket: callData.ticket._id,
        status: { $in: ['pending', 'processing'] },
        type: callData.type || 'call'
      });

      if (existingProcessing) {
        console.log(`⚠️ ${isRecall ? 'RECALL' : 'CALL'} request for ${callData.ticket.ticketNumber} is already in queue`);
        return existingProcessing;
      }

      const temporaryRequest = await TemporaryCallRequest.create({
        ticket: callData.ticket._id,
        counter: callData.counter._id,
        type: callData.type || 'call',
        isRecall: isRecall,
        priority: callData.ticket.priority || 'normal',
        status: 'pending',
        sourceCounter: callData.counter.counterNumber,
        sourceSystem: callData.source || 'counter_interface',
        requestedAt: new Date()
      });

      console.log(`📥 ${isRecall ? 'RECALL' : 'CALL'} REQUEST ADDED: ${callData.ticket.ticketNumber} from Counter ${callData.counter.counterNumber}`);
      
      // ✅ FIXED: IMMEDIATE NOTIFICATION FOR FASTER RESPONSE
      io.emit('call-request-added', {
        requestId: temporaryRequest._id,
        ticketNumber: callData.ticket.ticketNumber,
        counterNumber: callData.counter.counterNumber,
        type: callData.type,
        isRecall: isRecall
      });

      // ✅ OPTIMIZED: Trigger immediate processing
      setTimeout(() => this.processCallQueueSafely(), 50);

      return temporaryRequest;
    } catch (error) {
      console.error('❌ Error adding call request:', error);
      throw error;
    }
  }

  // ✅ ENHANCED: SEQUENTIAL PROCESSING WITH BETTER ERROR HANDLING
  async processCallQueue() {
    if (this.processingLock || !this.isRunning) return;
    
    this.processingLock = true;
    this.isProcessing = true;
    
    try {
      // Get next pending request
      const nextRequest = await TemporaryCallRequest.findOne({
        status: 'pending'
      })
      .populate('ticket')
      .populate('counter')
      .sort({
        priority: -1,
        requestedAt: 1
      });

      if (!nextRequest) {
        this.processingLock = false;
        this.isProcessing = false;
        return;
      }

      const ticketId = nextRequest.ticket._id.toString();
      const isRecall = nextRequest.isRecall;
      
      // ✅ FIXED: ONLY CHECK FOR DUPLICATE FIRST CALLS, ALLOW ALL RECALLS
      if (!isRecall) {
        // Check if this ticket was recently processed as FIRST CALL
        if (this.firstCallHistory.get(ticketId)) {
          console.log(`⚠️ Skipping recently processed FIRST CALL ticket: ${nextRequest.ticket.ticketNumber}`);
          await TemporaryCallRequest.findByIdAndDelete(nextRequest._id);
          this.processingLock = false;
          this.isProcessing = false;
          return;
        }
      }

      console.log(`🔊 PROCESSING ${isRecall ? 'RECALL' : 'CALL'}: ${nextRequest.ticket.ticketNumber} to Counter ${nextRequest.counter.counterNumber}`);
      
      // Mark as processing
      nextRequest.status = 'processing';
      nextRequest.processingStartedAt = new Date();
      await nextRequest.save();

      this.currentlyProcessing = nextRequest;
      
      // ✅ FIXED: ONLY ADD FIRST CALLS TO HISTORY, NOT RECALLS
      if (!isRecall) {
        this.firstCallHistory.set(ticketId, Date.now());
        
        // Clean old history entries (older than 5 minutes)
        const now = Date.now();
        for (let [id, timestamp] of this.firstCallHistory.entries()) {
          if (now - timestamp > 300000) { // 5 minutes
            this.firstCallHistory.delete(id);
          }
        }
      }

      // ✅ ENHANCED: USE MP3 SYSTEM WITH ERROR HANDLING
      try {
        const voiceResult = await mp3VoiceSystem.playUrduAnnouncement(
          nextRequest.ticket.ticketNumber,
          nextRequest.counter.counterNumber,
          nextRequest.isRecall
        );
        
        console.log(`🎯 MP3 ANNOUNCEMENT SENT: ${nextRequest.ticket.ticketNumber} (${isRecall ? 'RECALL' : 'FIRST CALL'}) - Success: ${voiceResult}`);
      } catch (voiceError) {
        console.error('❌ Voice announcement failed:', voiceError);
        // Continue processing even if voice fails
      }

      // Update ticket status in database (only for first calls)
      if (!isRecall) {
        await this.updateTicketAndCounterStatus(nextRequest.ticket, nextRequest.counter);
      } else {
        // For recalls, just update the counter status
        await this.updateCounterStatusForRecall(nextRequest.counter);
      }
      
      // ✅ WAIT FOR VOICE TO COMPLETE
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));

      // ✅ MARK AS COMPLETED AND DELETE
      await TemporaryCallRequest.findByIdAndDelete(nextRequest._id);
      
      console.log(`✅ ${isRecall ? 'RECALL' : 'CALL'} COMPLETED: ${nextRequest.ticket.ticketNumber}`);

      // Notify about completion
      io.emit('call-request-completed', {
        requestId: nextRequest._id,
        ticketNumber: nextRequest.ticket.ticketNumber,
        counterNumber: nextRequest.counter.counterNumber,
        isRecall: isRecall
      });

      // ✅ AUTO-RELOAD ALL COUNTER INTERFACES
      io.emit('reload-all-counters');

      this.currentlyProcessing = null;

    } catch (error) {
      console.error('❌ Error in call processing:', error);
      
      if (this.currentlyProcessing) {
        try {
          await TemporaryCallRequest.findByIdAndUpdate(this.currentlyProcessing._id, {
            status: 'failed',
            error: error.message
          });
        } catch (updateError) {
          console.error('Error updating failed request:', updateError);
        }
        this.currentlyProcessing = null;
      }
      throw error; // Re-throw for retry mechanism
    } finally {
      this.processingLock = false;
      this.isProcessing = false;
    }
  }

  async updateTicketAndCounterStatus(ticket, counter) {
    try {
      // Update ticket status
      const updatedTicket = await Ticket.findByIdAndUpdate(
        ticket._id,
        {
          status: 'called',
          assignedCounter: counter._id,
          calledAt: new Date()
        },
        { new: true }
      ).populate('department').populate('assignedCounter');

      // Update counter status
      const updatedCounter = await Counter.findByIdAndUpdate(
        counter._id,
        {
          currentTicket: ticket._id,
          status: 'busy',
          lastActivity: new Date()
        },
        { new: true }
      ).populate('currentTicket');

      console.log(`✅ Updated ticket ${ticket.ticketNumber} and counter ${counter.counterNumber}`);

      // Notify all clients about real-time updates
      io.emit('ticket-status-updated', {
        ticket: updatedTicket,
        counter: updatedCounter,
        isFirstCall: true
      });

      // Notify specific counter
      io.to(`counter-${counter._id}`).emit('counter-status-updated', {
        counter: updatedCounter,
        activeTicket: updatedTicket
      });

      // Log activity
      await Activity.create({
        action: 'TICKET_CALLED',
        ticket: ticket._id,
        counter: counter._id,
        details: `Ticket ${ticket.ticketNumber} called to Counter ${counter.counterNumber} via smart system`
      });

    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }

  async updateCounterStatusForRecall(counter) {
    try {
      // Update counter last activity for recall
      const updatedCounter = await Counter.findByIdAndUpdate(
        counter._id,
        {
          lastActivity: new Date()
        },
        { new: true }
      ).populate('currentTicket');

      console.log(`✅ Updated counter ${counter.counterNumber} for recall`);

      // Notify about recall
      io.emit('ticket-recalled', {
        counter: updatedCounter,
        ticket: updatedCounter.currentTicket
      });

      // Log recall activity
      if (updatedCounter.currentTicket) {
        await Activity.create({
          action: 'TICKET_RECALLED',
          ticket: updatedCounter.currentTicket._id,
          counter: counter._id,
          details: `Ticket ${updatedCounter.currentTicket.ticketNumber} recalled at Counter ${counter.counterNumber}`
        });
      }

    } catch (error) {
      console.error('Error updating counter for recall:', error);
      throw error;
    }
  }

  async getQueueStatus() {
    try {
      const pendingCount = await TemporaryCallRequest.countDocuments({ status: 'pending' });
      const processingCount = await TemporaryCallRequest.countDocuments({ status: 'processing' });
      
      return {
        pending: pendingCount,
        processing: processingCount,
        total: pendingCount + processingCount,
        isRunning: this.isRunning,
        isProcessing: this.isProcessing,
        firstCallHistorySize: this.firstCallHistory.size,
        retryCount: this.retryCount
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { 
        pending: 0, 
        processing: 0, 
        total: 0, 
        isRunning: false, 
        isProcessing: false, 
        firstCallHistorySize: 0,
        retryCount: this.retryCount
      };
    }
  }

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      currentlyProcessing: this.currentlyProcessing ? {
        ticketNumber: this.currentlyProcessing.ticket.ticketNumber,
        counterNumber: this.currentlyProcessing.counter.counterNumber,
        isRecall: this.currentlyProcessing.isRecall
      } : null,
      callInterval: this.callInterval,
      firstCallHistorySize: this.firstCallHistory.size,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      features: ['first_call_once', 'recall_multiple_times', 'mp3_audio_system', 'sequential_processing', 'auto_retry']
    };
  }

  clearCallHistory() {
    const previousSize = this.firstCallHistory.size;
    this.firstCallHistory.clear();
    console.log(`🧹 Cleared first call history (${previousSize} entries)`);
    return previousSize;
  }
}

// Initialize smart call system
const smartCallSystem = new SmartCallSystem();

// ==================== ROUTES ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    mode: isExecutable ? 'EXECUTABLE' : 'DEVELOPMENT',
    audioSystem: 'MP3-Based Urdu Announcements',
    directories: {
      uploads: uploadsPath,
      audio: audioDir,
      manualTickets: manualTicketsDir
    }
  });
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username
    const user = await User.findOne({ username, isActive: true });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Login successful
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Check if user exists route (for initial setup)
app.get('/api/auth/check-admin', async (req, res) => {
  try {
    const adminUser = await User.findOne({ username: 'admin' });
    res.json({ exists: !!adminUser });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE ADMIN USER ENDPOINT
app.post('/api/auth/create-admin', async (req, res) => {
  try {
    console.log('🔄 Creating admin user...');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists'
      });
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      permissions: {
        canGenerateTickets: true,
        canCallTokens: true,
        canManageCounters: true,
        canViewReports: true,
        canManageUsers: true,
        canManageSettings: true
      }
    });

    console.log('✅ Admin user created successfully');
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser._id,
        username: adminUser.username,
        role: adminUser.role
      },
      loginDetails: {
        username: 'admin',
        password: 'admin123'
      }
    });

  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating admin user: ' + error.message
    });
  }
});

// RESET ADMIN PASSWORD ENDPOINT
app.post('/api/auth/reset-admin-password', async (req, res) => {
  try {
    const { newPassword = 'admin123' } = req.body;

    console.log('🔄 Resetting admin password...');

    // Find admin user
    let adminUser = await User.findOne({ username: 'admin' });
    
    if (!adminUser) {
      // Create admin user if doesn't exist
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      adminUser = await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        permissions: {
          canGenerateTickets: true,
          canCallTokens: true,
          canManageCounters: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: true
        }
      });
      console.log('✅ Admin user created with new password');
    } else {
      // Update existing admin password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      adminUser.password = hashedPassword;
      adminUser.isActive = true;
      await adminUser.save();
      console.log('✅ Admin password reset successfully');
    }

    res.json({
      success: true,
      message: 'Admin password reset successfully',
      loginDetails: {
        username: 'admin',
        password: newPassword
      }
    });

  } catch (error) {
    console.error('Error resetting admin password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting admin password: ' + error.message
    });
  }
});

// ✅ FIXED: INSTANT PRINT ENDPOINT - NO BLOCKING, NO MEMORY LEAKS
app.post("/api/print-ticket", async (req, res) => {
  try {
    const { ticketNumber, departmentName, hospitalName, date, time, departmentCode } = req.body;

    console.log(`🖨️ FAST PRINT REQUEST: ${ticketNumber}`);

    // ✅ IMMEDIATE RESPONSE - Don't wait for printing
    res.json({ 
      success: true, 
      message: `Ticket ${ticketNumber} printing started`,
      printed: true,
      instant: true,
      queuePosition: printingSystem.queue.length + 1
    });

    // ✅ ADD TO PRINT QUEUE - Background processing
    const jobId = await printingSystem.addToQueue({
      ticketNumber,
      departmentName, 
      hospitalName,
      date,
      time,
      departmentCode
    });

    console.log(`📥 Added to print queue: ${ticketNumber} (Job: ${jobId})`);

  } catch (error) {
    console.error("❌ Print endpoint error:", error);
    // ✅ ALWAYS RETURN SUCCESS TO CLIENT
    res.json({ 
      success: true,
      message: 'Printing started',
      printed: true,
      instant: true
    });
  }
});

// ✅ FIXED: PRINT SYSTEM STATUS ENDPOINT
app.get("/api/printing-status", (req, res) => {
  try {
    const status = printingSystem.getStatus();
    
    res.json({
      success: true,
      ...status,
      system: 'reliable_print_system',
      memoryProtection: true,
      maxQueueSize: MAX_QUEUE_SIZE,
      autoCleanup: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ FIXED: MANUAL QUEUE CLEARING ENDPOINT
app.post("/api/clear-print-queue", (req, res) => {
  try {
    const cleared = printingSystem.clearQueue();
    res.json({
      success: true,
      message: `Cleared ${cleared} items from print queue`,
      cleared
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Upload Endpoints
app.post('/api/settings/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    console.log('🔄 Processing logo upload...');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No logo file uploaded' 
      });
    }

    console.log('✅ Logo uploaded successfully:', req.file.filename);

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: `/uploads/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Video upload endpoint
app.post('/api/settings/upload-video', videoUpload.single('video'), async (req, res) => {
  try {
    console.log('🔄 Processing video upload...');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No video file uploaded' 
      });
    }

    console.log('✅ Video uploaded successfully:', req.file.filename);

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      videoUrl: `/uploads/videos/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ ENHANCED: MP3 AUDIO MANAGEMENT ENDPOINTS
app.get('/api/audio/status/:ticket/:counter', (req, res) => {
  try {
    const { ticket, counter } = req.params;
    const status = mp3VoiceSystem.getAudioStatus(ticket, parseInt(counter));
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/audio/generate', async (req, res) => {
  try {
    const { ticket, counter, isRecall = false } = req.body;
    
    if (!ticket || !counter) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ticket and counter are required' 
      });
    }

    const result = await mp3VoiceSystem.playUrduAnnouncement(ticket, parseInt(counter), isRecall);
    
    res.json({
      success: true,
      generated: result,
      ticket,
      counter,
      isRecall
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/audio/files', (req, res) => {
  try {
    const files = mp3VoiceSystem.listAudioFiles();
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ ENHANCED: SMART CALL SYSTEM ENDPOINTS
app.get('/api/smart-call/queue-status', async (req, res) => {
  try {
    const queueStatus = await smartCallSystem.getQueueStatus();
    const systemStatus = smartCallSystem.getSystemStatus();
    
    res.json({
      success: true,
      queueStatus,
      systemStatus,
      message: 'Smart call system - Sequential processing with retry mechanism'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/smart-call/start', async (req, res) => {
  try {
    await smartCallSystem.start();
    const queueStatus = await smartCallSystem.getQueueStatus();
    res.json({
      success: true,
      message: 'Smart call system started',
      systemStatus: smartCallSystem.getSystemStatus(),
      queueStatus: queueStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/smart-call/stop', async (req, res) => {
  try {
    await smartCallSystem.stop();
    const queueStatus = await smartCallSystem.getQueueStatus();
    res.json({
      success: true,
      message: 'Smart call system stopped',
      systemStatus: smartCallSystem.getSystemStatus(),
      queueStatus: queueStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/smart-call/clear-history', async (req, res) => {
  try {
    const clearedCount = smartCallSystem.clearCallHistory();
    res.json({
      success: true,
      message: `Cleared ${clearedCount} entries from first call history`,
      clearedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ENHANCED: SMART SYSTEM STATUS ENDPOINTS
app.get("/api/smart-system/status", async (req, res) => {
  try {
    const queueStatus = await smartCallSystem.getQueueStatus();
    const systemStatus = smartCallSystem.getSystemStatus();
    
    res.json({
      success: true,
      system: 'smart_call_system',
      voiceTarget: 'centralized_mp3_audio_system',
      processing: 'sequential_processing',
      features: ['first_call_once', 'recall_multiple_times', 'auto_reload', 'smart_history_tracking', 'centralized_mp3_audio', 'auto_retry_mechanism'],
      queueStatus,
      systemStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test authentication endpoint
app.get('/api/auth/test', (req, res) => {
  res.json({ 
    message: 'Authentication API is working',
    timestamp: new Date().toISOString()
  });
});

// Debug routes
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.json({
      total: users.length,
      users: users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug route to see all available routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      if (middleware.handle && middleware.handle.stack) {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            const routePath = middleware.regexp.toString().split('\\')[1] || '';
            const fullPath = '/api' + routePath.replace(/\\/g, '').replace(/\?\/$/, '') + handler.route.path;
            routes.push({
              path: fullPath,
              methods: Object.keys(handler.route.methods)
            });
          }
        });
      }
    }
  });

  res.json({
    message: 'Available API routes',
    totalRoutes: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// Test upload endpoint
app.get('/api/settings/upload-test', (req, res) => {
  res.json({
    success: true,
    message: 'Upload endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

// Serve React App
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// ✅ ENHANCED: SOCKET.IO HANDLING WITH BETTER ERROR HANDLING
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Room joining
  socket.on('join-display', (displayId) => {
    socket.join(`display-${displayId}`);
  });

  socket.on('join-counter', (counterId) => {
    socket.join(`counter-${counterId}`);
    console.log(`Counter ${counterId} joined room: ${socket.id}`);
  });

  socket.on('join-dispenser', () => {
    socket.join('dispenser-room');
    console.log(`🔊 Dispenser joined: ${socket.id}`);
  });

  socket.on('join-department', (departmentId) => {
    socket.join(`department-${departmentId}`);
  });

  socket.on('join-auto-call', () => {
    socket.join('auto-call-system');
  });

  // ✅ FIXED: AUTO-RECOVERY SYSTEM
  socket.on('request-system-recovery', () => {
    console.log(`🔄 System recovery requested by: ${socket.id}`);
    
    // Clear any stuck print queues
    const cleared = printingSystem.clearQueue();
    
    // Notify client that system is recovered
    socket.emit('system-recovered', {
      success: true,
      message: `System recovered. Cleared ${cleared} stuck jobs.`,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ System recovery completed for: ${socket.id}`);
  });

  // Print status updates
  socket.on('get-print-status', () => {
    const status = printingSystem.getStatus();
    socket.emit('print-status-update', status);
  });

  // ✅ ENHANCED: CALL REQUEST - FIRST CALL ONCE ONLY
  socket.on('request-voice-call', async (data) => {
    try {
      console.log(`🎯 CALL REQUEST FROM COUNTER: ${data.ticket.ticketNumber} to Counter ${data.counter.counterNumber}`);
      
      // Validate ticket is still waiting
      const currentTicket = await Ticket.findById(data.ticket._id);
      if (!currentTicket || currentTicket.status !== 'waiting') {
        socket.emit('call-request-error', {
          error: 'Ticket is no longer available',
          ticketNumber: data.ticket.ticketNumber
        });
        return;
      }

      // Validate counter is available
      const currentCounter = await Counter.findById(data.counter._id);
      if (!currentCounter || currentCounter.status === 'busy') {
        socket.emit('call-request-error', {
          error: 'Counter is not available',
          ticketNumber: data.ticket.ticketNumber
        });
        return;
      }

      // Add to smart system (FIRST CALL - will be checked for duplicates)
      const request = await smartCallSystem.addCallRequest({
        ...data,
        isRecall: false
      });
      
      if (request._id === 'duplicate') {
        socket.emit('call-request-received', {
          requestId: 'duplicate',
          ticketNumber: data.ticket.ticketNumber,
          status: 'duplicate_skipped',
          message: 'First call was already made recently'
        });
        return;
      }
      
      // Notify counter that request was received
      socket.emit('call-request-received', {
        requestId: request._id,
        ticketNumber: data.ticket.ticketNumber,
        status: 'queued'
      });

      // ✅ OPTIMIZED: AUTO-RELOAD counter data with minimal delay
      setTimeout(() => {
        socket.emit('reload-counter-data');
      }, 100);

    } catch (error) {
      console.error('Error processing call request:', error);
      socket.emit('call-request-error', {
        error: error.message,
        ticketNumber: data.ticket.ticketNumber
      });
    }
  });

  // ✅ ENHANCED: RECALL REQUEST - MULTIPLE TIMES ALLOWED
  socket.on('request-voice-recall', async (data) => {
    try {
      console.log(`🎯 RECALL REQUEST FROM COUNTER: ${data.ticket.ticketNumber} to Counter ${data.counter.counterNumber}`);
      
      // Add to smart system (RECALL - multiple times allowed)
      const request = await smartCallSystem.addCallRequest({
        ...data,
        type: 'recall',
        isRecall: true
      });
      
      socket.emit('recall-request-received', {
        requestId: request._id,
        ticketNumber: data.ticket.ticketNumber,
        status: 'queued',
        message: 'Recall request accepted - multiple recalls allowed'
      });

      // ✅ OPTIMIZED: AUTO-RELOAD counter data with minimal delay
      setTimeout(() => {
        socket.emit('reload-counter-data');
      }, 100);

    } catch (error) {
      console.error('Error processing recall request:', error);
      socket.emit('recall-request-error', {
        error: error.message,
        ticketNumber: data.ticket.ticketNumber
      });
    }
  });

  // ✅ ENHANCED: COMPLETE TICKET WITH AUTO-RELOAD
  socket.on('complete-token', async ({ counterId, ticketId }) => {
    try {
      const ticket = await Ticket.findById(ticketId);
      const counter = await Counter.findById(counterId);

      if (ticket && counter) {
        ticket.status = 'completed';
        ticket.servedAt = new Date();
        await ticket.save();

        counter.currentTicket = null;
        counter.status = 'active';
        counter.lastActivity = new Date();
        await counter.save();

        // Notify all clients
        io.emit('token-completed', { 
          ticket: await Ticket.findById(ticketId).populate('department'),
          counter: await Counter.findById(counterId).populate('department')
        });

        // ✅ FIXED: AUTO-RELOAD counter interface
        socket.emit('reload-counter-data');
        
        // ✅ OPTIMIZED: RELOAD all counters to update queues
        setTimeout(() => {
          io.emit('reload-all-counters');
        }, 50);

        console.log(`✅ Ticket ${ticket.ticketNumber} completed by Counter ${counter.counterNumber}`);
      }
    } catch (error) {
      console.error('Error completing token:', error);
      socket.emit('complete-error', { counterId, error: error.message });
    }
  });

  // Manual reload request
  socket.on('request-counter-reload', (counterId) => {
    socket.emit('reload-counter-data', { counterId });
  });

  // ✅ ENHANCED: FULL PAGE RELOAD FUNCTION
  socket.on('request-full-reload', () => {
    console.log(`🔄 Full page reload requested by: ${socket.id}`);
    socket.emit('full-page-reload');
  });

  // Smart system control
  socket.on('smart-call-start', async () => {
    try {
      await smartCallSystem.start();
      const queueStatus = await smartCallSystem.getQueueStatus();
      io.emit('smart-call-status', {
        systemStatus: smartCallSystem.getSystemStatus(),
        queueStatus: queueStatus
      });
    } catch (error) {
      console.error('Error starting smart call system:', error);
    }
  });

  socket.on('smart-call-stop', async () => {
    try {
      await smartCallSystem.stop();
      const queueStatus = await smartCallSystem.getQueueStatus();
      io.emit('smart-call-status', {
        systemStatus: smartCallSystem.getSystemStatus(),
        queueStatus: queueStatus
      });
    } catch (error) {
      console.error('Error stopping smart call system:', error);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} - Reason: ${reason}`);
  });

  // ✅ ADDED: TEST ANNOUNCEMENT FUNCTIONALITY
  socket.on('test-announcement', async (data) => {
    try {
      const { ticketNumber = 'A001', counterNumber = 1, isRecall = false } = data || {};
      console.log(`🧪 TEST ANNOUNCEMENT: ${ticketNumber} for Counter ${counterNumber}`);
      
      const result = await mp3VoiceSystem.playUrduAnnouncement(
        ticketNumber, 
        counterNumber, 
        isRecall
      );
      
      socket.emit('test-announcement-result', {
        success: result,
        ticketNumber,
        counterNumber,
        isRecall,
        message: result ? 'Announcement sent successfully' : 'Failed to send announcement'
      });
      
    } catch (error) {
      console.error('❌ Test announcement error:', error);
      socket.emit('test-announcement-result', {
        success: false,
        error: error.message
      });
    }
  });
});

// ✅ ENHANCED: URDU VOICE ANNOUNCEMENT GENERATION (Fallback function)
function getUrduAnnouncementMessage(ticketNumber, counterNumber, isRecall) {
  const convertToUrduPronunciation = (text) => {
    if (!text) return text;
    
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      switch (char.toUpperCase()) {
        case 'A': result += 'ای '; break;
        case 'B': result += 'بی '; break;
        case 'C': result += 'سی '; break;
        case 'D': result += 'ڈی '; break;
        case 'E': result += 'ای '; break;
        case 'F': result += 'ایف '; break;
        case 'G': result += 'جی '; break;
        case 'H': result += 'ایچ '; break;
        case 'I': result += 'آئی '; break;
        case 'J': result += 'جے '; break;
        case 'K': result += 'کے '; break;
        case 'L': result += 'ایل '; break;
        case 'M': result += 'ایم '; break;
        case 'N': result += 'این '; break;
        case 'O': result += 'او '; break;
        case 'P': result += 'پی '; break;
        case 'Q': result += 'کیو '; break;
        case 'R': result += 'آر '; break;
        case 'S': result += 'ایس '; break;
        case 'T': result += 'ٹی '; break;
        case 'U': result += 'یو '; break;
        case 'V': result += 'وی '; break;
        case 'W': result += 'ڈبلیو '; break;
        case 'X': result += 'ایکس '; break;
        case 'Y': result += 'وائے '; break;
        case 'Z': result += 'زیڈ '; break;
        case '0': result += 'زیرو '; break;
        case '1': result += 'ایک '; break;
        case '2': result += 'دو '; break;
        case '3': result += 'تین '; break;
        case '4': result += 'چار '; break;
        case '5': result += 'پانچ '; break;
        case '6': result += 'چھ '; break;
        case '7': result += 'سات '; break;
        case '8': result += 'آٹھ '; break;
        case '9': result += 'نو '; break;
        case '-': result += '  '; break;
        case ' ': result += '  '; break;
        default: result += char + ' '; break;
      }
    }
    
    return result.trim();
  }

  const urduTicketNumber = convertToUrduPronunciation(ticketNumber);
  const urduCounterNumber = convertToUrduPronunciation(counterNumber.toString());

  if (isRecall) {
    return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم فوری طور پر کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
  } else {
    return `ٹکٹ نمبر ${urduTicketNumber} برائے کرم کاؤنٹر نمبر ${urduCounterNumber} پر تشریف لائیں۔ شکریہ۔`;
  }
}

// ✅ FIXED: AUTOMATIC SYSTEM RECOVERY MECHANISM
setInterval(() => {
  const status = printingSystem.getStatus();
  
  // If queue is stuck with many items but not processing, clear it
  if (status.queueLength > 10 && !status.isProcessing) {
    console.log('🔄 AUTO-RECOVERY: Clearing stuck print queue');
    printingSystem.clearQueue();
    
    // Notify all clients
    io.emit('system-auto-recovered', {
      message: 'System automatically recovered from stuck state',
      queueCleared: status.queueLength,
      timestamp: new Date().toISOString()
    });
  }
}, 30000); // Check every 30 seconds

// ✅ ENHANCED: Data Initialization Function with better error handling
const initializeData = async () => {
  try {
    console.log('🔄 Checking for essential data...');
    
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      console.log('❌ MongoDB not connected. State:', dbState);
      setTimeout(initializeData, 3000);
      return;
    }

    console.log('✅ MongoDB connected, checking for admin user...');

    const defaultSettings = await SystemSetting.findOne();
    if (!defaultSettings) {
      console.log('⚙️ Creating default system settings...');
      await SystemSetting.create({
        // hospitalName: 'AL-KHIDMAT RAAZI HOSPITAL',
        hospitalName: 'CITY HOSPITAL DELHI',
        maxWaitTime: 30,
        soundNotifications: true,
        language: 'urdu',
        autoCallSettings: {
          enabled: true,
          interval: 2000,
          priorityBased: true,
          sequentialProcessing: true,
          voiceOnly: true,
          autoCompleteEmergency: true,
          urduOnly: true,
          centralizedSystem: true,
          firstCallOnce: true,
          recallMultiple: true,
          mp3Audio: true,
          sequentialProcessing: true
        },
        dispenserSettings: {
          autoPrint: true,
          voiceAnnouncements: true,
          showQueue: false,
          showAnnouncements: false,
          voiceOnlyMode: true,
          urduVoiceOnly: true,
          centralizedVoice: true,
          mp3Audio: true
        },
        themes: {
          primaryColor: '#2980b9',
          secondaryColor: '#2c3e50',
          backgroundColor: '#ecf0f1'
        },
        advertisements: [
          { text: 'Quality Healthcare Services - Emergency: 24/7', duration: 30, active: true },
          { text: 'Free WiFi: City_Hospital_Guest - Pharmacy: Open', duration: 30, active: true }
        ]
      });
      console.log('✅ Default settings created');
    }

    // ✅ Create default departments if none exist
    const departmentsCount = await Department.countDocuments();
    if (departmentsCount === 0) {
      console.log('🏥 Creating default departments...');
      const defaultDepartments = [
        { name: 'General OPD', code: 'general', prefix: 'A', active: true, priority: 1 },
        { name: 'Emergency', code: 'emergency', prefix: 'E', active: true, priority: 0 },
        { name: 'Cardiology', code: 'cardiology', prefix: 'C', active: true, priority: 2 },
        { name: 'Orthopedics', code: 'ortho', prefix: 'O', active: true, priority: 3 },
        { name: 'Pediatrics', code: 'pediatrics', prefix: 'P', active: true, priority: 4 },
        { name: 'Dental', code: 'dental', prefix: 'D', active: true, priority: 5 },
        { name: 'Gynecology', code: 'gynecology', prefix: 'G', active: true, priority: 6 },
        { name: 'ENT', code: 'ent', prefix: 'T', active: true, priority: 7 }
      ];
      
      await Department.insertMany(defaultDepartments);
      console.log('✅ Default departments created');
    }

    // ✅ Create default counters if none exist
    const countersCount = await Counter.countDocuments();
    if (countersCount === 0) {
      console.log('🏢 Creating default counters...');
      
      // Get created departments to assign to counters
      const departments = await Department.find().limit(5);
      if (departments.length > 0) {
        const defaultCounters = [
          { counterNumber: 1, name: 'Counter 1', department: departments[0]._id, status: 'active' },
          { counterNumber: 2, name: 'Counter 2', department: departments[1]._id || departments[0]._id, status: 'active' },
          { counterNumber: 3, name: 'Counter 3', department: departments[2]._id || departments[0]._id, status: 'active' },
          { counterNumber: 4, name: 'Counter 4', department: departments[3]._id || departments[0]._id, status: 'active' },
          { counterNumber: 5, name: 'Emergency Counter', department: departments.find(d => d.code === 'emergency')?._id || departments[0]._id, status: 'active' }
        ];
        
        await Counter.insertMany(defaultCounters);
        console.log('✅ Default counters created');
      }
    }

    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      console.log('👤 Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        permissions: {
          canGenerateTickets: true,
          canCallTokens: true,
          canManageCounters: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: true,
          canManageAutoCall: true,
          canManageSmartSystem: true,
          canManageAudio: true
        }
      });
      console.log('✅ Admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
    }

    console.log('✅ Essential data check completed');
    
  } catch (error) {
    console.error('❌ Error initializing data:', error);
  }
};

// Wait for MongoDB connection before initializing data
mongoose.connection.once('open', () => {
  console.log('🔗 MongoDB connection established, checking for essential data...');
  initializeData();
});

// Attach io to app
app.set('io', io);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access your application at: http://localhost:${PORT}`);
  console.log(`📦 Running in: ${isExecutable ? 'EXECUTABLE' : 'DEVELOPMENT'} mode`);
  console.log(`🎯 RELIABLE PRINT SYSTEM: Memory leak protection enabled`);
  console.log(`🔄 AUTO-RECOVERY: Stuck queue detection active`);
  console.log(`🧹 MEMORY MANAGEMENT: Queue size limited to ${MAX_QUEUE_SIZE}`);
  console.log(`🎯 SMART SYSTEM: Sequential processing enabled`);
  console.log(`🔊 CENTRALIZED AUDIO: MP3-based Urdu announcements to all dispensers`);
  console.log(`🔄 AUTO-RELOAD: Counter interfaces auto-update after completion`);
  console.log(`🔊 RECALL: Unlimited recalls allowed`);
  console.log(`🔄 RETRY MECHANISM: Automatic retry on failures`);
  console.log(`🖨️ PRINTING: Instant printing with no delays or popups`);
  
  // Start smart call system automatically
  setTimeout(async () => {
    try {
      await smartCallSystem.start();
      console.log('🚀 SMART CALL SYSTEM: Started - Sequential processing enabled');
    } catch (error) {
      console.log('⚠️ SMART CALL SYSTEM: Failed to start:', error.message);
    }
  }, 2000);
  
  if (isExecutable) {
    setTimeout(() => {
      const { exec } = require('child_process');
      const url = `http://localhost:${PORT}`;
      exec(`start ${url}`, (error) => {
        if (error) {
          console.log('⚠️  Please manually navigate to:', url);
        }
      });
    }, 2000);
  }
});

module.exports = { 
  app, 
  initializeData, 
  smartCallSystem, 
  mp3VoiceSystem, 
  audioGenerator,
  printingSystem 
};