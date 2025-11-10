require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Package = require('./src/models/Package');
const SystemConfig = require('./src/models/SystemConfig');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedSuperAdmin = async () => {
  try {
    console.log('🌱 Starting Super Admin seeding...');

    // Check if super admin already exists
    let superAdmin = await User.findOne({ role: 'superadmin' });
    if (superAdmin) {
      console.log('⚠️  Super Admin already exists:', superAdmin.email);
    } else {
      // Create Super Admin user
      const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10);
      
      superAdmin = new User({
        email: process.env.SUPER_ADMIN_EMAIL,
        password: hashedPassword,
        role: 'superadmin',
        isActive: true,
        isFirstLogin: false,
        mustChangePassword: false
      });

      await superAdmin.save();
      console.log('✅ Super Admin created:', superAdmin.email);
    }

    // Create default packages
    console.log('🎁 Creating default packages...');
    const defaultPackages = [
      {
        name: 'Starter Package',
        description: 'Perfect for small businesses getting started with HRMS',
        type: 'starter',
        pricing: {
          monthly: 29,
          quarterly: 75,
          yearly: 290,
          currency: 'USD'
        },
        features: {
          maxEmployees: 25,
          maxAdmins: 1,
          storageLimit: 5,
          customBranding: false,
          apiAccess: false,
          advancedReporting: false,
          multiLocation: false,
          integrations: false
        },
        includedModules: ['hr', 'attendance'],
        addOnModules: [
          { module: 'payroll', price: 10 },
          { module: 'recruitment', price: 15 }
        ],
        isActive: true,
        trialDays: 14
      },
      {
        name: 'Professional Package',
        description: 'Comprehensive solution for growing businesses',
        type: 'professional',
        pricing: {
          monthly: 79,
          quarterly: 210,
          yearly: 790,
          currency: 'USD'
        },
        features: {
          maxEmployees: 100,
          maxAdmins: 3,
          storageLimit: 25,
          customBranding: true,
          apiAccess: true,
          advancedReporting: true,
          multiLocation: false,
          integrations: true
        },
        includedModules: ['hr', 'attendance', 'payroll', 'recruitment', 'performance'],
        addOnModules: [
          { module: 'assets', price: 20 },
          { module: 'compliance', price: 25 }
        ],
        isActive: true,
        isPopular: true,
        trialDays: 14
      },
      {
        name: 'Enterprise Package',
        description: 'Full-featured solution for large organizations',
        type: 'enterprise',
        pricing: {
          monthly: 199,
          quarterly: 540,
          yearly: 1990,
          currency: 'USD'
        },
        features: {
          maxEmployees: -1, // Unlimited
          maxAdmins: 10,
          storageLimit: 100,
          customBranding: true,
          apiAccess: true,
          advancedReporting: true,
          multiLocation: true,
          integrations: true
        },
        includedModules: ['hr', 'attendance', 'payroll', 'recruitment', 'performance', 'assets', 'compliance', 'timesheet'],
        addOnModules: [],
        isActive: true,
        trialDays: 30
      }
    ];

    for (const packageData of defaultPackages) {
      const existingPackage = await Package.findOne({ name: packageData.name });
      if (!existingPackage) {
        await Package.create(packageData);
        console.log(`✅ Package created: ${packageData.name}`);
      } else {
        console.log(`⚠️  Package already exists: ${packageData.name}`);
      }
    }

    // Create default system configurations
    const defaultConfigs = [
      {
        key: 'system_name',
        value: 'HRMS Pro',
        description: 'System name displayed in the application',
        category: 'branding'
      },
      {
        key: 'default_trial_days',
        value: 14,
        description: 'Default trial period for new clients',
        category: 'features'
      },
      {
        key: 'max_file_upload_size',
        value: 5242880, // 5MB
        description: 'Maximum file upload size in bytes',
        category: 'features'
      },
      {
        key: 'email_notifications_enabled',
        value: true,
        description: 'Enable system-wide email notifications',
        category: 'notifications'
      },
      {
        key: 'data_retention_days',
        value: 365,
        description: 'Default data retention period in days',
        category: 'security'
      },
      {
        key: 'session_timeout_minutes',
        value: 480, // 8 hours
        description: 'User session timeout in minutes',
        category: 'security'
      }
    ];

    for (const configData of defaultConfigs) {
      const existingConfig = await SystemConfig.findOne({ key: configData.key });
      if (!existingConfig) {
        await SystemConfig.create({
          ...configData,
          lastModifiedBy: superAdmin._id
        });
        console.log(`✅ System config created: ${configData.key}`);
      } else {
        console.log(`⚠️  System config already exists: ${configData.key}`);
      }
    }

    console.log('🎉 Super Admin seeding completed successfully!');
    console.log('📧 Super Admin Email:', 'vaibhavsingh5373@gmail.com');
    console.log('🔑 Super Admin Password:', 'admin123');
    
  } catch (error) {
    console.error('❌ Error seeding Super Admin:', error);
  }
};

const runSeeder = async () => {
  await connectDB();
  await seedSuperAdmin();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

runSeeder();
