const candidateMatchingService = require('./src/services/candidateMatchingService');

// Mock candidates representing typical Indian IT job market
const MOCK_CANDIDATES = [
  {
    _id: 'candidate1',
    firstName: 'Rahul',
    lastName: 'Sharma',
    email: 'rahul.sharma@email.com',
    phone: '9876543210',
    skills: ['Java', 'Spring Boot', 'Hibernate', 'MySQL', 'REST APIs', 'Git'],
    experience: { years: 5, months: 2 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Gurgaon'],
    currentDesignation: 'Senior Java Developer',
    currentCompany: 'Tech Solutions Pvt Ltd',
    currentCTC: 1200000,
    expectedCTC: 1500000,
    education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate2',
    firstName: 'Priya',
    lastName: 'Singh',
    email: 'priya.singh@email.com',
    phone: '9876543211',
    skills: ['Java', 'Spring', 'Microservices', 'Docker', 'Kubernetes', 'AWS'],
    experience: { years: 4, months: 8 },
    currentLocation: 'Delhi',
    preferredLocation: ['Delhi', 'Noida', 'Gurgaon'],
    currentDesignation: 'Java Developer',
    currentCompany: 'InnovateTech',
    currentCTC: 950000,
    expectedCTC: 1300000,
    education: [{ degree: 'Bachelor of Engineering', specialization: 'Information Technology' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate3',
    firstName: 'Amit',
    lastName: 'Kumar',
    email: 'amit.kumar@email.com',
    phone: '9876543212',
    skills: ['Python', 'Django', 'React', 'JavaScript', 'PostgreSQL'],
    experience: { years: 3, months: 6 },
    currentLocation: 'Bangalore',
    preferredLocation: ['Bangalore', 'Hyderabad'],
    currentDesignation: 'Full Stack Developer',
    currentCompany: 'StartupXYZ',
    currentCTC: 850000,
    expectedCTC: 1100000,
    education: [{ degree: 'Bachelor of Computer Applications' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate4',
    firstName: 'Sneha',
    lastName: 'Patel',
    email: 'sneha.patel@email.com',
    phone: '9876543213',
    skills: ['Java', 'Hibernate', 'MySQL', 'Spring MVC', 'JSP', 'Servlets'],
    experience: { years: 6, months: 0 },
    currentLocation: 'Mumbai',
    preferredLocation: ['Mumbai', 'Pune'],
    currentDesignation: 'Senior Java Developer',
    currentCompany: 'Enterprise Solutions Ltd',
    currentCTC: 1400000,
    expectedCTC: 1700000,
    education: [{ degree: 'Master of Computer Applications' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate5',
    firstName: 'Vikram',
    lastName: 'Gupta',
    email: 'vikram.gupta@email.com',
    phone: '9876543214',
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express'],
    experience: { years: 2, months: 4 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Ghaziabad'],
    currentDesignation: 'Frontend Developer',
    currentCompany: 'Digital Agency',
    currentCTC: 650000,
    expectedCTC: 850000,
    education: [{ degree: 'Bachelor of Science', specialization: 'Computer Science' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate6',
    firstName: 'Kavita',
    lastName: 'Mishra',
    email: 'kavita.mishra@email.com',
    phone: '9876543215',
    skills: ['Java', 'Spring Boot', 'Microservices', 'Docker', 'Kubernetes', 'AWS', 'MySQL'],
    experience: { years: 7, months: 3 },
    currentLocation: 'Noida',
    preferredLocation: ['Noida', 'Delhi', 'Gurgaon', 'Faridabad'],
    currentDesignation: 'Lead Java Developer',
    currentCompany: 'FinTech Corp',
    currentCTC: 1800000,
    expectedCTC: 2200000,
    education: [{ degree: 'Master of Technology', specialization: 'Software Engineering' }],
    status: 'active',
    isActive: true
  },
  {
    _id: 'candidate7',
    firstName: 'Rohit',
    lastName: 'Verma',
    email: 'rohit.verma@email.com',
    phone: '9876543216',
    skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL', 'Tableau'],
    experience: { years: 4, months: 1 },
    currentLocation: 'Gurgaon',
    preferredLocation: ['Gurgaon', 'Delhi', 'Noida'],
    currentDesignation: 'Data Scientist',
    currentCompany: 'Analytics Pro',
    currentCTC: 1300000,
    expectedCTC: 1600000,
    education: [{ degree: 'Master of Science', specialization: 'Statistics' }],
    status: 'active',
    isActive: true
  }
];

// JD for Senior Java Developer in Noida
const JAVA_JD_NOIDA = {
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
      'Collaborate with cross-functional teams',
      'Mentor junior developers'
    ]
  },
  statistics: { lastMatchedAt: new Date() }
};

async function testJavaNoidaMatching() {
  console.log('🚀 Java Developer - Noida Location Matching Demo\n');
  console.log('=' .repeat(70));
  console.log('📋 Job Requirements: Senior Java Developer in Noida');
  console.log('🏢 Company: TechSolutions Pvt Ltd');
  console.log('📍 Location: Noida, Uttar Pradesh');
  console.log('🎓 Experience: 3-8 years');
  console.log('🛠️  Required Skills: Java, Spring, Hibernate, MySQL, Git, Microservices');
  console.log('⭐ Preferred Skills: Docker, Kubernetes, AWS, React, Angular');
  console.log('💰 Salary Range: ₹8,00,000 - ₹18,00,000');
  console.log('📚 Education: B.Tech/B.E. in Computer Science or related');
  console.log('=' .repeat(70));

  console.log(`\n👥 Testing against ${MOCK_CANDIDATES.length} mock candidates...\n`);

  const matches = [];

  // Calculate matches for each candidate
  for (const candidate of MOCK_CANDIDATES) {
    const matchResult = candidateMatchingService.calculateMatchScore(candidate, JAVA_JD_NOIDA);
    matches.push({
      candidate,
      matchResult
    });
  }

  // Sort by match score (descending)
  matches.sort((a, b) => b.matchResult.overallScore - a.matchResult.overallScore);

  console.log('🏆 Matching Results (Sorted by Score):');
  console.log('='.repeat(100));

  let rank = 1;
  for (const { candidate, matchResult } of matches) {
    const fitLevel = matchResult.overallFit;
    const fitEmoji = fitLevel === 'excellent' ? '⭐' : fitLevel === 'good' ? '✅' : fitLevel === 'average' ? '⚠️' : '❌';

    console.log(`${rank}. ${fitEmoji} ${candidate.firstName} ${candidate.lastName} - ${matchResult.overallScore}/100 (${fitLevel})`);
    console.log(`   📧 ${candidate.email} | 📱 ${candidate.phone}`);
    console.log(`   💼 ${candidate.currentDesignation} at ${candidate.currentCompany}`);
    console.log(`   📍 Current: ${candidate.currentLocation} | Preferred: ${candidate.preferredLocation.join(', ')}`);
    console.log(`   🎓 Experience: ${candidate.experience.years} years ${candidate.experience.months} months`);
    console.log(`   🛠️  Skills: ${candidate.skills.join(', ')}`);
    console.log(`   💰 Current CTC: ₹${candidate.currentCTC.toLocaleString()} | Expected: ₹${candidate.expectedCTC.toLocaleString()}`);

    // Show detailed match breakdown
    console.log(`   📊 Match Details:`);
    console.log(`      🛠️  Skills: ${matchResult.skillMatches?.length || 0} matches (${matchResult.skillMatches?.reduce((sum, m) => sum + (m.score || 0), 0) || 0} points)`);
    console.log(`      🎓 Experience: ${matchResult.experienceMatch?.matchType || 'unknown'} (${matchResult.experienceMatch?.score || 0}/100)`);
    console.log(`      📍 Location: ${matchResult.locationMatch?.matchType || 'unknown'} (${matchResult.locationMatch?.score || 0}/100)`);
    console.log('');

    rank++;
  }

  // Show statistics
  console.log('📊 Match Statistics:');
  console.log('='.repeat(50));
  const excellentMatches = matches.filter(m => m.matchResult.overallFit === 'excellent').length;
  const goodMatches = matches.filter(m => m.matchResult.overallFit === 'good').length;
  const averageMatches = matches.filter(m => m.matchResult.overallFit === 'average').length;
  const poorMatches = matches.filter(m => m.matchResult.overallFit === 'poor').length;

  console.log(`   ⭐ Excellent Matches (90-100): ${excellentMatches}`);
  console.log(`   ✅ Good Matches (75-89): ${goodMatches}`);
  console.log(`   ⚠️  Average Matches (60-74): ${averageMatches}`);
  console.log(`   ❌ Poor Matches (<60): ${poorMatches}`);
  console.log(`   📈 Average Score: ${Math.round(matches.reduce((sum, m) => sum + m.matchResult.overallScore, 0) / matches.length)}/100`);

  // Show location analysis
  console.log('\n📍 Location Analysis:');
  const noidaCandidates = matches.filter(m => ['Noida', 'Delhi', 'Gurgaon', 'Ghaziabad', 'Faridabad'].includes(m.candidate.currentLocation)).length;
  const preferredNoida = matches.filter(m => m.candidate.preferredLocation.some(loc => ['Noida', 'Delhi', 'Gurgaon', 'Ghaziabad', 'Faridabad'].includes(loc))).length;

  console.log(`   🏢 Candidates currently in Delhi-NCR region: ${noidaCandidates}`);
  console.log(`   🎯 Candidates preferring Delhi-NCR region: ${preferredNoida}`);

  // Show skill analysis
  console.log('\n🛠️  Skill Analysis:');
  const javaCandidates = matches.filter(m => m.candidate.skills.some(skill => skill.toLowerCase().includes('java'))).length;
  const springCandidates = matches.filter(m => m.candidate.skills.some(skill => skill.toLowerCase().includes('spring'))).length;
  const fullStackCandidates = matches.filter(m => m.candidate.skills.some(skill => ['react', 'angular', 'vue', 'javascript', 'html', 'css'].includes(skill.toLowerCase()))).length;

  console.log(`   ☕ Candidates with Java skills: ${javaCandidates}`);
  console.log(`   🌱 Candidates with Spring framework: ${springCandidates}`);
  console.log(`   🎨 Candidates with Frontend skills: ${fullStackCandidates}`);

  // Show salary analysis
  console.log('\n💰 Salary Analysis:');
  const withinRange = matches.filter(m => m.candidate.expectedCTC >= 800000 && m.candidate.expectedCTC <= 1800000).length;
  const overBudget = matches.filter(m => m.candidate.expectedCTC > 1800000).length;
  const underRange = matches.filter(m => m.candidate.expectedCTC < 800000).length;

  console.log(`   ✅ Candidates within salary range: ${withinRange}`);
  console.log(`   💸 Candidates expecting higher salary: ${overBudget}`);
  console.log(`   📉 Candidates expecting lower salary: ${underRange}`);

  console.log('\n✅ Demo completed successfully!');
  console.log('\n💡 This demonstrates how the JD matching system would work with real candidate data.');
  console.log('💡 The algorithm successfully identifies the best Java developers for Noida-based roles.');
}

async function runDemo() {
  try {
    await testJavaNoidaMatching();
  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run demo if called directly
if (require.main === module) {
  runDemo();
}

module.exports = {
  testJavaNoidaMatching,
  runDemo
};