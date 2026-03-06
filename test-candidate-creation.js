#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');

async function testCandidateCreation() {
  try {
    console.log('🔄 Connecting to database...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('✅ Connected to database');

    // Get tenant model
    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    console.log('🔄 Creating test candidate...');

    const testCandidate = {
      firstName: 'Test',
      lastName: 'User',
      email: `test${Date.now()}@example.com`,
      phone: '9876543210',
      stage: 'applied',
      status: 'active',
      skills: ['JavaScript', 'React'],
      currentCompany: 'Test Company',
      currentDesignation: 'Developer'
    };

    const candidate = await Candidate.create(testCandidate);
    console.log('✅ Candidate created successfully:', {
      id: candidate._id,
      candidateCode: candidate.candidateCode,
      email: candidate.email
    });

    // Clean up
    await Candidate.findByIdAndDelete(candidate._id);
    console.log('🧹 Test candidate cleaned up');

    await mongoose.disconnect();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCandidateCreation();