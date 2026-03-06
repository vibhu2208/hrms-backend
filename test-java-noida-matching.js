const mongoose = require('mongoose');
const candidateMatchingService = require('./src/services/candidateMatchingService');
const { getTenantModel } = require('./src/utils/tenantModels');

// Test configuration for Java Developer role in Noida
const TEST_CONFIG = {
  jdData: {
    jobTitle: 'Senior Java Developer',
    companyName: 'TechSolutions Pvt Ltd',
    location: 'Noida, Uttar Pradesh',
    parsedData: {
      experienceRequired: {
        minYears: 3,
        maxYears: 8
      },
      requiredSkillsSimple: ['java', 'spring', 'hibernate', 'mysql', 'git', 'microservices'],
      preferredSkillsSimple: ['docker', 'kubernetes', 'aws', 'react', 'angular'],
      jobLocation: 'Noida',
      preferredLocations: ['Noida', 'Delhi', 'Gurgaon', 'Ghaziabad'],
      salaryRange: {
        min: 800000,
        max: 1800000,
        currency: 'INR'
      },
      educationRequirementsSimple: ['bachelor of technology', 'bachelor of engineering', 'computer science'],
      responsibilities: [
        'Develop and maintain Java-based applications',
        'Design and implement REST APIs',
        'Work with Spring Boot framework',
        'Collaborate with cross-functional teams'
      ]
    },
    statistics: { lastMatchedAt: new Date() }
  },
  tenantId: 'test-tenant',
  matchOptions: {
    minScore: 0, // Show all matches
    maxResults: 20
  }
};

async function testJavaDeveloperMatching() {
  console.log('🚀 Testing Java Developer Role Matching in Noida\n');
  console.log('=' .repeat(60));
  console.log('📋 Job Requirements:');
  console.log(`   Title: ${TEST_CONFIG.jdData.jobTitle}`);
  console.log(`   Company: ${TEST_CONFIG.jdData.companyName}`);
  console.log(`   Location: ${TEST_CONFIG.jdData.location}`);
  console.log(`   Experience: ${TEST_CONFIG.jdData.parsedData.experienceRequired.minYears}-${TEST_CONFIG.jdData.parsedData.experienceRequired.maxYears} years`);
  console.log(`   Required Skills: ${TEST_CONFIG.jdData.parsedData.requiredSkillsSimple.join(', ')}`);
  console.log(`   Preferred Skills: ${TEST_CONFIG.jdData.parsedData.preferredSkillsSimple.join(', ')}`);
  console.log(`   Salary Range: ₹${TEST_CONFIG.jdData.parsedData.salaryRange.min.toLocaleString()}-₹${TEST_CONFIG.jdData.parsedData.salaryRange.max.toLocaleString()}`);
  console.log('='.repeat(60));

  try {
    // Connect to database
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);
    console.log('✅ Connected to database\n');

    // Get tenant connection (using main connection for testing)
    const tenantConnection = mongoose.connection;

    // Get candidate model
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Get all active candidates
    const totalCandidates = await Candidate.countDocuments({
      status: { $in: ['active', 'applied'] },
      isActive: true
    });

    console.log(`📊 Candidate Pool: ${totalCandidates} active candidates\n`);

    // Perform candidate matching
    console.log('🎯 Running candidate matching algorithm...\n');
    const matches = await candidateMatchingService.matchCandidates(
      TEST_CONFIG.jdData,
      tenantConnection,
      TEST_CONFIG.matchOptions
    );

    console.log(`📈 Matching Results: ${matches.length} candidates matched\n`);

    if (matches.length === 0) {
      console.log('❌ No candidates matched the requirements.');
      console.log('💡 Suggestions:');
      console.log('   - Lower the minimum experience requirement');
      console.log('   - Check if candidates have the required Java skills');
      console.log('   - Verify location preferences');
      return;
    }

    // Display detailed results
    console.log('🏆 Top Matching Candidates:');
    console.log('='.repeat(80));

    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      const match = matches[i];
      const candidate = await Candidate.findById(match.candidateId)
        .select('firstName lastName email phone skills experience currentDesignation currentCompany currentLocation preferredLocation status stage')
        .lean();

      if (!candidate) continue;

      const fitLevel = match.overallFit;
      const fitEmoji = fitLevel === 'excellent' ? '⭐' :
                      fitLevel === 'good' ? '✅' :
                      fitLevel === 'average' ? '⚠️' : '❌';

      console.log(`${i + 1}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} - ${match.matchScore}/100 (${fitLevel})`);
      console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone}`);
      console.log(`   💼 ${candidate.currentDesignation} at ${candidate.currentCompany || 'N/A'}`);
      console.log(`   📍 Current: ${candidate.currentLocation} | Preferred: ${(candidate.preferredLocation || []).join(', ')}`);
      console.log(`   🎓 Experience: ${candidate.experience?.years || 0} years ${candidate.experience?.months || 0} months`);
      console.log(`   🛠️  Skills: ${(candidate.skills || []).slice(0, 5).join(', ')}${(candidate.skills || []).length > 5 ? '...' : ''}`);

      // Show detailed match breakdown
      console.log(`   📊 Match Details:`);
      console.log(`      Skills: ${match.skillMatches?.length || 0} matches (${match.experienceMatch?.score || 0}/100)`);
      console.log(`      Experience: ${match.experienceMatch?.matchType || 'unknown'} (${match.experienceMatch?.score || 0}/100)`);
      console.log(`      Location: ${match.locationMatch?.matchType || 'unknown'} (${match.locationMatch?.score || 0}/100)`);
      console.log('');
    }

    // Show statistics
    console.log('📊 Match Statistics:');
    console.log('='.repeat(40));
    const excellentMatches = matches.filter(m => m.overallFit === 'excellent').length;
    const goodMatches = matches.filter(m => m.overallFit === 'good').length;
    const averageMatches = matches.filter(m => m.overallFit === 'average').length;
    const poorMatches = matches.filter(m => m.overallFit === 'poor').length;

    console.log(`   ⭐ Excellent Matches (90-100): ${excellentMatches}`);
    console.log(`   ✅ Good Matches (75-89): ${goodMatches}`);
    console.log(`   ⚠️  Average Matches (60-74): ${averageMatches}`);
    console.log(`   ❌ Poor Matches (<60): ${poorMatches}`);
    console.log(`   📈 Average Score: ${matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length) : 0}/100`);

    // Show location analysis
    console.log('\n📍 Location Analysis:');
    const noidaCandidates = matches.filter(m => {
      const candidate = matches.find(match => match.candidateId.toString() === m.candidateId.toString());
      return candidate?.locationMatch?.matchType === 'exact' || candidate?.locationMatch?.matchType === 'preferred';
    }).length;

    console.log(`   🏢 Candidates in/preferring Noida: ${noidaCandidates}`);
    console.log(`   🌍 Candidates open to relocation: ${matches.filter(m => m.locationMatch?.matchType === 'flexible').length}`);

    // Show skill analysis
    console.log('\n🛠️  Skill Analysis:');
    const javaCandidates = matches.filter(m => m.skillMatches?.some(skill =>
      skill.skill.toLowerCase().includes('java') ||
      skill.candidateSkill.toLowerCase().includes('java')
    )).length;

    console.log(`   ☕ Candidates with Java skills: ${javaCandidates}`);
    console.log(`   🚀 Candidates with Spring/Hibernate: ${matches.filter(m => m.skillMatches?.some(skill =>
      ['spring', 'hibernate'].some(s => skill.skill.toLowerCase().includes(s) || skill.candidateSkill.toLowerCase().includes(s))
    )).length}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
}

