/**
 * Seed 30 Job Applicants for SDE Intern Position
 * Job ID: 691e363f75f473d1b479cd6e
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Use existing Candidate model
const Candidate = require('../models/Candidate');

const seedApplicants = async () => {
  try {
    console.log('🌱 Starting Job Applicants Seeding...\n');

    // Connect to database
    await connectDB();

    const companyId = '691e237d4f4469770021830f'; // TCS Company ID
    const jobId = '691e363f75f473d1b479cd6e'; // SDE Intern Job ID
    const dbName = `tenant_${companyId}`;

    // Connect to tenant database
    const tenantConnection = mongoose.createConnection(
      `${process.env.MONGODB_URI.split('?')[0].replace('/hrms', '')}/${dbName}?retryWrites=true&w=majority`
    );

    await new Promise((resolve, reject) => {
      tenantConnection.once('open', resolve);
      tenantConnection.once('error', reject);
    });

    console.log(`✅ Using Candidate model\n`);

    // Sample data arrays
    const firstNames = [
      'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Arjun', 'Pooja',
      'Rohan', 'Neha', 'Karan', 'Divya', 'Aditya', 'Riya', 'Sanjay', 'Kavya',
      'Nikhil', 'Shreya', 'Varun', 'Meera', 'Akash', 'Tanvi', 'Harsh', 'Ishita',
      'Manish', 'Ananya', 'Gaurav', 'Sakshi', 'Vishal', 'Nidhi'
    ];

    const lastNames = [
      'Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Joshi',
      'Mehta', 'Rao', 'Desai', 'Nair', 'Iyer', 'Pillai', 'Agarwal', 'Bansal',
      'Chopra', 'Malhotra', 'Kapoor', 'Bhatia', 'Khanna', 'Sethi', 'Saxena', 'Jain',
      'Shah', 'Thakur', 'Pandey', 'Mishra', 'Tiwari', 'Dubey'
    ];

    const colleges = [
      'IIT Delhi', 'IIT Bombay', 'IIT Madras', 'IIT Kanpur', 'BITS Pilani',
      'NIT Trichy', 'NIT Warangal', 'IIIT Hyderabad', 'VIT Vellore', 'SRM University',
      'Manipal Institute', 'PES University', 'PESIT', 'RV College', 'BMS College',
      'Delhi University', 'Mumbai University', 'Pune University', 'Anna University', 'Jadavpur University'
    ];

    const degrees = [
      'B.Tech in Computer Science',
      'B.E in Information Technology',
      'B.Tech in Software Engineering',
      'B.Sc in Computer Science',
      'BCA',
      'B.Tech in Electronics and Communication'
    ];

    const skills = [
      ['JavaScript', 'React', 'Node.js', 'MongoDB', 'HTML', 'CSS'],
      ['Python', 'Django', 'Flask', 'PostgreSQL', 'REST APIs'],
      ['Java', 'Spring Boot', 'MySQL', 'Hibernate', 'Maven'],
      ['C++', 'Data Structures', 'Algorithms', 'Problem Solving'],
      ['JavaScript', 'TypeScript', 'Angular', 'Express.js', 'Git'],
      ['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'NumPy'],
      ['React Native', 'Flutter', 'Mobile Development', 'Firebase'],
      ['HTML', 'CSS', 'JavaScript', 'Bootstrap', 'Tailwind CSS'],
      ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'GraphQL'],
      ['Java', 'Android Development', 'Kotlin', 'SQLite']
    ];

    const statuses = ['applied', 'applied', 'applied', 'screening', 'screening', 'interview'];

    const coverLetters = [
      'I am excited to apply for the SDE Intern position. With strong programming skills and passion for technology, I am eager to contribute to your team.',
      'As a recent graduate with hands-on experience in web development, I am enthusiastic about this internship opportunity.',
      'I have been following your company and am impressed by your innovative projects. I would love to be part of your team.',
      'My academic projects and coding competitions have prepared me well for this role. I am ready to learn and grow.',
      'I am passionate about software development and eager to apply my skills in a real-world environment.',
      'With strong fundamentals in data structures and algorithms, I am confident I can contribute effectively to your team.'
    ];

    // Generate 30 applicants
    const applicants = [];
    
    for (let i = 0; i < 30; i++) {
      const firstName = firstNames[i];
      const lastName = lastNames[i];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`;
      const phone = `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      const experience = Math.floor(Math.random() * 3); // 0-2 years
      const skillSet = skills[Math.floor(Math.random() * skills.length)];
      const college = colleges[Math.floor(Math.random() * colleges.length)];
      const degree = degrees[Math.floor(Math.random() * degrees.length)];
      const year = 2024 - Math.floor(Math.random() * 2); // 2024 or 2023
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const coverLetter = coverLetters[Math.floor(Math.random() * coverLetters.length)];

      const candidateCode = `CAN${Date.now()}${i}`;
      
      const applicant = {
        candidateCode,
        firstName,
        lastName,
        email,
        phone,
        appliedFor: new mongoose.Types.ObjectId(jobId),
        source: 'job-portal',
        experience: {
          years: experience,
          months: Math.floor(Math.random() * 12)
        },
        currentCompany: experience > 0 ? ['Startup', 'Tech Company', 'IT Services'][Math.floor(Math.random() * 3)] : undefined,
        currentDesignation: experience > 0 ? ['Junior Developer', 'Intern', 'Trainee'][Math.floor(Math.random() * 3)] : undefined,
        currentCTC: experience > 0 ? Math.floor(Math.random() * 500000) + 300000 : undefined,
        expectedCTC: Math.floor(Math.random() * 800000) + 400000,
        noticePeriod: experience > 0 ? [0, 15, 30, 60][Math.floor(Math.random() * 4)] : 0,
        skills: skillSet,
        education: [{
          degree,
          institution: college,
          passingYear: year,
          percentage: Math.floor(Math.random() * 20) + 70 // 70-90%
        }],
        resume: {
          url: `resumes/${firstName}_${lastName}_Resume.pdf`,
          filename: `${firstName}_${lastName}_Resume.pdf`,
          originalName: `${firstName}_${lastName}_Resume.pdf`,
          uploadedAt: new Date()
        },
        stage: status === 'applied' ? 'applied' : status === 'screening' ? 'screening' : 'interview-scheduled',
        appliedDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Last 30 days
        notes: status === 'screening' ? 'Resume shortlisted for review' : status === 'interview' ? 'Scheduled for technical interview' : undefined
      };

      applicants.push(applicant);
    }

    // Insert all applicants
    const result = await Candidate.insertMany(applicants);
    
    console.log(`✅ Successfully seeded ${result.length} applicants for SDE Intern position\n`);

    // Display summary
    console.log('📊 Applicants Summary:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const stageCount = {};
    applicants.forEach(app => {
      stageCount[app.stage] = (stageCount[app.stage] || 0) + 1;
    });

    Object.entries(stageCount).forEach(([stage, count]) => {
      console.log(`   ${stage.toUpperCase()}: ${count} candidates`);
    });

    console.log('\n📋 Sample Applicants:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    applicants.slice(0, 5).forEach((app, idx) => {
      console.log(`${idx + 1}. ${app.firstName} ${app.lastName}`);
      console.log(`   Email: ${app.email}`);
      console.log(`   Education: ${app.education[0].degree} - ${app.education[0].institution}`);
      console.log(`   Experience: ${app.experience.years} year(s) ${app.experience.months} month(s)`);
      console.log(`   Skills: ${app.skills.join(', ')}`);
      console.log(`   Stage: ${app.stage}`);
      console.log(`   Expected CTC: ₹${app.expectedCTC.toLocaleString()}`);
      console.log('');
    });

    console.log('\n✅ Seeding completed successfully!\n');

    // Close connection
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding applicants:', error);
    process.exit(1);
  }
};

// Run the seed
seedApplicants();
