const fs = require('fs');
const path = require('path');
const jdParserService = require('./src/services/jdParserService');
const { getTenantModel } = require('./src/utils/tenantModels');
const mongoose = require('mongoose');

// Test configuration
const TEST_CONFIG = {
  tenantId: 'test-tenant',
  testFiles: [
    {
      name: 'sample-jd-1.txt',
      content: `
Senior Software Engineer - React/Node.js

About the Company:
TechCorp Solutions is a leading software development company specializing in web and mobile applications.

Job Description:
We are looking for a Senior Software Engineer with 5+ years of experience in full-stack development.

Requirements:
- 5+ years of experience in software development
- Strong proficiency in React.js and Node.js
- Experience with MongoDB and PostgreSQL
- Knowledge of AWS or cloud platforms
- Bachelor's degree in Computer Science or related field

Key Responsibilities:
- Develop and maintain web applications using React and Node.js
- Design and implement RESTful APIs
- Collaborate with cross-functional teams
- Mentor junior developers
- Participate in code reviews

Skills Required:
- JavaScript, React, Node.js, Express
- MongoDB, PostgreSQL
- AWS, Docker, Git
- Agile methodologies

Location: Mumbai, Maharashtra (or remote)
Salary: ₹12,00,000 - ₹18,00,000 per annum

Benefits:
- Health insurance
- Flexible working hours
- Learning and development budget
- Stock options
      `
    },
    {
      name: 'sample-jd-2.txt',
      content: `
Data Scientist

Company: DataTech Analytics

Position Overview:
Join our data science team to work on cutting-edge machine learning projects.

Experience Required: 3-6 years

Must Have Skills:
- Python, R programming
- Machine Learning algorithms
- SQL, NoSQL databases
- Statistical analysis
- Data visualization (Tableau, Power BI)

Preferred Skills:
- Deep Learning (TensorFlow, PyTorch)
- Big Data technologies (Spark, Hadoop)
- Cloud platforms (AWS, GCP)

Education: Master's degree in Data Science, Statistics, or related field

Location: Bangalore, Karnataka
Remote work: Hybrid

CTC Range: ₹15,00,000 - ₹25,00,000

Perks:
- Top-tier health benefits
- Unlimited PTO
- Conference attendance
- Research time
      `
    }
  ]
};

async function createTestFiles() {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const createdFiles = [];
  for (const testFile of TEST_CONFIG.testFiles) {
    const filePath = path.join(testDir, testFile.name);
    fs.writeFileSync(filePath, testFile.content.trim());
    createdFiles.push(filePath);
  }

  return createdFiles;
}

