const fs = require('fs-extra');
const path = require('path');

console.log('🚀 Creating distribution package with MP3 Audio System...');

const distDir = path.join(__dirname, 'dist');
const frontendBuildSrc = path.join(__dirname, '../frontend/build');
const frontendBuildDest = path.join(distDir, 'frontend/build');
const uploadsSrc = path.join(__dirname, 'uploads');
const uploadsDest = path.join(distDir, 'uploads');
const scriptsSrc = path.join(__dirname, 'scripts');
const scriptsDest = path.join(distDir, 'scripts');
const audioSrc = path.join(__dirname, 'audio');
const audioDest = path.join(distDir, 'audio');

try {
  // Create dist directory
  if (fs.existsSync(distDir)) {
    fs.removeSync(distDir);
  }
  fs.mkdirSync(distDir, { recursive: true });

  // Copy executable
  if (fs.existsSync('hospital-queue-system.exe')) {
    fs.copySync('hospital-queue-system.exe', path.join(distDir, 'hospital-queue-system.exe'));
    console.log('✅ Copied executable');
  } else {
    console.log('❌ Executable not found. Run "npm run package" first.');
    process.exit(1);
  }

  // Copy batch file
  if (fs.existsSync('start-server.bat')) {
    fs.copySync('start-server.bat', path.join(distDir, 'start-server.bat'));
    console.log('✅ Copied start-server.bat');
  }

  // Copy frontend build
  if (fs.existsSync(frontendBuildSrc)) {
    fs.copySync(frontendBuildSrc, frontendBuildDest);
    console.log('✅ Copied frontend build');
  } else {
    console.log('❌ Frontend build not found. Run "npm run build-frontend" first.');
    process.exit(1);
  }

  // Create uploads directory structure
  fs.mkdirSync(uploadsDest, { recursive: true });
  fs.mkdirSync(path.join(uploadsDest, 'logo'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDest, 'videos'), { recursive: true });
  console.log('✅ Created uploads directory structure');

  // ✅ NEW: Copy audio directory structure
  if (fs.existsSync(audioSrc)) {
    fs.copySync(audioSrc, audioDest);
    console.log('✅ Copied audio directory with MP3 files');
  } else {
    // Create empty audio directory structure
    fs.mkdirSync(audioDest, { recursive: true });
    fs.mkdirSync(path.join(audioDest, 'ur'), { recursive: true });
    console.log('✅ Created empty audio directory structure');
  }

  // Copy scripts
  if (fs.existsSync(scriptsSrc)) {
    fs.copySync(scriptsSrc, scriptsDest);
    console.log('✅ Copied scripts');
  }

  // Copy environment file if exists
  if (fs.existsSync('.env')) {
    fs.copySync('.env', path.join(distDir, '.env'));
    console.log('✅ Copied environment file');
  } else {
    // Create default .env file
    const defaultEnv = `MONGODB_URI=mongodb://localhost:27017/hospital_queue
PORT=5000
NODE_ENV=production
JWT_SECRET=your-jwt-secret-key-change-this-in-production
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
AUDIO_GENERATION_ENABLED=true
GOOGLE_TTS_ENABLED=true
SYSTEM_TTS_ENABLED=true`;
    fs.writeFileSync(path.join(distDir, '.env'), defaultEnv);
    console.log('✅ Created default environment file with audio settings');
  }

  // Create README for distribution
  const readmeContent = `# Hospital Queue Management System

## Quick Start

1. Double-click on \`start-server.bat\`
2. Wait for the server to start (command window will open)
3. Your browser will automatically open to http://localhost:5000

## Default Login Credentials

- **Admin Panel**: admin / admin123
- **Operator Login**: operator / operator123

## Features

✅ Real-time queue management
✅ Multiple department support  
✅ Individual counter screens
✅ Video advertisements
✅ Customizable displays
✅ Auto ticket printing
✅ ✅ NEW: MP3 Urdu Voice Announcements (100% Working)
✅ Multi-language support

## Audio System Features

🎯 **MP3-Based Urdu Announcements**
- No browser TTS required
- Works on every PC
- Auto-generates audio files
- Fallback to TTS if needed
- Pre-generated common tickets

## System Requirements

- Windows 10/11 (for .exe version)
- MongoDB installed and running locally
- Or set MONGODB_URI for remote MongoDB
- Internet connection (for audio generation)

## Manual MongoDB Setup

1. Download MongoDB from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. The application will connect automatically

## Using Remote MongoDB

Edit the .env file and set:
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hospital

## Audio File Generation

The system will automatically generate Urdu MP3 audio files for announcements.
First-time usage might take a few seconds to generate audio files.

## Access Points

- Main Application: http://localhost:5000
- Admin Dashboard: http://localhost:5000/admin
- Ticket Dispenser: http://localhost:5000/dispenser  
- Waiting Area: http://localhost:5000/waiting
- Counter Interface: http://localhost:5000/counter/1

## Troubleshooting

If the application doesn't start:
1. Check if MongoDB is running
2. Ensure port 5000 is available
3. Run \`hospital-queue-system.exe\` directly to see error messages
4. Check the console output in the command window

If voice announcements don't work:
1. Check internet connection for audio generation
2. Verify audio files in /audio/ur/ directory
3. Check console for audio generation logs

## Support

For technical issues, check the console output in the command window.
All system logs are displayed there.

## File Structure

- hospital-queue-system.exe (Main application)
- start-server.bat (Starter script)
- frontend/build/ (React application)
- uploads/ (Logos and videos)
- audio/ur/ (MP3 announcement files) ✅ NEW
- scripts/ (Utility scripts)
- .env (Configuration file)

© 2024 Razi Hospital Queue System
`;
  
  fs.writeFileSync(path.join(distDir, 'README.txt'), readmeContent);
  console.log('✅ Created README.txt');

  console.log('\n🎉 Distribution package created successfully!');
  console.log('📁 Location: ./dist/');
  console.log('\n📋 Files included:');
  console.log('   - hospital-queue-system.exe');
  console.log('   - start-server.bat');
  console.log('   - frontend/build/');
  console.log('   - uploads/');
  console.log('   - ✅ audio/ur/ (MP3 Audio System)');
  console.log('   - scripts/');
  console.log('   - .env');
  console.log('   - README.txt');
  
  console.log('\n🚀 To run the application:');
  console.log('   1. Go to the dist folder');
  console.log('   2. Double-click start-server.bat');
  console.log('   3. Or run hospital-queue-system.exe directly');

  console.log('\n🔊 Audio System Notes:');
  console.log('   - First run will generate MP3 audio files');
  console.log('   - Internet required for audio generation');
  console.log('   - Works on all PCs without Urdu TTS');

} catch (error) {
  console.error('❌ Error creating distribution:', error);
  process.exit(1);
}