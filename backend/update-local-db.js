const mongoose = require('mongoose');

// Local MongoDB connection
const MONGODB_URI = 'mongodb://localhost:27017/hospital';

// Simple schema for system settings
const systemSettingsSchema = new mongoose.Schema({}, { strict: false });
const SystemSetting = mongoose.model('systemsettings', systemSettingsSchema);

async function updateLocalDatabase() {
  try {
    console.log('🔄 Connecting to local MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to local database');

    // Check current settings
    console.log('\n📋 Current settings:');
    const currentSettings = await SystemSetting.findOne();
    if (currentSettings) {
      console.log('   Hospital Name:', currentSettings.hospitalName);
      console.log('   Hospital City:', currentSettings.hospitalCity);
    } else {
      console.log('   No settings found');
    }

    // Update hospital name and city
    console.log('\n🔄 Updating hospital information...');
    const updateResult = await SystemSetting.updateOne(
      {}, // Update first document
      {
        $set: {
          hospitalName: 'CITY HOSPITAL DELHI',
          hospitalCity: 'DELHI'
        }
      },
      { upsert: true } // Create if doesn't exist
    );

    if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
      console.log('✅ Hospital information updated successfully!');
    }

    // Verify update
    console.log('\n📋 Updated settings:');
    const updatedSettings = await SystemSetting.findOne();
    console.log('   Hospital Name:', updatedSettings.hospitalName);
    console.log('   Hospital City:', updatedSettings.hospitalCity);

    console.log('\n🎉 Local database updated successfully!');
    console.log('🔄 Please restart the backend server to see changes');

  } catch (error) {
    console.error('❌ Error updating database:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the update
updateLocalDatabase();