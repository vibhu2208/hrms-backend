#!/usr/bin/env node

/**
 * Database Seeding Script
 * Run this to populate the database with test data for billing management
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { seedBillingData } = require('../seeders/billingSeeder');

async function main() {
  try {
    console.log('🚀 Starting database seeding...');
    console.log('📡 Connecting to database...');
    
    // Connect to database
    await connectDB();
    
    console.log('✅ Database connected successfully');
    
    // Ask user if they want to clear existing data
    const args = process.argv.slice(2);
    const clearExisting = args.includes('--clear') || args.includes('-c');
    
    if (clearExisting) {
      console.log('⚠️  WARNING: This will clear existing billing data!');
      console.log('   Proceeding in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Run the seeding
    const result = await seedBillingData(clearExisting);
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   ✓ ${result.users.length} Users (with internal roles)`);
    console.log(`   ✓ ${result.clients.length} Clients`);
    console.log(`   ✓ ${result.packages.length} Packages`);
    console.log(`   ✓ ${result.subscriptions.length} Subscriptions`);
    console.log(`   ✓ ${result.invoices.length} Invoices`);
    console.log(`   ✓ ${result.payments.length} Payments`);
    
    console.log('\n🔑 Test Login Credentials:');
    console.log('   Super Admin: superadmin@hrms.com / password');
    console.log('   Finance Admin: finance@hrms.com / password');
    
    console.log('\n📱 You can now test the billing management features!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
    process.exit(0);
  }
}

// Handle script arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🌱 Database Seeding Script

Usage:
  node src/scripts/seedDatabase.js [options]

Options:
  --clear, -c    Clear existing billing data before seeding
  --help, -h     Show this help message

Examples:
  node src/scripts/seedDatabase.js           # Seed without clearing
  node src/scripts/seedDatabase.js --clear   # Clear and seed
  `);
  process.exit(0);
}

// Run the script
main();
