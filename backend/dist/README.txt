# Hospital Queue Management System

## Quick Start

1. Double-click on `start-server.bat`
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
3. Run `hospital-queue-system.exe` directly to see error messages
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
