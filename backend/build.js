const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 Building Hospital Queue System Executable...');

try {
  // Check if frontend build exists, if not build it
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  
  if (!fs.existsSync(frontendBuildPath)) {
    console.log('📦 Building React frontend...');
    execSync('npm run build', { 
      cwd: path.join(__dirname, '../frontend'),
      stdio: 'inherit'
    });
  }

  // Copy necessary files for packaging
  console.log('📁 Copying required files...');
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Copy environment file if exists
  const envSource = path.join(__dirname, '.env');
  const envDest = path.join(__dirname, '.env.package');
  if (fs.existsSync(envSource)) {
    fs.copySync(envSource, envDest);
  } else {
    // Create a default .env file
    const defaultEnv = `MONGODB_URI=mongodb://localhost:27017/hospital
PORT=5000
NODE_ENV=production
JWT_SECRET=your-secret-key-here`;
    fs.writeFileSync(envDest, defaultEnv);
  }

  console.log('✅ Build preparation completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm install pkg -g');
  console.log('2. Run: npm run package');
  
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}