const mongoose = require('mongoose');
const Package = require('../models/Package');
require('dotenv').config();

const packages = [
  {
    name: 'Starter Plan',
    description: 'Perfect for small businesses getting started with HR management',
    type: 'starter',
    pricing: {
      monthly: 29,
      quarterly: 78, // 10% discount
      yearly: 290,   // 17% discount
      currency: 'USD'
    },
    features: {
      maxEmployees: 25,
      maxAdmins: 2,
      storageLimit: 5,
      customBranding: false,
      apiAccess: false,
      advancedReporting: false,
      multiLocation: false,
      integrations: false
    },
    includedModules: ['hr', 'attendance'],
    addOnModules: [
      { module: 'timesheet', price: 5 },
      { module: 'assets', price: 10 }
    ],
    isActive: true,
    isPopular: false,
    trialDays: 14
  },
  {
    name: 'Professional Plan',
    description: 'Comprehensive HR solution for growing businesses',
    type: 'professional',
    pricing: {
      monthly: 79,
      quarterly: 213, // 10% discount
      yearly: 790,    // 17% discount
      currency: 'USD'
    },
    features: {
      maxEmployees: 100,
      maxAdmins: 5,
      storageLimit: 25,
      customBranding: true,
      apiAccess: true,
      advancedReporting: true,
      multiLocation: false,
      integrations: true
    },
    includedModules: ['hr', 'attendance', 'timesheet', 'payroll', 'recruitment'],
    addOnModules: [
      { module: 'performance', price: 15 },
      { module: 'assets', price: 10 },
      { module: 'compliance', price: 20 }
    ],
    isActive: true,
    isPopular: true,
    trialDays: 14
  },
  {
    name: 'Enterprise Plan',
    description: 'Full-featured HR platform for large organizations',
    type: 'enterprise',
    pricing: {
      monthly: 199,
      quarterly: 537, // 10% discount
      yearly: 1990,   // 17% discount
      currency: 'USD'
    },
    features: {
      maxEmployees: -1, // Unlimited
      maxAdmins: -1,    // Unlimited
      storageLimit: 100,
      customBranding: true,
      apiAccess: true,
      advancedReporting: true,
      multiLocation: true,
      integrations: true
    },
    includedModules: ['hr', 'attendance', 'timesheet', 'payroll', 'recruitment', 'performance', 'assets', 'compliance'],
    addOnModules: [],
    isActive: true,
    isPopular: false,
    trialDays: 30
  },
  {
    name: 'Custom Enterprise',
    description: 'Tailored solution for enterprise clients with specific requirements',
    type: 'custom',
    pricing: {
      monthly: 0, // Custom pricing
      quarterly: 0,
      yearly: 0,
      currency: 'USD'
    },
    features: {
      maxEmployees: -1,
      maxAdmins: -1,
      storageLimit: -1, // Unlimited
      customBranding: true,
      apiAccess: true,
      advancedReporting: true,
      multiLocation: true,
      integrations: true
    },
    includedModules: ['hr', 'attendance', 'timesheet', 'payroll', 'recruitment', 'performance', 'assets', 'compliance'],
    addOnModules: [],
    isActive: true,
    isPopular: false,
    trialDays: 30
  }
];

const seedPackages = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Clear existing packages
    await Package.deleteMany({});
    console.log('Cleared existing packages');

    // Insert new packages
    const insertedPackages = await Package.insertMany(packages);
    console.log(`✅ Successfully seeded ${insertedPackages.length} packages:`);
    
    insertedPackages.forEach(pkg => {
      console.log(`   - ${pkg.name} (${pkg.type}) - $${pkg.pricing.monthly}/month`);
    });

    console.log('\n🎉 Package seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding packages:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
if (require.main === module) {
  seedPackages();
}

module.exports = seedPackages;
