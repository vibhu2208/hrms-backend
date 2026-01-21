const candidateMatchingService = require('./src/services/candidateMatchingService');

// Test individual components of the matching algorithm
const testCandidate = {
  _id: 'test1',
  firstName: 'Rahul',
  lastName: 'Sharma',
  skills: ['Java', 'Spring Boot', 'Hibernate', 'MySQL', 'REST APIs', 'Git'],
  experience: { years: 5, months: 2 },
  currentLocation: 'Noida',
  preferredLocation: ['Noida', 'Delhi', 'Gurgaon'],
  currentCTC: 1200000,
  expectedCTC: 1500000,
  education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }]
};

const testJD = {
  parsedData: {
    experienceRequired: { minYears: 3, maxYears: 8 },
    requiredSkillsSimple: ['java', 'spring', 'hibernate', 'mysql', 'git', 'microservices'],
    preferredSkillsSimple: ['docker', 'kubernetes', 'aws', 'react', 'angular'],
    jobLocation: 'Noida',
    preferredLocations: ['Noida', 'Delhi', 'Gurgaon', 'Ghaziabad'],
    salaryRange: { min: 800000, max: 1800000, currency: 'INR' },
    educationRequirementsSimple: ['bachelor of technology', 'computer science']
  },
  statistics: { lastMatchedAt: new Date() }
};

console.log('🔍 Debug: Individual Matching Components\n');
console.log('=' .repeat(50));

// Test skill normalization
console.log('1. Skill Normalization Test:');
console.log(`   Candidate Skills: ${testCandidate.skills.join(', ')}`);
console.log(`   JD Required Skills: ${testJD.parsedData.requiredSkillsSimple.join(', ')}`);

testCandidate.skills.forEach(skill => {
  const normalized = candidateMatchingService.normalizeSkill(skill);
  console.log(`   "${skill}" -> "${normalized}"`);
});

console.log('');

// Test individual matching components
console.log('2. Individual Component Tests:');

try {
  const skillMatch = candidateMatchingService.calculateSkillMatch(testCandidate, testJD);
  console.log('✅ Skill Match Result:');
  console.log(`   Score: ${skillMatch.score}/100`);
  console.log(`   Matches: ${skillMatch.totalMatched}`);
  console.log(`   Details:`, skillMatch.details);
} catch (error) {
  console.log('❌ Skill Match Error:', error.message);
}

console.log('');

try {
  const experienceMatch = candidateMatchingService.calculateExperienceMatch(testCandidate, testJD);
  console.log('✅ Experience Match Result:');
  console.log(`   Score: ${experienceMatch.score}/100`);
  console.log(`   Type: ${experienceMatch.matchType}`);
  console.log(`   Candidate Years: ${experienceMatch.candidateYears}`);
  console.log(`   Required: ${experienceMatch.requiredMin}-${experienceMatch.requiredMax} years`);
} catch (error) {
  console.log('❌ Experience Match Error:', error.message);
}

console.log('');

try {
  const locationMatch = candidateMatchingService.calculateLocationMatch(testCandidate, testJD);
  console.log('✅ Location Match Result:');
  console.log(`   Score: ${locationMatch.score}/100`);
  console.log(`   Type: ${locationMatch.matchType}`);
  console.log(`   Candidate Location: ${locationMatch.candidateLocation}`);
  console.log(`   Job Location: ${locationMatch.jobLocation}`);
} catch (error) {
  console.log('❌ Location Match Error:', error.message);
}

console.log('');

try {
  const educationMatch = candidateMatchingService.calculateEducationMatch(testCandidate, testJD);
  console.log('✅ Education Match Result:');
  console.log(`   Score: ${educationMatch.score}/100`);
  console.log(`   Required Education: ${educationMatch.requiredEducation?.join(', ')}`);
  console.log(`   Candidate Education: ${educationMatch.candidateEducation?.join(', ')}`);
} catch (error) {
  console.log('❌ Education Match Error:', error.message);
}

console.log('');

try {
  const salaryMatch = candidateMatchingService.calculateSalaryMatch(testCandidate, testJD);
  console.log('✅ Salary Match Result:');
  console.log(`   Score: ${salaryMatch.score}/100`);
  console.log(`   Type: ${salaryMatch.matchType}`);
  console.log(`   Candidate CTC: ₹${salaryMatch.candidateCTC?.toLocaleString()}`);
  console.log(`   Job Range: ₹${salaryMatch.jobSalaryRange?.min?.toLocaleString()}-₹${salaryMatch.jobSalaryRange?.max?.toLocaleString()}`);
} catch (error) {
  console.log('❌ Salary Match Error:', error.message);
}

console.log('\n' + '='.repeat(50));
console.log('🔧 Overall Score Calculation:');

// Manual calculation to debug
let skillScore = 0, expScore = 0, locScore = 0, eduScore = 0, salScore = 0;

try {
  skillScore = candidateMatchingService.calculateSkillMatch(testCandidate, testJD).score;
  expScore = candidateMatchingService.calculateExperienceMatch(testCandidate, testJD).score;
  locScore = candidateMatchingService.calculateLocationMatch(testCandidate, testJD).score;
  eduScore = candidateMatchingService.calculateEducationMatch(testCandidate, testJD).score;
  salScore = candidateMatchingService.calculateSalaryMatch(testCandidate, testJD).score;

  const overallScore = Math.round(
    skillScore * 0.4 + expScore * 0.25 + locScore * 0.15 + eduScore * 0.1 + salScore * 0.05
  );

  console.log(`   Skills (40%): ${skillScore} * 0.4 = ${skillScore * 0.4}`);
  console.log(`   Experience (25%): ${expScore} * 0.25 = ${expScore * 0.25}`);
  console.log(`   Location (15%): ${locScore} * 0.15 = ${locScore * 0.15}`);
  console.log(`   Education (10%): ${eduScore} * 0.1 = ${eduScore * 0.1}`);
  console.log(`   Salary (5%): ${salScore} * 0.05 = ${salScore * 0.05}`);
  console.log(`   Overall Score: ${overallScore}/100`);

  const fitLevel = overallScore >= 90 ? 'excellent' :
                   overallScore >= 75 ? 'good' :
                   overallScore >= 60 ? 'average' : 'poor';
  console.log(`   Fit Level: ${fitLevel}`);

} catch (error) {
  console.log('❌ Overall calculation error:', error.message);
}

console.log('\n✅ Debug completed!');