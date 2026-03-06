require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');
const candidateMatchingService = require('./src/services/candidateMatchingService');

const TENANT_ID = 'tenant_696b515db6c9fd5fd51aed1c';

console.log(`🔍 Testing Real Tenant Database: ${TENANT_ID}`);
console.log('🎯 Java Developer Fresher Search in Noida\n');

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

async function connectToTenant() {
  try {
    console.log('🔌 Connecting to main database...');
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);
    console.log('✅ Connected to main database');

    // Get tenant connection
    const { getTenantConnection } = require('./src/config/database.config');
    const tenantConnection = await getTenantConnection(TENANT_ID);
    console.log(`✅ Connected to tenant: ${TENANT_ID}`);

    return tenantConnection;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    throw error;
  }
}

async function analyzeTenantCandidates() {
  let tenantConnection = null;

  try {
    tenantConnection = await connectToTenant();
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Get total counts
    const totalCandidates = await Candidate.countDocuments();
    const activeCandidates = await Candidate.countDocuments({
      status: { $in: ['active', 'applied'] },
      isActive: true
    });

    console.log(`\n📊 Tenant Candidate Database Status:`);
    console.log(`   Total Candidates: ${totalCandidates}`);
    console.log(`   Active Candidates: ${activeCandidates}`);

    if (totalCandidates === 0) {
      console.log('\n❌ No candidates found in tenant database');
      return;
    }

    // Analyze candidate pool
    console.log('\n🔍 Analyzing candidate pool...\n');

    // Get Java developers
    const javaCandidates = await Candidate.find({
      skills: { $regex: /java/i },
      status: { $in: ['active', 'applied'] },
      isActive: true
    }).select('firstName lastName skills experience currentLocation preferredLocation candidateCode').limit(10);

    console.log(`☕ Java Developers Found: ${javaCandidates.length}`);
    javaCandidates.forEach((c, i) => {
      const expYears = (c.experience?.years || 0) + ((c.experience?.months || 0) / 12);
      console.log(`   ${i+1}. ${c.firstName} ${c.lastName} (${c.candidateCode}) - ${expYears.toFixed(1)} years - "${c.currentLocation}"`);
      console.log(`      Skills: ${(c.skills || []).filter(s => s.toLowerCase().includes('java')).join(', ')}`);
      console.log(`      Preferred Locations: ${(c.preferredLocation || []).join(', ')}`);
    });

    // Get Noida candidates
    const noidaCandidates = await Candidate.find({
      $or: [
        { currentLocation: { $regex: /noida/i } },
        { preferredLocation: { $regex: /noida/i } }
      ],
      status: { $in: ['active', 'applied'] },
      isActive: true
    }).select('firstName lastName skills experience currentLocation preferredLocation candidateCode').limit(10);

    console.log(`\n🏢 Noida Candidates Found: ${noidaCandidates.length}`);
    noidaCandidates.forEach((c, i) => {
      const expYears = (c.experience?.years || 0) + ((c.experience?.months || 0) / 12);
      console.log(`   ${i+1}. ${c.firstName} ${c.lastName} (${c.candidateCode}) - ${expYears.toFixed(1)} years - ${c.currentLocation}`);
    });

    // Get fresher candidates (0-2 years)
    const fresherCandidates = await Candidate.find({
      $expr: {
        $lte: [
          { $add: ['$experience.years', { $divide: ['$experience.months', 12] }] },
          2
        ]
      },
      status: { $in: ['active', 'applied'] },
      isActive: true
    }).select('firstName lastName skills experience currentLocation preferredLocation candidateCode').limit(10);

    console.log(`\n👶 Fresher Candidates (0-2 years): ${fresherCandidates.length}`);
    fresherCandidates.forEach((c, i) => {
      const expYears = (c.experience?.years || 0) + ((c.experience?.months || 0) / 12);
      console.log(`   ${i+1}. ${c.firstName} ${c.lastName} (${c.candidateCode}) - ${expYears.toFixed(1)} years - "${c.currentLocation}"`);
      console.log(`      Skills: ${(c.skills || []).join(', ')}`);
    });

    // Find Java Freshers in Noida
    console.log('\n🎯 Finding Java Developer Freshers in Noida...\n');

    const javaFreshersInNoida = await Candidate.find({
      skills: { $regex: /java/i },
      $or: [
        { currentLocation: { $regex: /noida/i } },
        { preferredLocation: { $regex: /noida/i } }
      ],
      $expr: {
        $lte: [
          { $add: ['$experience.years', { $divide: ['$experience.months', 12] }] },
          2
        ]
      },
      status: { $in: ['active', 'applied'] },
      isActive: true
    }).select('firstName lastName email phone skills experience currentLocation preferredLocation currentDesignation currentCompany currentCTC expectedCTC education noticePeriod source candidateCode');

    console.log(`🏆 Found ${javaFreshersInNoida.length} Java Developer Freshers in Noida area\n`);

    if (javaFreshersInNoida.length === 0) {
      console.log('❌ No Java Developer freshers found matching criteria');
      console.log('\n💡 Check:');
      console.log('   - Candidates with Java skills');
      console.log('   - Noida location or preference');
      console.log('   - 0-2 years experience');
      console.log('   - Active status');
      return;
    }

    // Calculate detailed matching scores
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

    console.log('🏆 Matching Results (Sorted by Score):');
    console.log('='.repeat(120));

    let rank = 1;
    for (const { candidate, overallScore, overallFit, skillMatch, experienceMatch, locationMatch } of candidatesWithScores) {
      const fitEmoji = overallFit === 'excellent' ? '⭐' :
                      overallFit === 'good' ? '✅' :
                      overallFit === 'average' ? '⚠️' : '❌';

      const expYears = (candidate.experience?.years || 0) + ((candidate.experience?.months || 0) / 12);
      const expDisplay = expYears < 1 ?
        `${candidate.experience?.months || 0} months` :
        `${expYears.toFixed(1)} years`;

      console.log(`${rank}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} (${candidate.candidateCode}) - ${overallScore}/100 (${overallFit})`);
      console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone || 'N/A'}`);
      console.log(`   💼 ${candidate.currentDesignation || 'N/A'} at ${candidate.currentCompany || 'N/A'}`);
      console.log(`   📍 Current: ${candidate.currentLocation} | Preferred: ${(candidate.preferredLocation || []).join(', ')}`);
      console.log(`   🎓 Experience: ${expDisplay} | Education: ${candidate.education?.[0]?.degree || 'N/A'}`);
      console.log(`   🛠️  Skills: ${(candidate.skills || []).join(', ')}`);
      console.log(`   💰 CTC: ₹${(candidate.currentCTC || 0).toLocaleString()} | Expected: ₹${(candidate.expectedCTC || 0).toLocaleString()}`);
      console.log(`   ⏰ Notice: ${candidate.noticePeriod || 'N/A'} | Source: ${candidate.source || 'N/A'}`);
      console.log(`   📊 Skills: ${skillMatch.totalMatched} matches (${skillMatch.score}/100)`);
      console.log('');

      rank++;
    }

    // Show statistics
    console.log('📊 Search Statistics:');
    console.log('='.repeat(60));
    const excellentMatches = candidatesWithScores.filter(m => m.overallFit === 'excellent').length;
    const goodMatches = candidatesWithScores.filter(m => m.overallFit === 'good').length;
    const averageMatches = candidatesWithScores.filter(m => m.overallFit === 'average').length;
    const poorMatches = candidatesWithScores.filter(m => m.overallFit === 'poor').length;

    console.log(`   ⭐ Excellent Matches (90-100): ${excellentMatches}`);
    console.log(`   ✅ Good Matches (75-89): ${goodMatches}`);
    console.log(`   ⚠️  Average Matches (60-74): ${averageMatches}`);
    console.log(`   ❌ Poor Matches (<60): ${poorMatches}`);
    console.log(`   📈 Average Score: ${Math.round(candidatesWithScores.reduce((sum, m) => sum + m.overallScore, 0) / candidatesWithScores.length)}/100`);

    console.log('\n✅ Search completed successfully!');
    console.log(`\n🎯 Found ${candidatesWithScores.length} qualified Java Developer freshers in tenant ${TENANT_ID}`);
    console.log(`🏆 ${excellentMatches + goodMatches} candidates have good to excellent match scores`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

async function runTenantSearch() {
  try {
    console.log(`🚀 Testing Real Tenant Database: ${TENANT_ID}`);
    console.log('🎯 Java Developer Fresher Search in Noida\n');

    await analyzeTenantCandidates();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run search if called directly
if (require.main === module) {
  runTenantSearch();
}

module.exports = {
  analyzeTenantCandidates,
  runTenantSearch
};