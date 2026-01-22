const mongoose = require('mongoose');
const { getTenantModel } = require('./src/utils/tenantModels');
const candidateMatchingService = require('./src/services/candidateMatchingService');

// Mock candidate pool representing real Indian IT job market with freshers
const MOCK_CANDIDATE_POOL = [
  // Java Freshers in Noida
  {
    _id: 'cand1',
    firstName: 'Aman',
    lastName: 'Sharma',
    email: 'aman.sharma@email.com',
    phone: '9876543210',
    skills: ['Java', 'MySQL', 'HTML', 'CSS', 'JavaScript'],
    experience: { years: 0, months: 6 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Gurgaon'],
    currentDesignation: 'Java Developer Intern',
    currentCompany: 'Tech Startup',
    currentCTC: 250000,
    expectedCTC: 400000,
    education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true,
    noticePeriod: 'Immediate',
    source: 'campus-placement'
  },
  {
    _id: 'cand2',
    firstName: 'Priya',
    lastName: 'Singh',
    email: 'priya.singh@email.com',
    phone: '9876543211',
    skills: ['Java', 'Spring Boot', 'Hibernate', 'MySQL', 'Git'],
    experience: { years: 1, months: 2 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Ghaziabad'],
    currentDesignation: 'Junior Java Developer',
    currentCompany: 'IT Services Company',
    currentCTC: 350000,
    expectedCTC: 550000,
    education: [{ degree: 'Bachelor of Engineering', specialization: 'Information Technology' }],
    status: 'active',
    isActive: true,
    noticePeriod: '1 month',
    source: 'job-portal'
  }
];

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

async function getRealCandidatePool() {
  try {
    // Try to connect to database
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);

    const tenantConnection = mongoose.connection;
    const Candidate = getTenantModel(tenantConnection, 'Candidate');

    // Get active candidates
    const candidates = await Candidate.find({
      status: { $in: ['active', 'applied'] },
      isActive: true
    }).select('firstName lastName email phone skills experience currentLocation preferredLocation currentDesignation currentCompany currentCTC expectedCTC education status isActive noticePeriod source candidateCode');

    await mongoose.disconnect();

    console.log(`✅ Found ${candidates.length} real candidates in database`);
    return candidates;

  } catch (error) {
    console.log('⚠️  Database connection failed, using mock data for demonstration');
    console.log('💡 To test with real data, ensure database is configured and candidates are seeded');
    return MOCK_CANDIDATE_POOL;
  }
}

function filterCandidatesByCriteria(candidates, criteria) {
  return candidates.filter(candidate => {
    // Location filter: Must be in Noida or willing to work in Noida
    const locationMatch = candidate.currentLocation === 'Noida' ||
                         (candidate.preferredLocation && candidate.preferredLocation.includes('Noida'));

    // Experience filter: 0-2 years (fresher)
    const experienceYears = candidate.experience?.years || 0 + (candidate.experience?.months || 0) / 12;
    const experienceMatch = experienceYears >= 0 && experienceYears <= 2;

    // Skills filter: Must have Java
    const hasJava = (candidate.skills || []).some(skill =>
      skill.toLowerCase().includes('java')
    );

    // Status filter: Must be active
    const statusMatch = candidate.status === 'active' && candidate.isActive === true;

    return locationMatch && experienceMatch && hasJava && statusMatch;
  });
}

async function searchJavaFreshersInNoidaRealData() {
  console.log('🔍 REAL DATA TEST: Java Developer Fresher in Noida\n');
  console.log('=' .repeat(70));

  // Get candidate pool (real data if available, mock data as fallback)
  const candidatePool = await getRealCandidatePool();
  const dataSource = candidatePool === MOCK_CANDIDATE_POOL ? 'Mock Data (Database Empty)' : 'Real Database';

  console.log(`📊 Data Source: ${dataSource}`);
  console.log(`👥 Total Candidates in Pool: ${candidatePool.length}`);
  console.log('');

  console.log('📋 Search Criteria:');
  console.log(`   Position: ${SEARCH_CRITERIA.jobTitle}`);
  console.log(`   Location: ${SEARCH_CRITERIA.location}`);
  console.log(`   Experience: 0-2 years (Fresher)`);
  console.log(`   Required Skills: Java`);
  console.log(`   Preferred Skills: MySQL, Git, HTML, CSS, JavaScript, Spring, Hibernate`);
  console.log(`   Salary Range: ₹${SEARCH_CRITERIA.parsedData.salaryRange.min.toLocaleString()}-₹${SEARCH_CRITERIA.parsedData.salaryRange.max.toLocaleString()}`);
  console.log('=' .repeat(70));

  // Filter candidates based on basic criteria
  const filteredCandidates = filterCandidatesByCriteria(candidatePool, SEARCH_CRITERIA);

  console.log(`\n🎯 Found ${filteredCandidates.length} Java Developer Freshers in Noida area\n`);

  if (filteredCandidates.length === 0) {
    console.log('❌ No candidates match the criteria.');
    console.log('\n💡 Suggestions:');
    console.log('   - Expand location preferences');
    console.log('   - Increase experience range');
    console.log('   - Check if candidates have Java skills');
    console.log('   - Ensure candidates are marked as active');
    return;
  }

  // Calculate detailed matching scores for each candidate
  const candidatesWithScores = [];

  for (const candidate of filteredCandidates) {
    // Calculate individual components manually for accurate scoring
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

    const matchResult = {
      overallScore,
      overallFit,
      skillMatches: skillMatch.details,
      experienceMatch,
      locationMatch,
      educationMatch,
      salaryMatch
    };

    candidatesWithScores.push({
      candidate,
      matchResult
    });
  }

  // Sort by match score (descending)
  candidatesWithScores.sort((a, b) => b.matchResult.overallScore - a.matchResult.overallScore);

  console.log('🏆 Matching Results (Sorted by Score):');
  console.log('='.repeat(120));

  let rank = 1;
  for (const { candidate, matchResult } of candidatesWithScores) {
    const fitLevel = matchResult.overallFit;
    const fitEmoji = fitLevel === 'excellent' ? '⭐' :
                    fitLevel === 'good' ? '✅' :
                    fitLevel === 'average' ? '⚠️' : '❌';

    const experienceYears = (candidate.experience?.years || 0) + ((candidate.experience?.months || 0) / 12);
    const experienceDisplay = experienceYears < 1 ?
      `${candidate.experience?.months || 0} months` :
      `${experienceYears.toFixed(1)} years`;

    console.log(`${rank}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} (${candidate.candidateCode || 'N/A'}) - ${matchResult.overallScore}/100 (${fitLevel})`);
    console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone || 'N/A'}`);
    console.log(`   💼 ${candidate.currentDesignation || 'N/A'} at ${candidate.currentCompany || 'N/A'}`);
    console.log(`   📍 Current: ${candidate.currentLocation || 'N/A'} | Preferred: ${(candidate.preferredLocation || []).join(', ') || 'None'}`);
    console.log(`   🎓 Experience: ${experienceDisplay} | Education: ${candidate.education?.[0]?.degree || 'N/A'}`);
    console.log(`   🛠️  Skills: ${(candidate.skills || []).join(', ') || 'None'}`);
    console.log(`   💰 Current CTC: ₹${(candidate.currentCTC || 0).toLocaleString()} | Expected: ₹${(candidate.expectedCTC || 0).toLocaleString()}`);
    console.log(`   ⏰ Notice Period: ${candidate.noticePeriod || 'N/A'} | Source: ${candidate.source || 'N/A'}`);

    // Show detailed match breakdown
    console.log(`   📊 Match Details:`);
    console.log(`      🛠️  Skills: ${matchResult.skillMatches?.length || 0} matches (${matchResult.skillMatches?.reduce((sum, m) => sum + (m.score || 0), 0) || 0} points)`);
    console.log(`      🎓 Experience: ${matchResult.experienceMatch?.matchType || 'unknown'} (${matchResult.experienceMatch?.score || 0}/100)`);
    console.log(`      📍 Location: ${matchResult.locationMatch?.matchType || 'unknown'} (${matchResult.locationMatch?.score || 0}/100)`);
    console.log('');

    rank++;
  }

  // Show statistics
  console.log('📊 Search Statistics:');
  console.log('='.repeat(60));
  const excellentMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'excellent').length;
  const goodMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'good').length;
  const averageMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'average').length;
  const poorMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'poor').length;

  console.log(`   ⭐ Excellent Matches (90-100): ${excellentMatches}`);
  console.log(`   ✅ Good Matches (75-89): ${goodMatches}`);
  console.log(`   ⚠️  Average Matches (60-74): ${averageMatches}`);
  console.log(`   ❌ Poor Matches (<60): ${poorMatches}`);
  console.log(`   📈 Average Score: ${Math.round(candidatesWithScores.reduce((sum, m) => sum + m.matchResult.overallScore, 0) / candidatesWithScores.length)}/100`);

  console.log('\n✅ Search completed successfully!');
  console.log(`\n💡 Data Source: ${dataSource}`);
  if (dataSource.includes('Mock')) {
    console.log('💡 To test with real database data:');
    console.log('   1. Configure database connection in .env file');
    console.log('   2. Run: npm run seed:candidate (to seed candidate data)');
    console.log('   3. Re-run this test');
  }
  console.log(`\n🎯 Found ${candidatesWithScores.length} qualified Java Developer freshers in Noida area`);
  console.log(`🏆 ${excellentMatches + goodMatches} candidates have good to excellent match scores`);
}

async function runRealDataSearch() {
  try {
    await searchJavaFreshersInNoidaRealData();
  } catch (error) {
    console.error('❌ Search failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run search if called directly
if (require.main === module) {
  runRealDataSearch();
}

module.exports = {
  searchJavaFreshersInNoidaRealData,
  runRealDataSearch,
  getRealCandidatePool,
  filterCandidatesByCriteria
};