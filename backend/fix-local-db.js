const mongoose = require('mongoose');
const SystemSetting = require('./models/SystemSetting');

// Connect to local MongoDB
mongoose.connect('mongodb://localhost:27017/hospital', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function updateLocalDatabase() {
  try {
    console.log('🔄 Connecting to local MongoDB...');
    
    // First, let's see what's currently in the database
    const currentSettings = await SystemSetting.findOne();
    console.log('📋 Current settings:', currentSettings ? currentSettings.hospitalName : 'No settings found');
    
    // Update or create new settings with correct hospital name
    const result = await SystemSetting.updateOne(
      {}, // Update any existing document
      {
        $set: {
          hospitalName: 'CITY HOSPITAL DELHI',
          hospitalCity: 'DELHI'
        }
      },
      { upsert: true } // Create if doesn't exist
    );
    
    console.log('✅ Database updated successfully!');
    console.log('📊 Modified documents:', result.modifiedCount);
    console.log('📝 Upserted documents:', result.upsertedCount);
    
    // Verify the update
    const updatedSettings = await SystemSetting.findOne();
    console.log('🏥 New hospital name:', updatedSettings.hospitalName);
    console.log('📍 New hospital city:', updatedSettings.hospitalCity);
    
    console.log('🎉 Local database successfully updated with CITY HOSPITAL DELHI!');
    
  } catch (error) {
    console.error('❌ Error updating database:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the update
updateLocalDatabase();