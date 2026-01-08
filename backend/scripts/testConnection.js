import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';

dotenv.config();

const testConnection = async () => {
  try {
    console.log('🔄 Testing MongoDB connection...');
    console.log(`📍 Connection URI: ${process.env.MONGODB_URI}`);
    
    await connectDB();
    
    console.log('✅ MongoDB connection successful!');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log(`🔌 Port: ${mongoose.connection.port}`);
    console.log(`📈 Ready State: ${mongoose.connection.readyState}`);
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📁 Collections found: ${collections.length}`);
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Make sure MongoDB is running locally:');
      console.log('   - Windows: Start MongoDB service or run `mongod`');
      console.log('   - Mac: `brew services start mongodb-community`');
      console.log('   - Linux: `sudo systemctl start mongod`');
      console.log('2. Or use MongoDB Atlas cloud service');
      console.log('3. Check your MONGODB_URI in .env file');
    }
    
    process.exit(1);
  }
};

testConnection();