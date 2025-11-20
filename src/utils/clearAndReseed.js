require('dotenv').config();
const mongoose = require('mongoose');

const tenantId = '691e237d4f4469770021830f';
const jobId = '691e363f75f473d1b479cd6e';

// Sample data - 30 candidates
const applicantsData = [
  { firstName: 'Rahul', lastName: 'Sharma', location: 'Mumbai', company: 'TCS', designation: 'Software Engineer', exp: { years: 3, months: 6 }, skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'] },
  { firstName: 'Priya', lastName: 'Patel', location: 'Delhi', company: 'Infosys', designation: 'Senior Developer', exp: { years: 5, months: 2 }, skills: ['Python', 'Django', 'PostgreSQL', 'REST API'] },
  { firstName: 'Amit', lastName: 'Kumar', location: 'Bangalore', company: 'Wipro', designation: 'Full Stack Developer', exp: { years: 4, months: 8 }, skills: ['Java', 'Spring Boot', 'MySQL', 'AWS'] },
  { firstName: 'Sneha', lastName: 'Singh', location: 'Hyderabad', company: 'Cognizant', designation: 'Backend Developer', exp: { years: 2, months: 10 }, skills: ['Node.js', 'Express', 'MongoDB', 'Docker'] },
  { firstName: 'Vikram', lastName: 'Reddy', location: 'Chennai', company: 'Tech Mahindra', designation: 'Frontend Developer', exp: { years: 3, months: 4 }, skills: ['Angular', 'TypeScript', 'RxJS', 'Material UI'] },
  { firstName: 'Anjali', lastName: 'Gupta', location: 'Pune', company: 'HCL', designation: 'DevOps Engineer', exp: { years: 4, months: 0 }, skills: ['Jenkins', 'Kubernetes', 'Docker', 'AWS'] },
  { firstName: 'Rohan', lastName: 'Verma', location: 'Kolkata', company: 'Accenture', designation: 'QA Engineer', exp: { years: 2, months: 6 }, skills: ['Selenium', 'Java', 'TestNG', 'Automation'] },
  { firstName: 'Kavya', lastName: 'Mehta', location: 'Ahmedabad', company: 'Capgemini', designation: 'Data Analyst', exp: { years: 1, months: 8 }, skills: ['Python', 'SQL', 'Tableau', 'Excel'] },
  { firstName: 'Arjun', lastName: 'Joshi', location: 'Jaipur', company: 'IBM', designation: 'System Engineer', exp: { years: 2, months: 3 }, skills: ['Linux', 'Networking', 'Cloud', 'Security'] },
  { firstName: 'Meera', lastName: 'Nair', location: 'Noida', company: 'Oracle', designation: 'Technical Lead', exp: { years: 6, months: 5 }, skills: ['Java', 'Microservices', 'Spring', 'Kafka'] },
  { firstName: 'Karan', lastName: 'Rao', location: 'Mumbai', company: 'Startup', designation: 'Trainee', exp: { years: 0, months: 0 }, skills: ['JavaScript', 'HTML', 'CSS', 'React'] },
  { firstName: 'Pooja', lastName: 'Desai', location: 'Bangalore', company: 'Flipkart', designation: 'Software Developer', exp: { years: 3, months: 0 }, skills: ['React', 'Redux', 'Node.js', 'GraphQL'] },
  { firstName: 'Siddharth', lastName: 'Iyer', location: 'Delhi', company: 'Amazon', designation: 'SDE-2', exp: { years: 4, months: 6 }, skills: ['Java', 'AWS', 'DynamoDB', 'Lambda'] },
  { firstName: 'Neha', lastName: 'Malhotra', location: 'Hyderabad', company: 'Microsoft', designation: 'Software Engineer', exp: { years: 3, months: 9 }, skills: ['C#', '.NET', 'Azure', 'SQL Server'] },
  { firstName: 'Aditya', lastName: 'Chopra', location: 'Chennai', company: 'Google', designation: 'Frontend Engineer', exp: { years: 5, months: 1 }, skills: ['React', 'TypeScript', 'Next.js', 'TailwindCSS'] },
  { firstName: 'Riya', lastName: 'Kapoor', location: 'Pune', company: 'Startup', designation: 'Trainee', exp: { years: 0, months: 6 }, skills: ['Python', 'Flask', 'SQL', 'Git'] },
  { firstName: 'Varun', lastName: 'Agarwal', location: 'Kolkata', company: 'Paytm', designation: 'Backend Developer', exp: { years: 2, months: 8 }, skills: ['Node.js', 'MongoDB', 'Redis', 'Microservices'] },
  { firstName: 'Divya', lastName: 'Bose', location: 'Bangalore', company: 'Swiggy', designation: 'Full Stack Developer', exp: { years: 3, months: 3 }, skills: ['React', 'Node.js', 'PostgreSQL', 'Docker'] },
  { firstName: 'Nikhil', lastName: 'Sinha', location: 'Mumbai', company: 'Zomato', designation: 'Mobile Developer', exp: { years: 4, months: 2 }, skills: ['React Native', 'JavaScript', 'Redux', 'Firebase'] },
  { firstName: 'Shreya', lastName: 'Pillai', location: 'Delhi', company: 'Ola', designation: 'Data Engineer', exp: { years: 3, months: 7 }, skills: ['Python', 'Spark', 'Hadoop', 'Airflow'] },
  { firstName: 'Manish', lastName: 'Thakur', location: 'Bangalore', company: 'Adobe', designation: 'UI/UX Developer', exp: { years: 4, months: 4 }, skills: ['Figma', 'React', 'CSS', 'JavaScript'] },
  { firstName: 'Ananya', lastName: 'Krishnan', location: 'Hyderabad', company: 'Salesforce', designation: 'Cloud Engineer', exp: { years: 3, months: 2 }, skills: ['AWS', 'Terraform', 'Python', 'CI/CD'] },
  { firstName: 'Rajesh', lastName: 'Pandey', location: 'Mumbai', company: 'HDFC Bank', designation: 'Software Developer', exp: { years: 5, months: 8 }, skills: ['Java', 'Spring', 'Oracle', 'Microservices'] },
  { firstName: 'Tanvi', lastName: 'Shah', location: 'Pune', company: 'Startup', designation: 'Trainee', exp: { years: 0, months: 3 }, skills: ['HTML', 'CSS', 'JavaScript', 'Bootstrap'] },
  { firstName: 'Suresh', lastName: 'Menon', location: 'Chennai', company: 'Cognizant', designation: 'Business Analyst', exp: { years: 4, months: 1 }, skills: ['SQL', 'Tableau', 'Excel', 'Agile'] },
  { firstName: 'Ishita', lastName: 'Banerjee', location: 'Kolkata', company: 'TCS', designation: 'QA Automation Engineer', exp: { years: 2, months: 9 }, skills: ['Selenium', 'Python', 'Jenkins', 'API Testing'] },
  { firstName: 'Gaurav', lastName: 'Saxena', location: 'Noida', company: 'PhonePe', designation: 'Backend Engineer', exp: { years: 3, months: 11 }, skills: ['Go', 'Kafka', 'Redis', 'PostgreSQL'] },
  { firstName: 'Nisha', lastName: 'Reddy', location: 'Bangalore', company: 'Uber', designation: 'Data Scientist', exp: { years: 4, months: 5 }, skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL'] },
  { firstName: 'Deepak', lastName: 'Mishra', location: 'Delhi', company: 'Snapdeal', designation: 'Full Stack Developer', exp: { years: 2, months: 4 }, skills: ['Vue.js', 'Node.js', 'MySQL', 'Docker'] },
  { firstName: 'Sonal', lastName: 'Jain', location: 'Jaipur', company: 'Startup', designation: 'Trainee', exp: { years: 0, months: 8 }, skills: ['React', 'JavaScript', 'Git', 'REST API'] }
];

const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const clearAndReseed = async () => {
  let tenantConnection;
  try {
    const dbName = `tenant_${tenantId}`;
    const mongoUri = process.env.MONGODB_URI.replace(/\/[^\/]*$/, `/${dbName}`);
    
    console.log(`🔗 Connecting to tenant database: ${dbName}\n`);
    
    tenantConnection = await mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to tenant MongoDB\n');

    // Define schema matching your database structure
    const candidateSchema = new mongoose.Schema({
      jobId: mongoose.Schema.Types.ObjectId,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      resume: String,
      coverLetter: String,
      experience: Number,
      currentCompany: String,
      currentPosition: String,
      skills: [String],
      education: {
        degree: String,
        institution: String,
        year: Number
      },
      status: String,
      appliedDate: Date,
      notes: String
    }, { timestamps: true });

    const TenantCandidate = tenantConnection.model('Candidate', candidateSchema);

    // Clear existing candidates for this job
    const deleteResult = await TenantCandidate.deleteMany({ 
      $or: [
        { jobId: jobId },
        { appliedFor: jobId }
      ]
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing candidates\n`);

    // Create new candidates matching your database structure
    const candidates = applicantsData.map((data, index) => ({
      appliedFor: new mongoose.Types.ObjectId(jobId),
      firstName: data.firstName,
      lastName: data.lastName,
      email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@gmail.com`,
      phone: `+91 ${4813757996 + index}`,
      resume: `resumes/${data.firstName}_${data.lastName}_Resume.pdf`,
      coverLetter: `With strong fundamentals in data structures and algorithms, I am confident in my ability to contribute effectively.`,
      experience: data.exp.years,
      currentCompany: data.company,
      currentPosition: data.designation,
      skills: data.skills,
      education: {
        degree: 'B.Sc in Computer Science',
        institution: `${data.location} University`,
        year: 2024 - data.exp.years
      },
      status: 'applied',
      appliedDate: new Date(Date.now() - getRandomNumber(1, 30) * 24 * 60 * 60 * 1000),
      notes: null
    }));

    // Debug: Check first candidate
    console.log('Sample candidate data:');
    console.log(JSON.stringify(candidates[0], null, 2));
    
    // Insert candidates
    const result = await TenantCandidate.insertMany(candidates);
    console.log(`✅ Added ${result.length} new applicants to tenant database`);

    // Count total applicants for this job
    const totalApplicants = await TenantCandidate.countDocuments({ appliedFor: new mongoose.Types.ObjectId(jobId) });
    console.log(`✅ Total applicants for job ${jobId}: ${totalApplicants}`);

    console.log('\n📊 Summary:');
    console.log(`   Tenant Database: ${dbName}`);
    console.log(`   Job ID: ${jobId}`);
    console.log(`   New Applicants: ${result.length}`);
    console.log(`   Total Applicants: ${totalApplicants}`);
    console.log('\n✅ Seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

clearAndReseed();
