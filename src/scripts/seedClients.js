const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Client = require('../models/Client');
const User = require('../models/User');
require('dotenv').config();

const clients = [
  {
    name: 'TechCorp Solutions',
    companyName: 'TechCorp Solutions',
    clientCode: 'TECH001',
    email: 'admin@techcorp.com',
    phone: '+1-555-0101',
    website: 'https://techcorp.com',
    industry: 'Technology',
    companySize: '50-100',
    contactPerson: {
      name: 'John Smith',
      email: 'john.smith@techcorp.com',
      phone: '+1-555-0102',
      position: 'HR Manager'
    },
    address: {
      street: '123 Tech Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA'
    },
    subscription: {
      status: 'trial',
      billingCycle: 'monthly'
    },
    enabledModules: ['hr', 'attendance'],
    status: 'active'
  },
  {
    name: 'Green Energy Ltd',
    companyName: 'Green Energy Ltd',
    clientCode: 'GREEN001',
    email: 'contact@greenenergy.com',
    phone: '+1-555-0201',
    website: 'https://greenenergy.com',
    industry: 'Energy',
    companySize: '100-500',
    contactPerson: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@greenenergy.com',
      phone: '+1-555-0202',
      position: 'Operations Director'
    },
    address: {
      street: '456 Renewable Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      country: 'USA'
    },
    subscription: {
      status: 'active',
      billingCycle: 'yearly'
    },
    enabledModules: ['hr', 'attendance', 'timesheet', 'payroll'],
    status: 'active'
  },
  {
    name: 'Healthcare Plus',
    companyName: 'Healthcare Plus',
    clientCode: 'HEALTH001',
    email: 'info@healthcareplus.com',
    phone: '+1-555-0301',
    website: 'https://healthcareplus.com',
    industry: 'Healthcare',
    companySize: '200-500',
    contactPerson: {
      name: 'Dr. Michael Chen',
      email: 'michael.chen@healthcareplus.com',
      phone: '+1-555-0302',
      position: 'Chief Administrator'
    },
    address: {
      street: '789 Medical Center Blvd',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA'
    },
    subscription: {
      status: 'active',
      billingCycle: 'monthly'
    },
    enabledModules: ['hr', 'attendance', 'timesheet', 'payroll', 'recruitment'],
    status: 'active'
  },
  {
    name: 'Manufacturing Co',
    companyName: 'Manufacturing Co',
    clientCode: 'MFG001',
    email: 'hr@manufacturingco.com',
    phone: '+1-555-0401',
    website: 'https://manufacturingco.com',
    industry: 'Manufacturing',
    companySize: '500+',
    contactPerson: {
      name: 'Lisa Rodriguez',
      email: 'lisa.rodriguez@manufacturingco.com',
      phone: '+1-555-0402',
      position: 'HR Director'
    },
    address: {
      street: '321 Industrial Way',
      city: 'Detroit',
      state: 'MI',
      zipCode: '48201',
      country: 'USA'
    },
    subscription: {
      status: 'suspended',
      billingCycle: 'quarterly'
    },
    enabledModules: ['hr', 'attendance', 'timesheet'],
    status: 'suspended'
  },
  {
    name: 'StartupHub Inc',
    companyName: 'StartupHub Inc',
    clientCode: 'START001',
    email: 'team@startuphub.com',
    phone: '+1-555-0501',
    website: 'https://startuphub.com',
    industry: 'Technology',
    companySize: '10-50',
    contactPerson: {
      name: 'Alex Thompson',
      email: 'alex.thompson@startuphub.com',
      phone: '+1-555-0502',
      position: 'Co-Founder'
    },
    address: {
      street: '555 Innovation Drive',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA'
    },
    subscription: {
      status: 'trial',
      billingCycle: 'monthly'
    },
    enabledModules: ['hr', 'attendance'],
    status: 'active'
  }
];

const seedClients = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Clear existing clients (but keep super admin clients)
    await Client.deleteMany({ 
      clientCode: { $nin: ['SUPERADMIN'] } // Don't delete super admin client
    });
    console.log('Cleared existing clients (except super admin)');

    // Insert new clients
    const insertedClients = await Client.insertMany(clients);
    console.log(`✅ Successfully seeded ${insertedClients.length} clients:`);
    
    // Create admin users for each client
    console.log('\n👤 Creating admin users for each client...');
    
    for (const client of insertedClients) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: client.contactPerson.email });
        if (existingUser) {
          console.log(`   ⚠️  User already exists: ${client.contactPerson.email}`);
          continue;
        }

        // Create admin user for this client
        const hashedPassword = await bcrypt.hash('password123', 10);
        const adminUser = new User({
          name: client.contactPerson.name,
          email: client.contactPerson.email,
          password: hashedPassword,
          role: 'admin',
          clientId: client._id,
          isActive: true,
          permissions: {
            canManageEmployees: true,
            canManagePayroll: true,
            canViewReports: true,
            canManageSettings: true
          }
        });

        await adminUser.save();
        console.log(`   ✅ Created admin user: ${client.contactPerson.name} (${client.contactPerson.email})`);
      } catch (userError) {
        console.error(`   ❌ Error creating user for ${client.companyName}:`, userError.message);
      }
    }

    console.log('\n📊 Client Summary:');
    insertedClients.forEach(client => {
      console.log(`   - ${client.companyName} (${client.clientCode}) - ${client.status}`);
      console.log(`     Contact: ${client.contactPerson.name} (${client.contactPerson.email})`);
      console.log(`     Subscription: ${client.subscription.status} - ${client.subscription.billingCycle}`);
      console.log(`     Modules: ${client.enabledModules.join(', ')}`);
      console.log('');
    });

    console.log('🎉 Client seeding completed successfully!');
    console.log('\n🔑 Login Credentials:');
    console.log('   Default password for all admin users: password123');
    console.log('   Email addresses are listed above for each client contact person');
    
  } catch (error) {
    console.error('❌ Error seeding clients:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
if (require.main === module) {
  seedClients();
}

module.exports = seedClients;
