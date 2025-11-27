const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

class UrduAudioGenerator {
  constructor() {
    this.audioDir = path.join(__dirname, '../audio/ur');
    this.ensureAudioDirectory();
  }

  ensureAudioDirectory() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
      console.log('✅ Created audio directory:', this.audioDir);
    }
  }

  // Method 1: Using Google Translate TTS (Free)
  async generateWithGoogleTTS(text, filename) {
    try {
      // Google Translate TTS URL for Urdu
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ur&client=tw-ob`;
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const filePath = path.join(this.audioDir, filename);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Generated: ${filename}`);
          resolve(filePath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`❌ Google TTS failed for ${filename}:`, error.message);
      return null;
    }
  }

  // Method 2: Using system TTS (Windows)
  async generateWithSystemTTS(text, filename) {
    return new Promise((resolve) => {
      const filePath = path.join(this.audioDir, filename);
      
      // PowerShell command for Windows TTS (requires Urdu voice pack)
      const powershellCommand = `Add-Type -AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.SetOutputToWaveFile("${filePath}"); $speak.Speak("${text}"); $speak.Dispose()`;
      
      exec(`powershell -Command "${powershellCommand}"`, (error) => {
        if (error) {
          console.error(`❌ System TTS failed for ${filename}:`, error.message);
          resolve(null);
        } else {
          console.log(`✅ Generated: ${filename}`);
          resolve(filePath);
        }
      });
    });
  }

  // Generate announcement audio for a specific ticket and counter
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

  // Batch generate audio files for common patterns
  async generateCommonAudioFiles() {
    console.log('🚀 Generating common audio files...');
    
    const commonPatterns = [
      // Emergency tickets
      { ticket: 'E001', counter: 1 },
      { ticket: 'E002', counter: 1 },
      { ticket: 'E003', counter: 1 },
      
      // General OPD tickets
      { ticket: 'A001', counter: 1 },
      { ticket: 'A002', counter: 1 },
      { ticket: 'A003', counter: 1 },
      { ticket: 'A004', counter: 2 },
      { ticket: 'A005', counter: 2 },
      { ticket: 'A006', counter: 2 },
      { ticket: 'A007', counter: 3 },
      { ticket: 'A008', counter: 3 },
      
      // Cardiology tickets
      { ticket: 'B001', counter: 3 },
      { ticket: 'B002', counter: 3 },
      { ticket: 'B003', counter: 3 },
      { ticket: 'B004', counter: 4 },
      { ticket: 'B005', counter: 4 },
      
      // Orthopedics tickets
      { ticket: 'C001', counter: 4 },
      { ticket: 'C002', counter: 4 },
      { ticket: 'C003', counter: 5 },
      { ticket: 'C004', counter: 5 },
      
      // Pediatrics tickets
      { ticket: 'D001', counter: 5 },
      { ticket: 'D002', counter: 5 },
      { ticket: 'D003', counter: 6 },
      { ticket: 'D004', counter: 6 },

      // Dental tickets
      { ticket: 'F001', counter: 6 },
      { ticket: 'F002', counter: 6 },
      { ticket: 'F003', counter: 7 },
      { ticket: 'F004', counter: 7 },
    ];

    let successCount = 0;
    let failCount = 0;

    for (const pattern of commonPatterns) {
      const result = await this.generateAnnouncementAudio(pattern.ticket, pattern.counter);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 Generation Summary:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📁 Audio files location: ${this.audioDir}`);
    
    return { success: successCount, failed: failCount, total: commonPatterns.length };
  }

  // Check if audio file exists
  audioExists(ticketNumber, counterNumber) {
    const filename = this.getAudioFilename(ticketNumber, counterNumber);
    const filePath = path.join(this.audioDir, filename);
    return fs.existsSync(filePath);
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
          modified: stats.mtime
        };
      });
  }

  // Get audio file statistics
  getAudioStats() {
    const files = this.listAudioFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles: files.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      files: files
    };
  }

  // Clean up old audio files
  cleanupOldAudioFiles(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const files = this.listAudioFiles();
    let deletedCount = 0;
    
    files.forEach(file => {
      if (file.modified < cutoffDate) {
        try {
          fs.unlinkSync(file.path);
          deletedCount++;
          console.log(`🧹 Deleted old audio file: ${file.filename}`);
        } catch (error) {
          console.error(`❌ Failed to delete ${file.filename}:`, error.message);
        }
      }
    });
    
    console.log(`✅ Cleanup completed: ${deletedCount} files deleted`);
    return deletedCount;
  }
}

// CLI interface
if (require.main === module) {
  const generator = new UrduAudioGenerator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'generate-all':
      generator.generateCommonAudioFiles();
      break;
      
    case 'generate':
      const ticket = process.argv[3];
      const counter = process.argv[4];
      if (ticket && counter) {
        generator.generateAnnouncementAudio(ticket, parseInt(counter));
      } else {
        console.log('Usage: node generate-urdu-audio.js generate <ticket> <counter>');
      }
      break;
      
    case 'list':
      const files = generator.listAudioFiles();
      console.log('📁 Generated audio files:');
      files.forEach(file => {
        console.log(`   ${file.filename} (${(file.size / 1024).toFixed(1)} KB) - ${file.modified.toLocaleDateString()}`);
      });
      break;
      
    case 'stats':
      const stats = generator.getAudioStats();
      console.log('📊 Audio Statistics:');
      console.log(`   Total Files: ${stats.totalFiles}`);
      console.log(`   Total Size: ${stats.totalSizeMB} MB`);
      break;
      
    case 'check':
      const checkTicket = process.argv[3];
      const checkCounter = process.argv[4];
      if (checkTicket && checkCounter) {
        const exists = generator.audioExists(checkTicket, checkCounter);
        console.log(`Audio file for ${checkTicket}-counter${checkCounter}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
      } else {
        console.log('Usage: node generate-urdu-audio.js check <ticket> <counter>');
      }
      break;
      
    case 'cleanup':
      const days = process.argv[3] || 30;
      generator.cleanupOldAudioFiles(parseInt(days));
      break;
      
    default:
      console.log(`
🎯 Urdu Audio Generator - Commands:

  generate-all    - Generate common audio files
  generate <ticket> <counter> - Generate specific audio file
  list            - List all generated audio files
  stats           - Show audio statistics
  check <ticket> <counter> - Check if audio file exists
  cleanup [days]  - Clean up files older than days (default: 30)

Examples:
  node generate-urdu-audio.js generate-all
  node generate-urdu-audio.js generate A001 1
  node generate-urdu-audio.js list
  node generate-urdu-audio.js stats
  node generate-urdu-audio.js check A001 1
  node generate-urdu-audio.js cleanup 30
      `);
      break;
  }
}

module.exports = UrduAudioGenerator;