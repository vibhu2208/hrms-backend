require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');
const candidateMatchingService = require('./src/services/candidateMatchingService');

console.log('🔍 Testing Current Candidate Pool - Java Developer Fresher in Noida\n');

// Search criteria for Java Developer Fresher in Noida
const SEARCH_CRITERIA = {
  jobTitle: 'Java Developer Fresher',
  companyName: 'TechCorp Solutions',
  location: 'Noida, Uttar Pradesh',
  parsedData: {
    experienceRequired: {
      minYears: 0,
      maxYears: 2 // Fresher to 2 years experience
    },
    requiredSkillsSimple: ['java'], // Must have Java
    preferredSkillsSimple: ['mysql', 'git', 'html', 'css', 'javascript', 'spring', 'hibernate'],
    jobLocation: 'Noida',
    preferredLocations: ['Noida', 'Delhi', 'Gurgaon', 'Ghaziabad', 'Faridabad'],
    salaryRange: {
      min: 200000,
      max: 600000, // Fresher salary range
      currency: 'INR'
    },
    educationRequirementsSimple: ['bachelor of technology', 'bachelor of engineering', 'bachelor of science', 'master of computer applications']
  },
  statistics: { lastMatchedAt: new Date() }
};

async function checkCurrentCandidates() {
  try {
    console.log('🔌 Connecting to database...');
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);
    console.log('✅ Connected to database');

    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Get total count
    const totalCandidates = await Candidate.countDocuments();
    const activeCandidates = await Candidate.countDocuments({
      status: { $in: ['active', 'applied'] },
      isActive: true
    });

    console.log(`\n📊 Database Status:`);
    console.log(`   Total Candidates: ${totalCandidates}`);
    console.log(`   Active Candidates: ${activeCandidates}`);

    if (totalCandidates === 0) {
      console.log('\n❌ No candidates found in database');
      console.log('💡 The database appears to be empty');
      console.log('💡 Run seeding scripts to populate test data');
      return [];
    }

    // Get all candidates for analysis
    const allCandidates = await Candidate.find()
      .select('firstName lastName email phone skills experience currentLocation preferredLocation currentDesignation currentCompany currentCTC expectedCTC education status isActive noticePeriod source candidateCode')
      .limit(100); // Limit to prevent overwhelming output

    console.log(`\n👥 Analyzing ${allCandidates.length} candidates...\n`);

    // Analyze candidate pool
    const javaCandidates = allCandidates.filter(c =>
      (c.skills || []).some(skill => skill.toLowerCase().includes('java'))
    );

    const noidaCandidates = allCandidates.filter(c =>
      c.currentLocation === 'Noida' ||
      (c.preferredLocation || []).includes('Noida')
    );

    const fresherCandidates = allCandidates.filter(c => {
      const expYears = (c.experience?.years || 0) + ((c.experience?.months || 0) / 12);
      return expYears <= 2;
    });

    console.log('📈 Candidate Pool Analysis:');
    console.log(`   Java Developers: ${javaCandidates.length}`);
    console.log(`   Noida-based/preferring: ${noidaCandidates.length}`);
    console.log(`   Freshers (0-2 years): ${fresherCandidates.length}`);

    // Find Java freshers in Noida
    const javaFreshersInNoida = allCandidates.filter(c => {
      const hasJava = (c.skills || []).some(skill => skill.toLowerCase().includes('java'));
      const inNoida = c.currentLocation === 'Noida' || (c.preferredLocation || []).includes('Noida');
      const isFresher = ((c.experience?.years || 0) + ((c.experience?.months || 0) / 12)) <= 2;
      const isActive = c.status === 'active' && c.isActive === true;

      return hasJava && inNoida && isFresher && isActive;
    });

    console.log(`   🎯 Java Freshers in Noida: ${javaFreshersInNoida.length}`);

    if (javaFreshersInNoida.length > 0) {
      console.log('\n🏆 Found Java Developer Freshers in Noida:');
      console.log('='.repeat(80));

      // Calculate matching scores
      const candidatesWithScores = [];

      for (const candidate of javaFreshersInNoida) {
        const skillMatch = candidateMatchingService.calculateSkillMatch(candidate, SEARCH_CRITERIA);
        const experienceMatch = candidateMatchingService.calculateExperienceMatch(candidate, SEARCH_CRITERIA);
        const locationMatch = candidateMatchingService.calculateLocationMatch(candidate, SEARCH_CRITERIA);
        const educationMatch = candidateMatchingService.calculateEducationMatch(candidate, SEARCH_CRITERIA);
        const salaryMatch = candidateMatchingService.calculateSalaryMatch(candidate, SEARCH_CRITERIA);

        const overallScore = Math.round(
          skillMatch.score * 0.4 +
          experienceMatch.score * 0.25 +
          locationMatch.score * 0.15 +
          educationMatch.score * 0.1 +
          salaryMatch.score * 0.05
        );

        let overallFit = 'poor';
        if (overallScore >= 90) overallFit = 'excellent';
        else if (overallScore >= 75) overallFit = 'good';
        else if (overallScore >= 60) overallFit = 'average';

        candidatesWithScores.push({
          candidate,
          overallScore,
          overallFit,
          skillMatch,
          experienceMatch,
          locationMatch
        });
      }

      // Sort by score
      candidatesWithScores.sort((a, b) => b.overallScore - a.overallScore);

      let rank = 1;
      for (const { candidate, overallScore, overallFit, skillMatch, experienceMatch, locationMatch } of candidatesWithScores) {
        const fitEmoji = overallFit === 'excellent' ? '⭐' :
                        overallFit === 'good' ? '✅' :
                        overallFit === 'average' ? '⚠️' : '❌';

        const expYears = (candidate.experience?.years || 0) + ((candidate.experience?.months || 0) / 12);
        const expDisplay = expYears < 1 ? `${candidate.experience?.months || 0} months` : `${expYears.toFixed(1)} years`;

        console.log(`${rank}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} (${candidate.candidateCode}) - ${overallScore}/100 (${overallFit})`);
        console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone || 'N/A'}`);
        console.log(`   💼 ${candidate.currentDesignation || 'N/A'} at ${candidate.currentCompany || 'N/A'}`);
        console.log(`   📍 Current: ${candidate.currentLocation} | Preferred: ${(candidate.preferredLocation || []).join(', ')}`);
        console.log(`   🎓 Experience: ${expDisplay} | Education: ${candidate.education?.[0]?.degree || 'N/A'}`);
        console.log(`   🛠️  Skills: ${(candidate.skills || []).join(', ')}`);
        console.log(`   💰 CTC: ₹${(candidate.currentCTC || 0).toLocaleString()} | Expected: ₹${(candidate.expectedCTC || 0).toLocaleString()}`);
        console.log(`   📊 Skills: ${skillMatch.totalMatched} matches (${skillMatch.score}/100)`);
        console.log('');

        rank++;
      }

      console.log('📊 Summary:');
      console.log(`   Found ${javaFreshersInNoida.length} Java Developer freshers in Noida area`);
      console.log(`   Average match score: ${Math.round(candidatesWithScores.reduce((sum, m) => sum + m.overallScore, 0) / candidatesWithScores.length)}/100`);

    } else {
      console.log('\n❌ No Java Developer freshers found in Noida');
      console.log('\n💡 Suggestions:');
      console.log('   - Check if candidates have Java in their skills');
      console.log('   - Verify candidates are marked as active');
      console.log('   - Ensure candidates have Noida in location preferences');
      console.log('   - Check experience is within 0-2 years range');
    }

    await mongoose.disconnect();
    console.log('\n✅ Database check completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. .env file exists with MONGODB_URI');
    console.log('   2. MongoDB connection is working');
    console.log('   3. Database contains candidate data');
  }
}

checkCurrentCandidates();