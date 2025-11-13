#!/usr/bin/env node

/**
 * Quick Database Seeding Script - No Audit Logging
 * Run this to quickly populate the database with test data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const BillingSeeder = require('../seeders/billingSeeder');

async function quickSeed() {
  try {
    console.log('🚀 Starting quick database seeding...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Create seeder instance
    const seeder = new BillingSeeder();
    
    // Run seeding
    const result = await seeder.seedAll();
    
    console.log('\n🎉 Quick seeding completed!');
    console.log('\n📊 Summary:');
    console.log(`   ✓ ${result.users.length} Users updated with internal roles`);
    console.log(`   ✓ ${result.clients.length} Clients created/updated`);
    console.log(`   ✓ ${result.packages.length} Packages created/updated`);
    console.log(`   ✓ ${result.subscriptions.length} Subscriptions created`);
    console.log(`   ✓ ${result.invoices.length} Invoices created`);
    console.log(`   ✓ ${result.payments.length} Payments created`);
    
    console.log('\n🔑 Test with your existing super admin credentials');
    console.log('📱 Now test the billing management features!');
    
  } catch (error) {
    console.error('❌ Error in quick seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
    process.exit(0);
  }
}

quickSeed();
