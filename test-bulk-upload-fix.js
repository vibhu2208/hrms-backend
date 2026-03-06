require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');

console.log('🔍 Testing Bulk Upload Fix\n');

// Sample validated data that matches the actual format from console logs
const sampleValidatedData = [
  {
    firstname: 'John',
    lastname: 'Doe',
    email: 'john.doe@example.com',
    phone: '9876543210',
    appliedfor: 'Senior Full Stack Developer',
    alternatephone: '9876543211',
    currentlocation: 'Mumbai',
    preferredlocation: ['Mumbai', 'Pune'],
    source: 'linkedin',
    experienceyears: '5',
    experiencemonths: '6',
    currentcompany: 'Tech Corp',
    currentdesignation: 'Senior Developer',
    currentctc: '800000',
    expectedctc: '1000000',
    noticeperiod: '30',
    skills: ['Node.js', 'React', 'MongoDB'],
    stage: 'applied',
    notes: 'Referred by employee'
  }
];

async function testBulkUpload() {
  try {
    console.log('🔌 Connecting to database...');
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);
    console.log('✅ Connected to database');

    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Test if we can create candidates
    console.log('\n🧪 Testing candidate creation...');

    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    for (const candidateData of sampleValidatedData) {
      console.log(`🔄 Processing candidate ${candidateData.email}...`);

      // Check for duplicates
      const existingCandidate = await Candidate.findOne({
        $or: [
          { email: candidateData.email?.toLowerCase().trim() },
          { phone: String(candidateData.phone)?.replace(/\D/g, '') }
        ]
      });

      if (existingCandidate) {
        console.log(`Duplicate found for ${candidateData.email}`);
        results.duplicates.push({
          email: candidateData.email,
          reason: 'Candidate with this email or phone already exists'
        });
        continue;
      }

      // Generate unique candidate code
      let candidateCode;
      const lastCandidate = await Candidate.findOne({})
        .sort({ candidateCode: -1 })
        .select('candidateCode')
        .lean();

      if (lastCandidate && lastCandidate.candidateCode) {
        const lastNumber = parseInt(lastCandidate.candidateCode.replace('CAN', '')) || 0;
        candidateCode = `CAN${String(lastNumber + 1).padStart(5, '0')}`;
      } else {
        candidateCode = `CAN${String(1).padStart(5, '0')}`;
      }

      console.log(`Generated candidate code: ${candidateCode}`);

      // Get appliedFor value
      let appliedForValue = null;
      if ((candidateData.appliedfor || candidateData.appliedFor) && (candidateData.appliedfor || candidateData.appliedFor).trim()) {
        appliedForValue = (candidateData.appliedfor || candidateData.appliedFor).trim();
        console.log(`Using job title: "${appliedForValue}" for candidate ${candidateData.email}`);
      } else {
        console.log(`No job title provided for candidate ${candidateData.email}`);
      }

      // Create candidate
      const firstName = candidateData.firstname?.trim() || candidateData.firstName?.trim() || '';
      const lastName = candidateData.lastname?.trim() || candidateData.lastName?.trim() || '';

      console.log('Creating candidate with firstName:', `"${firstName}"`, 'lastName:', `"${lastName}"`);

      const candidate = new Candidate({
        candidateCode,
        firstName,
        lastName,
        email: candidateData.email?.toLowerCase().trim() || '',
        phone: String(candidateData.phone)?.trim() || '',
        alternatePhone: candidateData.alternatephone ? String(candidateData.alternatephone).trim() : candidateData.alternatePhone ? String(candidateData.alternatePhone).trim() : null,
        currentLocation: candidateData.currentlocation?.trim() || candidateData.currentLocation?.trim() || null,
        preferredLocation: candidateData.preferredlocation || candidateData.preferredLocation || [],
        source: candidateData.source?.trim().toLowerCase() || 'other',
        experience: {
          years: parseInt(candidateData.experienceyears || candidateData.experienceYears) || 0,
          months: parseInt(candidateData.experiencemonths || candidateData.experienceMonths) || 0
        },
        currentCompany: candidateData.currentcompany?.trim() || candidateData.currentCompany?.trim() || null,
        currentDesignation: candidateData.currentdesignation?.trim() || candidateData.currentDesignation?.trim() || null,
        currentCTC: candidateData.currentctc ? parseFloat(candidateData.currentctc) : candidateData.currentCTC ? parseFloat(candidateData.currentCTC) : null,
        expectedCTC: candidateData.expectedctc ? parseFloat(candidateData.expectedctc) : candidateData.expectedCTC ? parseFloat(candidateData.expectedCTC) : null,
        noticePeriod: candidateData.noticeperiod ? parseInt(candidateData.noticeperiod) : candidateData.noticePeriod ? parseInt(candidateData.noticePeriod) : null,
        skills: candidateData.skills || [],
        stage: candidateData.stage?.trim() || 'applied',
        status: 'active',
        notes: candidateData.notes?.trim() || null,
        appliedForTitle: appliedForValue // Store job title as string
      });

      try {
        const savedCandidate = await candidate.save();
        console.log(`✅ Successfully created candidate: ${savedCandidate.email} (${savedCandidate.candidateCode})`);

        results.success.push({
          email: savedCandidate.email,
          candidateId: savedCandidate._id,
          candidateCode: savedCandidate.candidateCode
        });
      } catch (saveError) {
        console.error(`❌ Failed to save candidate ${candidateData.email}:`, saveError.message);
        results.failed.push({
          email: candidateData.email,
          reason: `Database save failed: ${saveError.message}`
        });
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`✅ Imported: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`🔄 Duplicates: ${results.duplicates.length}`);

    if (results.success.length > 0) {
      console.log('\n✅ Bulk upload fix appears to be working!');
    } else {
      console.log('\n❌ Bulk upload is still not working');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testBulkUpload();