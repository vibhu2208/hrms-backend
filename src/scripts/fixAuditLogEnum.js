const mongoose = require('mongoose');
require('dotenv').config();

const fixAuditLogEnum = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Drop the SuperAdminAuditLog collection to reset the schema validation
    try {
      await mongoose.connection.db.collection('superadminauditlogs').drop();
      console.log('✅ Dropped SuperAdminAuditLog collection');
    } catch (error) {
      if (error.message.includes('ns not found')) {
        console.log('ℹ️ SuperAdminAuditLog collection does not exist, no need to drop');
      } else {
        throw error;
      }
    }

    // The collection will be recreated with the new schema when the first document is inserted
    console.log('✅ SuperAdminAuditLog schema will be recreated with new enum values');
    console.log('🎉 Enum fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing audit log enum:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the fix function
fixAuditLogEnum();
