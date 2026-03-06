const mongoose = require('mongoose');

async function checkOnboarding() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hrms_tenant_691e237d4f4469770021830f');
    console.log('✅ Connected to database');
    
    const Onboarding = mongoose.model('Onboarding', new mongoose.Schema({}, { strict: false }));
    const onboardings = await Onboarding.find({}).lean();
    
    console.log('\n📊 Total onboarding records:', onboardings.length);
    console.log('\n📋 Onboarding Records:\n');
    
    onboardings.forEach((o, idx) => {
      console.log(`${idx + 1}. ${o.candidateName || 'N/A'}`);
      console.log(`   Email: ${o.candidateEmail || 'N/A'}`);
      console.log(`   Status: ${o.status || 'N/A'}`);
      console.log(`   Position: ${o.position || 'N/A'}`);
      console.log(`   Created: ${o.createdAt || 'N/A'}`);
      console.log(`   OnboardingId: ${o.onboardingId || 'N/A'}`);
      console.log(`   ApplicationId: ${o.applicationId || 'N/A'}`);
      console.log(`   JobId: ${o.jobId || 'N/A'}`);
      console.log('');
    });
    
    await mongoose.connection.close();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkOnboarding();
