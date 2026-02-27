const mongoose = require('mongoose');
const { getTenantModel } = require('../src/utils/tenantModels');
const { connectToTenant } = require('../src/utils/tenantConnection');

/**
 * Script to fix onboarding records that are missing departments
 * This script will:
 * 1. Find all onboarding records without departments
 * 2. Try to get department from associated job posting
 * 3. If not available, assign default department
 * 4. Log all changes made
 */

async function fixOnboardingDepartments() {
  try {
    console.log('🔧 Starting onboarding department fix script...');
    
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
      onboardingsFixed: 0,
      fromJobPosting: 0,
      fromDefault: 0,
      errors: []
    };
    
    for (const company of companies) {
      try {
        console.log(`\n🏢 Processing company: ${company.name} (${company.dbName})`);
        
        // Connect to tenant database
        const tenantConnection = await connectToTenant(company.dbName);
        
        // Get tenant models
        const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
        const JobPosting = getTenantModel(tenantConnection, 'JobPosting');
        const Department = getTenantModel(tenantConnection, 'Department');
        
        if (!Onboarding || !Department) {
          console.log(`⚠️ Skipping ${company.name} - models not available`);
          continue;
        }
        
        // Find onboarding records without departments
        const onboardingsWithoutDept = await Onboarding.find({
          $or: [
            { department: { $exists: false } },
            { department: null },
            { department: '' }
          ]
        }).populate('jobId');
        
        console.log(`   📊 Found ${onboardingsWithoutDept.length} onboarding records without departments`);
        
        if (onboardingsWithoutDept.length === 0) {
          console.log(`   ✅ No onboarding records need fixing in ${company.name}`);
          results.companiesProcessed++;
          continue;
        }
        
        // Get the first active department as fallback
        const defaultDept = await Department.findOne({ isActive: true }).sort({ createdAt: 1 });
        
        if (!defaultDept) {
          console.log(`   ❌ No active departments found in ${company.name} - cannot fix onboarding records`);
          results.errors.push(`${company.name}: No active departments available`);
          continue;
        }
        
        console.log(`   🎯 Default department available: ${defaultDept.name} (${defaultDept._id})`);
        
        let fixedCount = 0;
        let fromJobCount = 0;
        let fromDefaultCount = 0;
        
        for (const onboarding of onboardingsWithoutDept) {
          let departmentId = null;
          let source = '';
          
          // Try to get department from job posting first
          if (onboarding.jobId && JobPosting) {
            try {
              const job = await JobPosting.findById(onboarding.jobId).populate('department');
              if (job && job.department) {
                departmentId = job.department._id;
                source = `job posting (${job.department.name})`;
                fromJobCount++;
              }
            } catch (jobError) {
              console.warn(`     ⚠️ Could not fetch job posting for onboarding ${onboarding._id}:`, jobError.message);
            }
          }
          
          // If no department from job posting, use default
          if (!departmentId) {
            departmentId = defaultDept._id;
            source = `default department (${defaultDept.name})`;
            fromDefaultCount++;
          }
          
          // Update the onboarding record
          try {
            await Onboarding.findByIdAndUpdate(onboarding._id, {
              department: departmentId
            });
            
            console.log(`     ✅ Fixed onboarding ${onboarding._id} (${onboarding.candidateName}) - assigned from ${source}`);
            fixedCount++;
          } catch (updateError) {
            console.error(`     ❌ Failed to update onboarding ${onboarding._id}:`, updateError.message);
            results.errors.push(`${company.name} - Onboarding ${onboarding._id}: ${updateError.message}`);
          }
        }
        
        console.log(`   ✅ Fixed ${fixedCount} onboarding records in ${company.name}`);
        console.log(`     - From job postings: ${fromJobCount}`);
        console.log(`     - From default dept: ${fromDefaultCount}`);
        
        results.onboardingsFixed += fixedCount;
        results.fromJobPosting += fromJobCount;
        results.fromDefault += fromDefaultCount;
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
    console.log(`   Onboarding records fixed: ${results.onboardingsFixed}`);
    console.log(`   - Fixed from job postings: ${results.fromJobPosting}`);
    console.log(`   - Fixed with default dept: ${results.fromDefault}`);
    
    if (results.errors.length > 0) {
      console.log(`   Errors encountered: ${results.errors.length}`);
      results.errors.forEach(error => console.log(`     - ${error}`));
    }
    
    console.log('\n✅ Onboarding department fix script completed!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the script if called directly
if (require.main === module) {
  fixOnboardingDepartments();
}

module.exports = { fixOnboardingDepartments };