async function testSpecificCandidate() {
  console.log('\n🔍 Testing Specific Candidate Matching...\n');

  try {
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);

    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Find a candidate with Java skills
    const javaCandidate = await Candidate.findOne({
      skills: { $regex: /java/i },
      status: 'active',
      isActive: true
    }).select('firstName lastName email skills experience currentLocation preferredLocation currentDesignation currentCompany');

    if (javaCandidate) {
      console.log('👤 Found Java Developer:');
      console.log(`   Name: ${javaCandidate.firstName} ${javaCandidate.lastName}`);
      console.log(`   Email: ${javaCandidate.email}`);
      console.log(`   Skills: ${javaCandidate.skills.join(', ')}`);
      console.log(`   Experience: ${javaCandidate.experience?.years || 0} years`);
      console.log(`   Location: ${javaCandidate.currentLocation}`);
      console.log(`   Preferred Locations: ${(javaCandidate.preferredLocation || []).join(', ')}`);

      // Test matching
      const matchResult = candidateMatchingService.calculateMatchScore(javaCandidate, TEST_CONFIG.jdData);
      console.log('\n📊 Match Result:');
      console.log(`   Overall Score: ${matchResult.overallScore}/100 (${matchResult.overallFit})`);
      console.log(`   Skills Score: ${matchResult.skillMatches?.length || 0} matches`);
      console.log(`   Experience Score: ${matchResult.experienceMatch?.score || 0}/100`);
      console.log(`   Location Score: ${matchResult.locationMatch?.score || 0}/100`);
    } else {
      console.log('❌ No candidates with Java skills found in database');
    }

  } catch (error) {
    console.error('❌ Specific candidate test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function runAllTests() {
  console.log('🧪 Java Developer - Noida Location Matching Test Suite\n');
  console.log('🎯 Testing JD: Senior Java Developer in Noida');
  console.log('📋 Requirements: Java, Spring, Hibernate, 3-8 years experience\n');

  try {
    await testJavaDeveloperMatching();
    console.log('\n' + '='.repeat(60));
    await testSpecificCandidate();
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testJavaDeveloperMatching,
  testSpecificCandidate,
  runAllTests
};