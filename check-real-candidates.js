const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');

async function checkRealCandidates() {
  try {
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);

    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    const totalCandidates = await Candidate.countDocuments();
    const activeCandidates = await Candidate.countDocuments({
      status: { $in: ['active', 'applied'] },
      isActive: true
    });

    console.log('📊 Candidate Database Status:');
    console.log('   Total Candidates:', totalCandidates);
    console.log('   Active Candidates:', activeCandidates);

    if (totalCandidates > 0) {
      const allCandidates = await Candidate.find()
        .select('firstName lastName email skills experience currentLocation preferredLocation status isActive candidateCode')
        .limit(20);

      console.log('\n👥 All Candidates in Database:');
      allCandidates.forEach((c, i) => {
        console.log(`${i+1}. ${c.firstName} ${c.lastName} (${c.candidateCode}) - ${c.status} (${c.isActive ? 'active' : 'inactive'})`);
        console.log(`   Skills: ${(c.skills || []).join(', ') || 'None'}`);
        console.log(`   Location: ${c.currentLocation || 'N/A'}`);
        console.log(`   Preferred Locations: ${(c.preferredLocation || []).join(', ') || 'None'}`);
        console.log(`   Experience: ${c.experience?.years || 0} years ${c.experience?.months || 0} months`);
        console.log('');
      });

      // Check for Java developers specifically
      const javaCandidates = await Candidate.find({
        skills: { $regex: /java/i, $options: 'i' },
        status: { $in: ['active', 'applied'] },
        isActive: true
      }).select('firstName lastName skills currentLocation preferredLocation experience candidateCode');

      if (javaCandidates.length > 0) {
        console.log('☕ Java Developers Found:');
        javaCandidates.forEach((c, i) => {
          console.log(`${i+1}. ${c.firstName} ${c.lastName} (${c.candidateCode})`);
          console.log(`   Java Skills: ${(c.skills || []).filter(s => s.toLowerCase().includes('java')).join(', ')}`);
          console.log(`   All Skills: ${(c.skills || []).join(', ')}`);
          console.log(`   Location: ${c.currentLocation || 'N/A'}`);
          console.log(`   Preferred: ${(c.preferredLocation || []).join(', ')}`);
          console.log('');
        });
      } else {
        console.log('❌ No active Java developers found');
      }
    } else {
      console.log('❌ No candidates found in database');
      console.log('💡 You need to seed candidate data first');
      console.log('   Run: npm run seed:candidate');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error checking candidates:', error);
  }
}

checkRealCandidates();