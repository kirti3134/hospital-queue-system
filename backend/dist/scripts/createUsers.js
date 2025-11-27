const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Model (copy from your User.js)
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
    enum: ['admin', 'operator', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

const createUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');

    // Check if users already exist
    const existingAdmin = await User.findOne({ username: 'admin' });
    const existingOperator = await User.findOne({ username: 'operator' });

    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
    } else {
      const hashedAdminPassword = await bcrypt.hash('admin123', 12);
      const adminUser = new User({
        username: 'admin',
        password: hashedAdminPassword,
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Admin user created: admin / admin123');
    }

    if (existingOperator) {
      console.log('⚠️ Operator user already exists');
    } else {
      const hashedOperatorPassword = await bcrypt.hash('operator123', 12);
      const operatorUser = new User({
        username: 'operator',
        password: hashedOperatorPassword,
        role: 'operator'
      });
      await operatorUser.save();
      console.log('✅ Operator user created: operator / operator123');
    }

    console.log('🎉 User setup completed!');
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔗 MongoDB connection closed');
  }
};

createUsers();