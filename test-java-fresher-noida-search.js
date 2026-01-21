const candidateMatchingService = require('./src/services/candidateMatchingService');

// Mock candidate pool representing real Indian IT job market with freshers
const CANDIDATE_POOL = [
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
  },
  {
    _id: 'cand3',
    firstName: 'Rohit',
    lastName: 'Kumar',
    email: 'rohit.kumar@email.com',
    phone: '9876543212',
    skills: ['Java', 'JSP', 'Servlets', 'Oracle', 'JavaScript'],
    experience: { years: 0, months: 8 },
    currentLocation: 'Delhi',
    preferredLocation: ['Delhi', 'Noida', 'Gurgaon'],
    currentDesignation: 'Java Trainee',
    currentCompany: 'MNC Corp',
    currentCTC: 300000,
    expectedCTC: 500000,
    education: [{ degree: 'Master of Computer Applications' }],
    status: 'active',
    isActive: true,
    noticePeriod: 'Immediate',
    source: 'referral'
  },
  {
    _id: 'cand4',
    firstName: 'Sneha',
    lastName: 'Patel',
    email: 'sneha.patel@email.com',
    phone: '9876543213',
    skills: ['Python', 'Django', 'SQL', 'HTML', 'CSS'],
    experience: { years: 1, months: 0 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Faridabad'],
    currentDesignation: 'Python Developer',
    currentCompany: 'FinTech Startup',
    currentCTC: 400000,
    expectedCTC: 600000,
    education: [{ degree: 'Bachelor of Science', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true,
    noticePeriod: '2 weeks',
    source: 'job-portal'
  },
  {
    _id: 'cand5',
    firstName: 'Vikram',
    lastName: 'Gupta',
    email: 'vikram.gupta@email.com',
    phone: '9876543214',
    skills: ['Java', 'Spring', 'Microservices', 'Docker', 'Kubernetes'],
    experience: { years: 2, months: 6 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Gurgaon', 'Delhi'],
    currentDesignation: 'Java Developer',
    currentCompany: 'Product Company',
    currentCTC: 650000,
    expectedCTC: 850000,
    education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true,
    noticePeriod: '30 days',
    source: 'linkedin'
  },
  {
    _id: 'cand6',
    firstName: 'Anjali',
    lastName: 'Verma',
    email: 'anjali.verma@email.com',
    phone: '9876543215',
    skills: ['Java', 'MySQL', 'Git', 'HTML', 'CSS'],
    experience: { years: 0, months: 4 },
    currentLocation: 'Ghaziabad',
    preferredLocation: ['Ghaziabad', 'Noida', 'Delhi'],
    currentDesignation: 'Java Developer Fresher',
    currentCompany: 'BPO Company',
    currentCTC: 200000,
    expectedCTC: 350000,
    education: [{ degree: 'Bachelor of Computer Applications' }],
    status: 'active',
    isActive: true,
    noticePeriod: 'Immediate',
    source: 'campus-placement'
  },
  {
    _id: 'cand7',
    firstName: 'Rajesh',
    lastName: 'Yadav',
    email: 'rajesh.yadav@email.com',
    phone: '9876543216',
    skills: ['C++', 'Data Structures', 'Algorithms', 'Java'],
    experience: { years: 0, months: 0 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Gurgaon'],
    currentDesignation: 'Fresher',
    currentCompany: 'Training Institute',
    currentCTC: 0,
    expectedCTC: 300000,
    education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true,
    noticePeriod: 'Immediate',
    source: 'walk-in'
  },
  {
    _id: 'cand8',
    firstName: 'Kavita',
    lastName: 'Mishra',
    email: 'kavita.mishra@email.com',
    phone: '9876543217',
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express'],
    experience: { years: 1, months: 8 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Faridabad'],
    currentDesignation: 'Full Stack Developer',
    currentCompany: 'E-commerce Company',
    currentCTC: 450000,
    expectedCTC: 700000,
    education: [{ degree: 'Bachelor of Science', specialization: 'Information Technology' }],
    status: 'active',
    isActive: true,
    noticePeriod: '1 month',
    source: 'job-portal'
  },
  {
    _id: 'cand9',
    firstName: 'Mohit',
    lastName: 'Agarwal',
    email: 'mohit.agarwal@email.com',
    phone: '9876543218',
    skills: ['Java', 'Spring MVC', 'JSP', 'MySQL', 'Hibernate'],
    experience: { years: 1, months: 6 },
    currentLocation: 'Delhi',
    preferredLocation: ['Delhi', 'Noida', 'Gurgaon'],
    currentDesignation: 'Java Developer',
    currentCompany: 'Consulting Firm',
    currentCTC: 500000,
    expectedCTC: 750000,
    education: [{ degree: 'Master of Computer Applications' }],
    status: 'active',
    isActive: true,
    noticePeriod: '15 days',
    source: 'consultant'
  },
  {
    _id: 'cand10',
    firstName: 'Pooja',
    lastName: 'Jain',
    email: 'pooja.jain@email.com',
    phone: '9876543219',
    skills: ['Java', 'SQL', 'PL/SQL', 'Oracle', 'Unix'],
    experience: { years: 0, months: 9 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Gurgaon'],
    currentDesignation: 'Java Developer',
    currentCompany: 'Banking Software',
    currentCTC: 320000,
    expectedCTC: 550000,
    education: [{ degree: 'Bachelor of Engineering', specialization: 'Computer Engineering' }],
    status: 'active',
    isActive: true,
    noticePeriod: 'Immediate',
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

function filterCandidatesByCriteria(candidates, criteria) {
  return candidates.filter(candidate => {
    // Location filter: Must be in Noida or willing to work in Noida
    const locationMatch = candidate.currentLocation === 'Noida' ||
                         candidate.preferredLocation.includes('Noida');

    // Experience filter: 0-2 years (fresher)
    const experienceYears = candidate.experience.years + (candidate.experience.months / 12);
    const experienceMatch = experienceYears >= 0 && experienceYears <= 2;

    // Skills filter: Must have Java
    const hasJava = candidate.skills.some(skill =>
      skill.toLowerCase().includes('java')
    );

    // Status filter: Must be active
    const statusMatch = candidate.status === 'active' && candidate.isActive === true;

    return locationMatch && experienceMatch && hasJava && statusMatch;
  });
}

async function searchJavaFreshersInNoida() {
  console.log('🔍 Candidate Pool Search: Java Developer Fresher in Noida\n');
  console.log('=' .repeat(70));
  console.log('📋 Search Criteria:');
  console.log(`   Position: ${SEARCH_CRITERIA.jobTitle}`);
  console.log(`   Location: ${SEARCH_CRITERIA.location}`);
  console.log(`   Experience: 0-2 years (Fresher)`);
  console.log(`   Required Skills: Java`);
  console.log(`   Preferred Skills: MySQL, Git, HTML, CSS, JavaScript, Spring, Hibernate`);
  console.log(`   Salary Range: ₹${SEARCH_CRITERIA.parsedData.salaryRange.min.toLocaleString()}-₹${SEARCH_CRITERIA.parsedData.salaryRange.max.toLocaleString()}`);
  console.log('=' .repeat(70));

  // Filter candidates based on basic criteria
  const filteredCandidates = filterCandidatesByCriteria(CANDIDATE_POOL, SEARCH_CRITERIA);

  console.log(`\n👥 Found ${filteredCandidates.length} Java Developer Freshers in Noida area\n`);

  if (filteredCandidates.length === 0) {
    console.log('❌ No candidates match the criteria.');
    console.log('\n💡 Suggestions:');
    console.log('   - Expand location preferences');
    console.log('   - Increase experience range');
    console.log('   - Check if candidates have Java skills');
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
  console.log('='.repeat(100));

  let rank = 1;
  for (const { candidate, matchResult } of candidatesWithScores) {
    const fitLevel = matchResult.overallFit;
    const fitEmoji = fitLevel === 'excellent' ? '⭐' :
                    fitLevel === 'good' ? '✅' :
                    fitLevel === 'average' ? '⚠️' : '❌';

    const experienceYears = candidate.experience.years + (candidate.experience.months / 12);
    const experienceDisplay = experienceYears < 1 ?
      `${candidate.experience.months} months` :
      `${experienceYears.toFixed(1)} years`;

    console.log(`${rank}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} - ${matchResult.overallScore}/100 (${fitLevel})`);
    console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone}`);
    console.log(`   💼 ${candidate.currentDesignation} at ${candidate.currentCompany}`);
    console.log(`   📍 Current: ${candidate.currentLocation} | Preferred: ${candidate.preferredLocation.join(', ')}`);
    console.log(`   🎓 Experience: ${experienceDisplay} | Education: ${candidate.education[0]?.degree || 'N/A'}`);
    console.log(`   🛠️  Skills: ${candidate.skills.join(', ')}`);
    console.log(`   💰 Current CTC: ₹${candidate.currentCTC.toLocaleString()} | Expected: ₹${candidate.expectedCTC.toLocaleString()}`);
    console.log(`   ⏰ Notice Period: ${candidate.noticePeriod} | Source: ${candidate.source}`);

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
  console.log('='.repeat(50));
  const excellentMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'excellent').length;
  const goodMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'good').length;
  const averageMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'average').length;
  const poorMatches = candidatesWithScores.filter(m => m.matchResult.overallFit === 'poor').length;

  console.log(`   ⭐ Excellent Matches (90-100): ${excellentMatches}`);
  console.log(`   ✅ Good Matches (75-89): ${goodMatches}`);
  console.log(`   ⚠️  Average Matches (60-74): ${averageMatches}`);
  console.log(`   ❌ Poor Matches (<60): ${poorMatches}`);
  console.log(`   📈 Average Score: ${Math.round(candidatesWithScores.reduce((sum, m) => sum + m.matchResult.overallScore, 0) / candidatesWithScores.length)}/100`);

  // Show location distribution
  console.log('\n📍 Location Distribution:');
  const noidaBased = candidatesWithScores.filter(m => m.candidate.currentLocation === 'Noida').length;
  const delhiBased = candidatesWithScores.filter(m => m.candidate.currentLocation === 'Delhi').length;
  const otherLocations = candidatesWithScores.filter(m => !['Noida', 'Delhi'].includes(m.candidate.currentLocation)).length;

  console.log(`   🏢 Currently in Noida: ${noidaBased}`);
  console.log(`   🏙️  Currently in Delhi: ${delhiBased}`);
  console.log(`   🌍 Other locations: ${otherLocations}`);

  // Show experience distribution
  console.log('\n🎓 Experience Distribution:');
  const zeroToSixMonths = candidatesWithScores.filter(m => {
    const exp = m.candidate.experience.years * 12 + m.candidate.experience.months;
    return exp <= 6;
  }).length;
  const sixToTwelveMonths = candidatesWithScores.filter(m => {
    const exp = m.candidate.experience.years * 12 + m.candidate.experience.months;
    return exp > 6 && exp <= 12;
  }).length;
  const twelveToTwentyFourMonths = candidatesWithScores.filter(m => {
    const exp = m.candidate.experience.years * 12 + m.candidate.experience.months;
    return exp > 12 && exp <= 24;
  }).length;

  console.log(`   🍼 0-6 months: ${zeroToSixMonths}`);
  console.log(`   👶 6-12 months: ${sixToTwelveMonths}`);
  console.log(`   👦 12-24 months: ${twelveToTwentyFourMonths}`);

  // Show top skills
  console.log('\n🛠️  Top Skills Among Candidates:');
  const skillCount = {};
  candidatesWithScores.forEach(({ candidate }) => {
    candidate.skills.forEach(skill => {
      skillCount[skill] = (skillCount[skill] || 0) + 1;
    });
  });

  const sortedSkills = Object.entries(skillCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  sortedSkills.forEach(([skill, count]) => {
    console.log(`   ${skill}: ${count} candidates`);
  });

  console.log('\n✅ Search completed successfully!');
  console.log('\n💡 Key Findings:');
  console.log(`   • Found ${candidatesWithScores.length} qualified Java Developer freshers in Noida area`);
  console.log(`   • ${excellentMatches + goodMatches} candidates have good to excellent match scores`);
  console.log(`   • Most candidates are willing to join immediately with short notice periods`);
  console.log(`   • Average expected salary: ₹${Math.round(candidatesWithScores.reduce((sum, m) => sum + m.candidate.expectedCTC, 0) / candidatesWithScores.length).toLocaleString()}`);
}

async function runSearch() {
  try {
    await searchJavaFreshersInNoida();
  } catch (error) {
    console.error('❌ Search failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run search if called directly
if (require.main === module) {
  runSearch();
}

module.exports = {
  searchJavaFreshersInNoida,
  runSearch,
  filterCandidatesByCriteria
};