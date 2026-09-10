const { connectGlobalDB } = require('../config/database.config');
const mongoose = require('mongoose');
require('dotenv').config();
require('../utils/scriptSafety').assertSafeToMutate({ requireAllowFlag: true, allowFlag: 'ALLOW_SEED', label: 'deleteOtherCompanies' });

/**
 * Delete all companies except TCS from the database
 * This will:
 * 1. List all companies
 * 2. Delete companies that are NOT TCS
 * 3. Optionally drop their tenant databases
 */

async function deleteOtherCompanies() {
  try {
    const globalConnection = await connectGlobalDB();
    console.log('✅ Connected to Global Database\n');

    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);
    
    // Get all companies
    const allCompanies = await CompanyRegistry.find({}).sort({ createdAt: -1 });
    console.log(`📋 Found ${allCompanies.length} companies in database:\n`);
    
    allCompanies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.companyName}`);
      console.log(`   Company ID: ${company.companyId}`);
      console.log(`   Company Code: ${company.companyCode}`);
      console.log(`   Database: ${company.tenantDatabaseName}`);
      console.log('');
    });

    // Find TCS company
    const tcsCompany = allCompanies.find(c => 
      c.companyName.toLowerCase().includes('tcs') || 
      c.companyCode.toLowerCase().includes('tcs')
    );

    if (!tcsCompany) {
      console.error('❌ TCS company not found! Aborting to prevent data loss.');
      process.exit(1);
    }

    console.log(`✅ TCS Company identified: ${tcsCompany.companyName} (${tcsCompany.companyId})\n`);

    // Get companies to delete (all except TCS)
    const companiesToDelete = allCompanies.filter(c => 
      c.companyId !== tcsCompany.companyId
    );

    if (companiesToDelete.length === 0) {
      console.log('✅ No other companies to delete. Only TCS exists.');
      await globalConnection.close();
      process.exit(0);
    }

    console.log(`⚠️  WARNING: About to delete ${companiesToDelete.length} companies:\n`);
    companiesToDelete.forEach((company, index) => {
      console.log(`${index + 1}. ${company.companyName} (${company.companyCode})`);
      console.log(`   Database: ${company.tenantDatabaseName}`);
    });

    console.log('\n🔴 This action will:');
    console.log('   1. Delete company records from CompanyRegistry');
    console.log('   2. Drop their tenant databases (all data will be lost)');
    console.log('   3. This action CANNOT be undone!\n');

    // Safety check - require confirmation via environment variable
    if (process.env.CONFIRM_DELETE !== 'YES_DELETE_ALL_EXCEPT_TCS') {
      console.log('❌ Deletion cancelled for safety.');
      console.log('\n💡 To proceed, run:');
      console.log('   CONFIRM_DELETE=YES_DELETE_ALL_EXCEPT_TCS node src/scripts/deleteOtherCompanies.js\n');
      await globalConnection.close();
      process.exit(0);
    }

    console.log('⚙️  Starting deletion process...\n');

    let deletedCount = 0;
    let droppedDatabases = 0;

    for (const company of companiesToDelete) {
      try {
        console.log(`🗑️  Deleting: ${company.companyName}`);

        // Drop tenant database
        try {
          const dbName = company.tenantDatabaseName;
          await globalConnection.db.admin().command({ dropDatabase: 1 }, { dbName });
          console.log(`   ✅ Dropped database: ${dbName}`);
          droppedDatabases++;
        } catch (dbError) {
          console.log(`   ⚠️  Could not drop database: ${dbError.message}`);
        }

        // Delete company record
        await CompanyRegistry.deleteOne({ _id: company._id });
        console.log(`   ✅ Deleted company record`);
        deletedCount++;

      } catch (error) {
        console.error(`   ❌ Error deleting ${company.companyName}:`, error.message);
      }
      console.log('');
    }

    console.log('\n=== Deletion Summary ===');
    console.log(`Companies deleted: ${deletedCount}/${companiesToDelete.length}`);
    console.log(`Databases dropped: ${droppedDatabases}/${companiesToDelete.length}`);
    console.log(`Remaining companies: 1 (TCS only)`);

    // Verify only TCS remains
    const remainingCompanies = await CompanyRegistry.find({});
    console.log('\n✅ Verification:');
    console.log(`Total companies in database: ${remainingCompanies.length}`);
    remainingCompanies.forEach(company => {
      console.log(`   - ${company.companyName} (${company.companyCode})`);
    });

    await globalConnection.close();
    console.log('\n✅ Database connection closed');
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  }
}

// Run the script
deleteOtherCompanies();
