#!/usr/bin/env node

/**
 * Fix Negative Leave Balances Script
 * This script finds and fixes any negative leave balances in the database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantConnection } = require('../config/database.config');

async function fixNegativeBalances() {
  try {
    console.log('='.repeat(60));
    console.log('FIXING NEGATIVE LEAVE BALANCES');
    console.log('='.repeat(60));

    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to main database');

    // Get all active companies/tenants
    const companies = await getActiveCompanies();
    
    if (companies.length === 0) {
      console.log('No active companies found');
      return;
    }

    console.log(`Processing ${companies.length} companies...`);

    let totalFixed = 0;
    let totalCompaniesProcessed = 0;

    for (const company of companies) {
      try {
        console.log(`\nProcessing company: ${company.name} (${company._id})`);
        
        const fixed = await fixCompanyNegativeBalances(company._id);
        totalFixed += fixed;
        totalCompaniesProcessed++;
        
        if (fixed > 0) {
          console.log(`✓ Fixed ${fixed} negative balances for company ${company.name}`);
        } else {
          console.log(`✓ No negative balances found for company ${company.name}`);
        }
      } catch (error) {
        console.error(`✗ Error processing company ${company.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`Total Companies: ${companies.length}`);
    console.log(`Companies Processed: ${totalCompaniesProcessed}`);
    console.log(`Total Negative Balances Fixed: ${totalFixed}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error during negative balance fix:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

/**
 * Fix negative balances for a specific company
 */
async function fixCompanyNegativeBalances(companyId) {
  try {
    const tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', require('../models/tenant/LeaveBalance'));

    // Find all negative balances
    const negativeBalances = await LeaveBalance.find({
      available: { $lt: 0 }
    });

    if (negativeBalances.length === 0) {
      if (tenantConnection) await tenantConnection.close();
      return 0;
    }

    console.log(`Found ${negativeBalances.length} negative balances:`);

    let fixedCount = 0;

    for (const balance of negativeBalances) {
      console.log(`  - ${balance.employeeEmail}: ${balance.leaveType} = ${balance.available}`);
      
      // Fix the negative balance
      balance.available = 0;
      
      // Also ensure consumed doesn't exceed total
      if (balance.consumed > balance.total) {
        balance.consumed = balance.total;
      }
      
      await balance.save();
      fixedCount++;
      
      console.log(`    Fixed: ${balance.leaveType} = ${balance.available} (consumed: ${balance.consumed}/${balance.total})`);
    }

    if (tenantConnection) await tenantConnection.close();
    return fixedCount;

  } catch (error) {
    console.error(`Error fixing negative balances for company ${companyId}:`, error.message);
    throw error;
  }
}

/**
 * Get all active companies/tenants
 */
async function getActiveCompanies() {
  try {
    // This is a placeholder - adjust based on your actual company model
    const Company = require('../models/Company');
    
    const companies = await Company.find({
      isActive: true,
      isDeleted: false
    }).select('_id name domain settings');
    
    return companies;
    
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
  fixNegativeBalances().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { fixNegativeBalances, fixCompanyNegativeBalances };
