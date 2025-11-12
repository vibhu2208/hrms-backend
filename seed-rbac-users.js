// Seed script for Super Admin RBAC users
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

const seedUsers = [
  {
    email: 'superadmin@hrms.com',
    password: 'SuperAdmin@123',
    role: 'superadmin',
    internalRole: 'super_admin',
    description: 'Full system control - Owner with all permissions'
  },
  {
    email: 'system.manager@hrms.com',
    password: 'SystemMgr@123',
    role: 'superadmin',
    internalRole: 'system_manager',
    description: 'Client & package management, system configuration'
  },
  {
    email: 'finance.admin@hrms.com',
    password: 'FinanceAdmin@123',
    role: 'superadmin',
    internalRole: 'finance_admin',
    description: 'Billing, subscriptions, and financial reports'
  },
  {
    email: 'compliance.officer@hrms.com',
    password: 'ComplianceOff@123',
    role: 'superadmin',
    internalRole: 'compliance_officer',
    description: 'Legal compliance, audit logs, and data management'
  },
  {
    email: 'tech.admin@hrms.com',
    password: 'TechAdmin@123',
    role: 'superadmin',
    internalRole: 'tech_admin',
    description: 'Infrastructure, data management, system configuration'
  },
  {
    email: 'viewer.analyst@hrms.com',
    password: 'ViewerAnalyst@123',
    role: 'superadmin',
    internalRole: 'viewer',
    description: 'Read-only access to analytics and reports'
  }
];

const seedRBACUsers = async () => {
  try {
    console.log('🚀 Starting Super Admin RBAC User Seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing super admin users (optional - comment out if you want to keep existing)
    // await User.deleteMany({ role: 'superadmin' });
    // console.log('🗑️  Cleared existing Super Admin users');

    console.log('\n📝 Creating Super Admin users with different roles...\n');

    for (const userData of seedUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists - updating role`);
          existingUser.internalRole = userData.internalRole;
          existingUser.isActive = true;
          await existingUser.save();
          console.log(`✅ Updated: ${userData.email} -> ${userData.internalRole}`);
        } else {
          // Hash password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(userData.password, salt);

          // Create new user
          const newUser = new User({
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            internalRole: userData.internalRole,
            isActive: true,
            mustChangePassword: false // Set to true if you want to force password change
          });

          await newUser.save();
          console.log(`✅ Created: ${userData.email} -> ${userData.internalRole}`);
        }
        
        console.log(`   📧 Email: ${userData.email}`);
        console.log(`   🔑 Password: ${userData.password}`);
        console.log(`   👤 Role: ${userData.internalRole}`);
        console.log(`   📝 Description: ${userData.description}`);
        console.log('');
        
      } catch (userError) {
        console.error(`❌ Error creating user ${userData.email}:`, userError.message);
      }
    }

    // Verify all users were created
    const allSuperAdmins = await User.find({ role: 'superadmin' }).select('email internalRole isActive');
    console.log('\n📋 Final Super Admin Users:');
    allSuperAdmins.forEach(user => {
      console.log(`   📧 ${user.email} - Role: ${user.internalRole} - Active: ${user.isActive}`);
    });

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('='.repeat(60));
    
    seedUsers.forEach(user => {
      console.log(`\n👤 ${user.internalRole.toUpperCase().replace('_', ' ')}:`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: ${user.password}`);
      console.log(`   🎯 Access: ${user.description}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🌟 SUPER ADMIN (FULL ACCESS):');
    console.log('   📧 Email: superadmin@hrms.com');
    console.log('   🔑 Password: SuperAdmin@123');
    console.log('   🎯 Access: ALL MODULES & FUNCTIONS');
    console.log('='.repeat(60));

    console.log('\n📚 Next Steps:');
    console.log('1. Login with any of the above credentials');
    console.log('2. Navigate to /super-admin/roles to manage users');
    console.log('3. Check /super-admin/audit for audit logs');
    console.log('4. Test different role permissions');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding
if (require.main === module) {
  seedRBACUsers();
}

module.exports = { seedRBACUsers };
