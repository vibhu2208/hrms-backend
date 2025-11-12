const mongoose = require('mongoose');
const Package = require('../models/Package');
const Client = require('../models/Client');
require('dotenv').config();

const testPackageAPI = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Test the exact same query that the API uses
    const query = {};
    const sort = { createdAt: -1 };
    const limit = 10;
    const page = 1;

    console.log('\n🔍 Testing package query...');
    console.log('Query object:', query);

    const packages = await Package.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log(`📦 Found ${packages.length} packages from direct DB query:`);
    
    packages.forEach((pkg, index) => {
      console.log(`\n${index + 1}. ${pkg.name}`);
      console.log(`   - Type: ${pkg.type}`);
      console.log(`   - Price: $${pkg.pricing.monthly}/month`);
      console.log(`   - Active: ${pkg.isActive}`);
      console.log(`   - Modules: ${pkg.includedModules?.length || 0}`);
      console.log(`   - Package Code: ${pkg.packageCode}`);
    });

    // Test with usage count (same as API)
    console.log('\n🔄 Testing with usage count calculation...');
    const packagesWithUsage = await Promise.all(
      packages.map(async (pkg) => {
        const usageCount = await Client.countDocuments({
          'subscription.packageId': pkg._id
        });
        return {
          ...pkg.toObject(),
          usageCount
        };
      })
    );

    console.log(`✅ Processed ${packagesWithUsage.length} packages with usage count`);

    // Test response format
    const apiResponse = {
      success: true,
      data: {
        packages: packagesWithUsage,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(packages.length / limit),
          total: packages.length
        }
      }
    };

    console.log('\n📋 API Response structure:');
    console.log('- success:', apiResponse.success);
    console.log('- data.packages.length:', apiResponse.data.packages.length);
    console.log('- data.pagination:', apiResponse.data.pagination);

    console.log('\n✅ Package API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing package API:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the test function
testPackageAPI();
