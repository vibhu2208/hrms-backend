// Migration Script for Super Admin RBAC Implementation
// This script updates existing Super Admin users to have internal roles

const mongoose = require('mongoose');
const User = require('./src/models/User');

// MongoDB connection string - update as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

const migrateSuperAdminRoles = async () => {
  try {
    console.log('🚀 Starting Super Admin RBAC Migration...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all existing Super Admin users
    const superAdminUsers = await User.find({ role: 'superadmin' });
    console.log(`📊 Found ${superAdminUsers.length} Super Admin users to migrate`);

    if (superAdminUsers.length === 0) {
      console.log('⚠️  No Super Admin users found. Creating default Super Admin...');
      
      // Create default Super Admin if none exists
      const defaultSuperAdmin = new User({
        email: 'superadmin@hrms.com',
        password: 'SuperAdmin@123',
        role: 'superadmin',
        internalRole: 'super_admin',
        isActive: true
      });
      
      await defaultSuperAdmin.save();
      console.log('✅ Created default Super Admin user');
      console.log('📧 Email: superadmin@hrms.com');
      console.log('🔑 Password: SuperAdmin@123');
      console.log('⚠️  Please change the default password after first login!');
    } else {
      // Migrate existing users
      let migratedCount = 0;
      
      for (const user of superAdminUsers) {
        if (!user.internalRole) {
          // Assign 'super_admin' role to existing Super Admin users
          user.internalRole = 'super_admin';
          await user.save();
          migratedCount++;
          console.log(`✅ Migrated user: ${user.email} -> super_admin`);
        } else {
          console.log(`⏭️  User ${user.email} already has internal role: ${user.internalRole}`);
        }
      }
      
      console.log(`🎉 Migration completed! ${migratedCount} users migrated.`);
    }

    // Verify migration
    const updatedUsers = await User.find({ role: 'superadmin' });
    console.log('\n📋 Final Super Admin Users:');
    updatedUsers.forEach(user => {
      console.log(`   📧 ${user.email} - Role: ${user.internalRole} - Active: ${user.isActive}`);
    });

    console.log('\n🔐 Available Internal Roles:');
    console.log('   - super_admin: Full system control (Owner)');
    console.log('   - system_manager: Client & package management');
    console.log('   - finance_admin: Billing & subscriptions');
    console.log('   - compliance_officer: Compliance & audit logs');
    console.log('   - tech_admin: Infrastructure & data management');
    console.log('   - viewer: Read-only analytics & reports');

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Additional utility function to create specific role users
const createRoleUser = async (email, password, internalRole) => {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`⚠️  User ${email} already exists`);
      return;
    }

    const newUser = new User({
      email,
      password,
      role: 'superadmin',
      internalRole,
      isActive: true,
      mustChangePassword: true
    });

    await newUser.save();
    console.log(`✅ Created ${internalRole} user: ${email}`);
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Check if script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run migration
    migrateSuperAdminRoles();
  } else if (args[0] === 'create-user' && args.length === 4) {
    // Create specific role user
    const [, email, password, internalRole] = args;
    createRoleUser(email, password, internalRole);
  } else {
    console.log('Usage:');
    console.log('  node migrate-superadmin-roles.js                                    # Run migration');
    console.log('  node migrate-superadmin-roles.js create-user <email> <password> <role>  # Create specific user');
    console.log('');
    console.log('Available roles: super_admin, system_manager, finance_admin, compliance_officer, tech_admin, viewer');
  }
}

module.exports = { migrateSuperAdminRoles, createRoleUser };
