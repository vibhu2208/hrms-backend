#!/usr/bin/env node

/**
 * Automatic Leave Encashment Processing Script
 * This script can be run as a cron job to process automatic leave encashments
 * 
 * Usage:
 * node src/scripts/processAutomaticEncashment.js --trigger=year_end
 * node src/scripts/processAutomaticEncashment.js --trigger=specific_date
 * node src/scripts/processAutomaticEncashment.js --trigger=leave_balance_threshold
 */

require('dotenv').config();
const mongoose = require('mongoose');
const automaticLeaveEncashmentService = require('../services/automaticLeaveEncashmentService');
const { getTenantConnection } = require('../config/database.config');

// Parse command line arguments
const args = process.argv.slice(2);
const triggerType = args.find(arg => arg.startsWith('--trigger='))?.split('=')[1] || 'year_end';

async function main() {
  try {
    console.log('='.repeat(60));
    console.log(`Automatic Leave Encashment Processing - ${new Date().toISOString()}`);
    console.log(`Trigger Type: ${triggerType}`);
    console.log('='.repeat(60));

    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to main database');

    // Get all active companies/tenants
    // This assumes you have a way to get all companies
    // You may need to adjust this based on your actual company model
    const companies = await getActiveCompanies();
    
    if (companies.length === 0) {
      console.log('No active companies found');
      return;
    }

    console.log(`Processing ${companies.length} companies...`);

    let totalProcessed = 0;
    let successfulCompanies = 0;

    for (const company of companies) {
      try {
        console.log(`\nProcessing company: ${company.name} (${company._id})`);
        
        const result = await automaticLeaveEncashmentService.processCompanyAutomaticEncashment(
          company._id,
          triggerType
        );

        if (result.success) {
          console.log(`✓ Company processed successfully: ${result.message}`);
          totalProcessed += result.processed;
          successfulCompanies++;
        } else {
          console.log(`✗ Company processing failed: ${result.message}`);
        }
      } catch (error) {
        console.error(`✗ Error processing company ${company.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Processing Summary:');
    console.log(`Total Companies: ${companies.length}`);
    console.log(`Successful: ${successfulCompanies}`);
    console.log(`Total Encashments Processed: ${totalProcessed}`);
    console.log(`Trigger Type: ${triggerType}`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error during automatic encashment processing:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

/**
 * Get all active companies/tenants
 * Adjust this function based on your actual company/tenant model
 */
async function getActiveCompanies() {
  try {
    // This is a placeholder - adjust based on your actual company model
    // You might have a Company, Tenant, or Organization model
    
    // Example assuming you have a Company model:
    const Company = require('../models/Company');
    
    const companies = await Company.find({
      isActive: true,
      isDeleted: false
    }).select('_id name domain settings');
    
    return companies;
    
    // If you don't have a Company model, you might need to:
    // 1. Query your tenant database directly
    // 2. Use a different approach to get all active companies
    // 3. Hardcode company IDs for testing
    
  } catch (error) {
    console.error('Error fetching companies:', error.message);
    
    // Fallback: return empty array or test companies
    console.log('Using fallback company list for testing...');
    return [
      { _id: 'test-company-1', name: 'Test Company 1' },
      { _id: 'test-company-2', name: 'Test Company 2' }
    ];
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, getActiveCompanies };