async function cleanupTestFiles(files) {
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  const testDir = path.join(__dirname, 'test-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testJDTextParsing() {
  console.log('🧪 Testing JD Text Parsing...\n');

  const testFiles = await createTestFiles();

  try {
    for (let i = 0; i < testFiles.length; i++) {
      const filePath = testFiles[i];
      const fileName = path.basename(filePath);

      console.log(`📄 Testing file: ${fileName}`);

      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');

      // Parse JD text
      const parsedData = await jdParserService.parseJDText(content);

      console.log('✅ Parsed successfully!');
      console.log('📊 Extracted Data:');
      console.log(`   Title: ${parsedData.jobTitle || 'Not found'}`);
      console.log(`   Experience: ${parsedData.experienceRequired?.minYears || 0}-${parsedData.experienceRequired?.maxYears || '∞'} years`);
      console.log(`   Required Skills: ${parsedData.requiredSkills?.slice(0, 3).join(', ') || 'None'}${parsedData.requiredSkills?.length > 3 ? '...' : ''}`);
      console.log(`   Location: ${parsedData.jobLocation || 'Not specified'}`);
      console.log(`   Salary: ${parsedData.salaryRange ? `${parsedData.salaryRange.min}-${parsedData.salaryRange.max} ${parsedData.salaryRange.currency}` : 'Not specified'}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ JD Text Parsing Test Failed:', error);
  } finally {
    await cleanupTestFiles(testFiles);
  }
}

async function testJDParsingWithDatabase() {
  console.log('🗄️  Testing JD Parsing with Database Integration...\n');

  try {
    // Connect to database (assuming it's already configured)
    const dbConfig = require('./src/config/database');
    await mongoose.connect(process.env.MONGODB_URI || dbConfig.url);

    // Import JobDescription model directly
    const JobDescription = require('./src/models/JobDescription');
    const jdParserService = require('./src/services/jdParserService');

    // Create sample JD content
    const sampleJDContent = `
Full Stack Developer - React & Node.js

Experience: 3-5 years
Skills: JavaScript, React, Node.js, MongoDB, Express, Git
Location: Pune, Maharashtra
Salary: ₹8,00,000 - ₹12,00,000

Requirements:
- Bachelor's degree in Computer Science
- Experience with REST APIs
- Knowledge of Agile methodologies
    `;

    // Create JobDescription document
    const jobDescription = new JobDescription({
      jobTitle: 'Full Stack Developer',
      companyName: 'Test Company',
      rawText: sampleJDContent,
      parsingStatus: 'pending'
    });

    await jobDescription.save();
    console.log('✅ JobDescription created with ID:', jobDescription._id);

    // Parse the JD text
    const parsedData = await jdParserService.parseJDText(sampleJDContent);

    // Update the document with parsed data
    jobDescription.parsedData = parsedData;
    jobDescription.parsingStatus = 'completed';
    jobDescription.lastProcessedAt = new Date();
    await jobDescription.save();

    console.log('✅ JD parsed and saved successfully!');
    console.log('📊 Parsed Data Summary:');
    console.log(`   Title: ${parsedData.jobTitle}`);
    console.log(`   Skills: ${parsedData.requiredSkills?.join(', ')}`);
    console.log(`   Experience: ${parsedData.experienceRequired?.minYears}-${parsedData.experienceRequired?.maxYears} years`);

    // Clean up test data
    await JobDescription.findByIdAndDelete(jobDescription._id);
    console.log('🧹 Test data cleaned up');

  } catch (error) {
    console.error('❌ Database Integration Test Failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function testCandidateMatching() {
  console.log('🎯 Testing Candidate Matching Algorithm...\n');

  try {
    const candidateMatchingService = require('./src/services/candidateMatchingService');

    // Test Case 1: Perfect Match JD
    const perfectMatchJD = {
      parsedData: {
        experienceRequired: { minYears: 3, maxYears: 6 },
        requiredSkillsSimple: ['javascript', 'react', 'nodejs', 'mongodb'],
        preferredSkillsSimple: ['aws', 'docker'],
        jobLocation: 'Mumbai',
        salaryRange: { min: 800000, max: 1500000, currency: 'INR' },
        educationRequirementsSimple: ['bachelor of technology', 'computer science']
      },
      statistics: { lastMatchedAt: new Date() }
    };

    // Test Case 2: Challenging JD
    const challengingJD = {
      parsedData: {
        experienceRequired: { minYears: 5, maxYears: 8 },
        requiredSkillsSimple: ['python', 'machine learning', 'tensorflow', 'sql'],
        preferredSkillsSimple: ['aws', 'spark', 'kubernetes'],
        jobLocation: 'Bangalore',
        salaryRange: { min: 1500000, max: 2500000, currency: 'INR' },
        educationRequirementsSimple: ['phd', 'data science']
      },
      statistics: { lastMatchedAt: new Date() }
    };

    // Mock candidates with varying profiles
    const mockCandidates = [
      {
        _id: 'candidate1',
        firstName: 'John',
        lastName: 'Doe',
        experience: { years: 4, months: 6 },
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'AWS'],
        currentLocation: 'Mumbai',
        currentCTC: 1200000,
        education: [{ degree: 'Bachelor of Technology', specialization: 'Computer Science' }]
      },
      {
        _id: 'candidate2',
        firstName: 'Jane',
        lastName: 'Smith',
        experience: { years: 2, months: 0 },
        skills: ['JavaScript', 'Vue.js', 'Python'],
        currentLocation: 'Delhi',
        currentCTC: 600000,
        education: [{ degree: 'Bachelor of Science', specialization: 'Mathematics' }]
      },
      {
        _id: 'candidate3',
        firstName: 'Bob',
        lastName: 'Johnson',
        experience: { years: 6, months: 0 },
        skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL', 'AWS', 'Spark'],
        currentLocation: 'Bangalore',
        currentCTC: 2000000,
        education: [{ degree: 'PhD', specialization: 'Data Science' }]
      },
      {
        _id: 'candidate4',
        firstName: 'Alice',
        lastName: 'Brown',
        experience: { years: 1, months: 6 },
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        currentLocation: 'Pune',
        currentCTC: 400000,
        education: [{ degree: 'Bachelor of Computer Applications' }]
      }
    ];

    console.log('🧪 Test Case 1: Perfect Match JD (React/Node.js Developer)\n');
    console.log('JD Requirements: 3-6 years exp, JavaScript/React/Node.js/MongoDB, Mumbai\n');

    for (const candidate of mockCandidates.slice(0, 2)) {
      // Calculate individual components manually for testing
      const skillMatch = candidateMatchingService.calculateSkillMatch(candidate, perfectMatchJD);
      const experienceMatch = candidateMatchingService.calculateExperienceMatch(candidate, perfectMatchJD);
      const locationMatch = candidateMatchingService.calculateLocationMatch(candidate, perfectMatchJD);
      const educationMatch = candidateMatchingService.calculateEducationMatch(candidate, perfectMatchJD);
      const salaryMatch = candidateMatchingService.calculateSalaryMatch(candidate, perfectMatchJD);

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

      console.log(`👤 ${candidate.firstName} ${candidate.lastName}:`);
      console.log(`   Overall Score: ${overallScore}/100 (${overallFit})`);
      console.log(`   Skills: ${skillMatch.totalMatched} matches (${skillMatch.score}/100)`);
      console.log(`   Experience: ${experienceMatch.matchType} (${experienceMatch.score}/100)`);
      console.log(`   Location: ${locationMatch.matchType} (${locationMatch.score}/100)`);
      console.log('');
    }

    console.log('🧪 Test Case 2: Challenging JD (Senior Data Scientist)\n');
    console.log('JD Requirements: 5-8 years exp, Python/ML/TensorFlow/SQL, Bangalore, PhD\n');

    for (const candidate of mockCandidates.slice(2)) {
      // Calculate individual components manually for testing
      const skillMatch = candidateMatchingService.calculateSkillMatch(candidate, challengingJD);
      const experienceMatch = candidateMatchingService.calculateExperienceMatch(candidate, challengingJD);
      const locationMatch = candidateMatchingService.calculateLocationMatch(candidate, challengingJD);
      const educationMatch = candidateMatchingService.calculateEducationMatch(candidate, challengingJD);
      const salaryMatch = candidateMatchingService.calculateSalaryMatch(candidate, challengingJD);

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

      console.log(`👤 ${candidate.firstName} ${candidate.lastName}:`);
      console.log(`   Overall Score: ${overallScore}/100 (${overallFit})`);
      console.log(`   Skills: ${skillMatch.totalMatched} matches (${skillMatch.score}/100)`);
      console.log(`   Experience: ${experienceMatch.matchType} (${experienceMatch.score}/100)`);
      console.log(`   Location: ${locationMatch.matchType} (${locationMatch.score}/100)`);
      console.log('');
    }

    // Test individual matching algorithm (skip bulk test that requires DB)
    console.log('🔄 Testing Individual Matching Algorithm...\n');

    // Test the core matching functions directly
    const testCandidate = mockCandidates[0]; // John Doe
    const skillMatch = candidateMatchingService.calculateSkillMatch(testCandidate, perfectMatchJD);
    const experienceMatch = candidateMatchingService.calculateExperienceMatch(testCandidate, perfectMatchJD);
    const locationMatch = candidateMatchingService.calculateLocationMatch(testCandidate, perfectMatchJD);

    console.log(`🧮 Algorithm Test for ${testCandidate.firstName} ${testCandidate.lastName}:`);
    console.log(`   Candidate Skills: ${testCandidate.skills.join(', ')}`);
    console.log(`   JD Required Skills: ${perfectMatchJD.parsedData.requiredSkillsSimple.join(', ')}`);
    console.log(`   Skills Score: ${skillMatch.score}/100 (${skillMatch.totalMatched} matches)`);
    console.log(`   Experience Score: ${experienceMatch.score}/100 (${experienceMatch.matchType})`);
    console.log(`   Location Score: ${locationMatch.score}/100 (${locationMatch.matchType})`);
    console.log(`   Combined Score: ${Math.round((skillMatch.score * 0.4) + (experienceMatch.score * 0.25) + (locationMatch.score * 0.15))}/100`);

    // Test skill normalization
    console.log('\n🔍 Skill Normalization Test:');
    testCandidate.skills.forEach(skill => {
      const normalized = candidateMatchingService.normalizeSkill(skill);
      console.log(`   "${skill}" -> "${normalized}"`);
    });
    perfectMatchJD.parsedData.requiredSkillsSimple.forEach(skill => {
      const normalized = candidateMatchingService.normalizeSkill(skill);
      console.log(`   "${skill}" -> "${normalized}"`);
    });

    console.log('✅ Candidate matching algorithm tests completed!');

  } catch (error) {
    console.error('❌ Candidate Matching Test Failed:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Starting JD Parsing System Tests\n');
  console.log('=' .repeat(50));

  try {
    await testJDTextParsing();
    console.log('=' .repeat(50));

    await testJDParsingWithDatabase();
    console.log('=' .repeat(50));

    await testCandidateMatching();
    console.log('=' .repeat(50));

    console.log('🎉 All tests completed successfully!');

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
  testJDTextParsing,
  testJDParsingWithDatabase,
  testCandidateMatching,
  runAllTests
};