const mongoose = require('mongoose');

async function deepCheckTenant() {
  try {
    const tenantId = '697127c3db7be8a51c1e6b7f';
    const tenantDbName = `tenant_${tenantId}`;
    
    console.log(`🔍 Deep checking tenant database: ${tenantDbName}`);
    
    // Connect to the specific tenant database
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to tenant database: ${tenantDbName}`);

    // Get detailed user information
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({});
    
    console.log(`\n👥 Detailed User Information:`);
    users.forEach(user => {
      console.log(`\n📧 Email: ${user.email}`);
      console.log(`  🆔 ID: ${user._id}`);
      console.log(`  👤 Name: ${user.firstName} ${user.lastName}`);
      console.log(`  🔑 Role: ${user.role}`);
      console.log(`  ✅ Active: ${user.isActive}`);
      console.log(`  📅 Created: ${user.createdAt}`);
      console.log(`  🔄 Updated: ${user.updatedAt}`);
      if (user.employeeId) {
        console.log(`  💼 Employee ID: ${user.employeeId}`);
      }
      if (user.permissions && user.permissions.length > 0) {
        console.log(`  🔐 Permissions: ${user.permissions.join(', ')}`);
      }
    });

    // Check companies collection in this tenant
    try {
      const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
      const companies = await Company.find({});
      
      console.log(`\n🏢 Companies in this tenant:`);
      companies.forEach(company => {
        console.log(`\n  Name: ${company.name || company.companyName}`);
        console.log(`  🆔 ID: ${company._id}`);
        console.log(`  📧 Email: ${company.email}`);
        console.log(`  📞 Phone: ${company.phone}`);
        console.log(`  📅 Created: ${company.createdAt}`);
        console.log(`  🔄 Updated: ${company.updatedAt}`);
      });
    } catch (err) {
      console.log(`\n⚠️ No companies collection or error: ${err.message}`);
    }

    // Check departments
    try {
      const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
      const departments = await Department.find({});
      
      console.log(`\n📁 Departments in this tenant:`);
      departments.forEach(dept => {
        console.log(`  - ${dept.name} (${dept._id})`);
      });
    } catch (err) {
      console.log(`\n⚠️ No departments collection or error: ${err.message}`);
    }

    // Check candidates
    try {
      const Candidate = mongoose.model('Candidate', new mongoose.Schema({}, { strict: false }), 'candidates');
      const candidates = await Candidate.find({});
      
      console.log(`\n🎯 Candidates in this tenant: ${candidates.length} found`);
      if (candidates.length > 0) {
        candidates.slice(0, 3).forEach(candidate => {
          console.log(`  - ${candidate.firstName} ${candidate.lastName} (${candidate.email}) - Status: ${candidate.status || 'N/A'}`);
        });
        if (candidates.length > 3) {
          console.log(`  ... and ${candidates.length - 3} more`);
        }
      }
    } catch (err) {
      console.log(`\n⚠️ No candidates collection or error: ${err.message}`);
    }

    // Check job postings
    try {
      const JobPosting = mongoose.model('JobPosting', new mongoose.Schema({}, { strict: false }), 'jobpostings');
      const jobPostings = await JobPosting.find({});
      
      console.log(`\n💼 Job Postings in this tenant: ${jobPostings.length} found`);
      if (jobPostings.length > 0) {
        jobPostings.slice(0, 3).forEach(job => {
          console.log(`  - ${job.title || job.jobTitle} (${job.status || 'N/A'})`);
        });
        if (jobPostings.length > 3) {
          console.log(`  ... and ${jobPostings.length - 3} more`);
        }
      }
    } catch (err) {
      console.log(`\n⚠️ No jobpostings collection or error: ${err.message}`);
    }

    // Check if this tenant ID matches any company in the main database
    await mongoose.disconnect();
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    try {
      // Check if there's a company with this ID
      const CompanyMain = mongoose.model('CompanyMain', new mongoose.Schema({}, { strict: false }), 'companies');
      const companyWithThisId = await CompanyMain.findById(tenantId);
      
      if (companyWithThisId) {
        console.log(`\n🎯 Found company in main database with this ID:`);
        console.log(`  Name: ${companyWithThisId.name || companyWithThisId.companyName}`);
        console.log(`  Email: ${companyWithThisId.email}`);
        console.log(`  Database: ${companyWithThisId.databaseName}`);
        console.log(`  Status: ${companyWithThisId.status}`);
      } else {
        console.log(`\n❌ No company found in main database with ID: ${tenantId}`);
      }
    } catch (err) {
      console.log(`\n⚠️ Could not check main database companies: ${err.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

deepCheckTenant();
