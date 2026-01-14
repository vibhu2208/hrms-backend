/**
 * Debug script to check onboarding records in database
 * Run with: node debug-onboarding.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function debugOnboarding() {
  try {
    // Connect to tenant database
    const tenantDbName = 'hrms_tenant_691e237d4f4469770021830f';
    await mongoose.connect(`mongodb://localhost:27017/${tenantDbName}`);
    console.log(`✅ Connected to ${tenantDbName}\n`);
    
    // Create a flexible schema to read any data
    const OnboardingSchema = new mongoose.Schema({}, { strict: false, collection: 'onboardings' });
    const Onboarding = mongoose.model('Onboarding', OnboardingSchema);
    
    // Get all onboarding records
    const allRecords = await Onboarding.find({}).lean();
    console.log(`📊 Total onboarding records: ${allRecords.length}\n`);
    
    if (allRecords.length === 0) {
      console.log('❌ No onboarding records found in database!');
      console.log('   This means the sendToOnboarding function is not creating records.\n');
    } else {
      console.log('📋 Onboarding Records:\n');
      allRecords.forEach((record, idx) => {
        console.log(`${idx + 1}. ${record.candidateName || 'N/A'}`);
        console.log(`   Email: ${record.candidateEmail || 'N/A'}`);
        console.log(`   Status: ${record.status || 'N/A'}`);
        console.log(`   Position: ${record.position || 'N/A'}`);
        console.log(`   OnboardingId: ${record.onboardingId || 'N/A'}`);
        console.log(`   ApplicationId: ${record.applicationId || 'N/A'}`);
        console.log(`   JobId: ${record.jobId || 'N/A'}`);
        console.log(`   Department: ${record.department || 'N/A'}`);
        console.log(`   Created: ${record.createdAt || 'N/A'}`);
        console.log('');
      });
      
      // Check status distribution
      const statusCounts = {};
      allRecords.forEach(r => {
        const status = r.status || 'undefined';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('📈 Status Distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      console.log('');
      
      // Check what query would return
      const queryResult = await Onboarding.find({ status: { $ne: 'completed' } }).lean();
      console.log(`🔍 Query { status: { $ne: 'completed' } } returns: ${queryResult.length} records`);
      
      if (queryResult.length === 0 && allRecords.length > 0) {
        console.log('⚠️  WARNING: Records exist but query returns 0!');
        console.log('   This means all records have status "completed" or the query is wrong.');
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 MongoDB is not running. Start MongoDB first.');
    }
    process.exit(1);
  }
}

debugOnboarding();
