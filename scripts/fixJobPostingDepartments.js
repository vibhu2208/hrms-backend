const mongoose = require('mongoose');
const { getTenantModel } = require('../src/utils/tenantModels');
const { connectToTenant } = require('../src/utils/tenantConnection');

/**
 * Script to fix job postings that are missing departments
 * This script will:
 * 1. Find all job postings without departments
 * 2. Assign them to the first available active department
 * 3. Log all changes made
 */

async function fixJobPostingDepartments() {
  try {
    console.log('🔧 Starting job posting department fix script...');
    
    // Connect to main database to get tenant list
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_main');
    
    const Company = mongoose.model('Company', new mongoose.Schema({
      name: String,
      dbName: String,
      isActive: { type: Boolean, default: true }
    }));
    
    const companies = await Company.find({ isActive: true });
    console.log(`📋 Found ${companies.length} active companies to process`);
    
    const results = {
      totalCompanies: companies.length,
      companiesProcessed: 0,
      jobsFixed: 0,
      errors: []
    };
    
    for (const company of companies) {
      try {
        console.log(`\n🏢 Processing company: ${company.name} (${company.dbName})`);
        
        // Connect to tenant database
        const tenantConnection = await connectToTenant(company.dbName);
        
        // Get tenant models
        const JobPosting = getTenantModel(tenantConnection, 'JobPosting');
        const Department = getTenantModel(tenantConnection, 'Department');
        
        if (!JobPosting || !Department) {
          console.log(`⚠️ Skipping ${company.name} - models not available`);
          continue;
        }
        
        // Find job postings without departments
        const jobsWithoutDept = await JobPosting.find({
          $or: [
            { department: { $exists: false } },
            { department: null },
            { department: '' }
          ]
        });
        
        console.log(`   📊 Found ${jobsWithoutDept.length} job postings without departments`);
        
        if (jobsWithoutDept.length === 0) {
          console.log(`   ✅ No job postings need fixing in ${company.name}`);
          results.companiesProcessed++;
          continue;
        }
        
        // Get the first active department as default
        const defaultDept = await Department.findOne({ isActive: true }).sort({ createdAt: 1 });
        
        if (!defaultDept) {
          console.log(`   ❌ No active departments found in ${company.name} - cannot fix job postings`);
          results.errors.push(`${company.name}: No active departments available`);
          continue;
        }
        
        console.log(`   🎯 Using default department: ${defaultDept.name} (${defaultDept._id})`);
        
        // Update all job postings without departments
        const updateResult = await JobPosting.updateMany(
          {
            $or: [
              { department: { $exists: false } },
              { department: null },
              { department: '' }
            ]
          },
          {
            $set: { department: defaultDept._id }
          }
        );
        
        console.log(`   ✅ Fixed ${updateResult.modifiedCount} job postings in ${company.name}`);
        results.jobsFixed += updateResult.modifiedCount;
        results.companiesProcessed++;
        
        // Close tenant connection
        await tenantConnection.close();
        
      } catch (companyError) {
        console.error(`   ❌ Error processing company ${company.name}:`, companyError.message);
        results.errors.push(`${company.name}: ${companyError.message}`);
      }
    }
    
    // Print summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Companies processed: ${results.companiesProcessed}/${results.totalCompanies}`);
    console.log(`   Job postings fixed: ${results.jobsFixed}`);
    
    if (results.errors.length > 0) {
      console.log(`   Errors encountered: ${results.errors.length}`);
      results.errors.forEach(error => console.log(`     - ${error}`));
    }
    
    console.log('\n✅ Job posting department fix script completed!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the script if called directly
if (require.main === module) {
  fixJobPostingDepartments();
}

module.exports = { fixJobPostingDepartments };
