const mongoose = require('mongoose');
const Package = require('../models/Package');
require('dotenv').config();

const checkPackages = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Get all packages
    const packages = await Package.find({});
    console.log(`\n📦 Found ${packages.length} packages in database:`);
    
    packages.forEach((pkg, index) => {
      console.log(`\n${index + 1}. ${pkg.name}`);
      console.log(`   - Type: ${pkg.type}`);
      console.log(`   - Price: $${pkg.pricing.monthly}/month`);
      console.log(`   - Active: ${pkg.isActive}`);
      console.log(`   - Modules: ${pkg.includedModules?.length || 0}`);
      console.log(`   - Package Code: ${pkg.packageCode}`);
      console.log(`   - ID: ${pkg._id}`);
    });

    console.log('\n✅ Package check completed!');
    
  } catch (error) {
    console.error('❌ Error checking packages:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the check function
checkPackages();
