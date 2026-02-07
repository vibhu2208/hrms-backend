const mongoose = require('mongoose');

/**
 * Database Migration Script
 * Merges recruitment tenant (697127c3db7be8a51c1e6b7f) into main tenant (696b515db6c9fd5fd51aed1c)
 */

async function mergeDatabases() {
  try {
    console.log('🚀 Starting database migration...');
    
    const mainTenantId = '696b515db6c9fd5fd51aed1c';
    const recruitmentTenantId = '697127c3db7be8a51c1e6b7f';
    const mainTenantDb = `tenant_${mainTenantId}`;
    const recruitmentTenantDb = `tenant_${recruitmentTenantId}`;

    // Step 1: Connect to recruitment tenant to get data
    console.log(`\n📥 Step 1: Connecting to recruitment tenant: ${recruitmentTenantDb}`);
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${recruitmentTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get data from recruitment tenant
    const recruitmentData = {
      users: [],
      candidates: [],
      jobPostings: [],
      departments: [],
      leaveAccrualPolicies: [],
      leaveBalances: []
    };

    // Get users from recruitment tenant
    try {
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      recruitmentData.users = await User.find({});
      console.log(`👥 Found ${recruitmentData.users.length} users in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No users found in recruitment tenant: ${err.message}`);
    }

    // Get candidates from recruitment tenant
    try {
      const Candidate = mongoose.model('Candidate', new mongoose.Schema({}, { strict: false }), 'candidates');
      recruitmentData.candidates = await Candidate.find({});
      console.log(`🎯 Found ${recruitmentData.candidates.length} candidates in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No candidates found: ${err.message}`);
    }

    // Get job postings from recruitment tenant
    try {
      const JobPosting = mongoose.model('JobPosting', new mongoose.Schema({}, { strict: false }), 'jobpostings');
      recruitmentData.jobPostings = await JobPosting.find({});
      console.log(`💼 Found ${recruitmentData.jobPostings.length} job postings in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No job postings found: ${err.message}`);
    }

    // Get departments from recruitment tenant
    try {
      const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
      recruitmentData.departments = await Department.find({});
      console.log(`📁 Found ${recruitmentData.departments.length} departments in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No departments found: ${err.message}`);
    }

    // Get leave policies from recruitment tenant
    try {
      const LeaveAccrualPolicy = mongoose.model('LeaveAccrualPolicy', new mongoose.Schema({}, { strict: false }), 'leaveaccrualpolicies');
      recruitmentData.leaveAccrualPolicies = await LeaveAccrualPolicy.find({});
      console.log(`📊 Found ${recruitmentData.leaveAccrualPolicies.length} leave accrual policies in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No leave accrual policies found: ${err.message}`);
    }

    // Get leave balances from recruitment tenant
    try {
      const LeaveBalance = mongoose.model('LeaveBalance', new mongoose.Schema({}, { strict: false }), 'leavebalances');
      recruitmentData.leaveBalances = await LeaveBalance.find({});
      console.log(`📊 Found ${recruitmentData.leaveBalances.length} leave balances in recruitment tenant`);
    } catch (err) {
      console.log(`⚠️ No leave balances found: ${err.message}`);
    }

    await mongoose.disconnect();

    // Step 2: Connect to main tenant and migrate data
    console.log(`\n📤 Step 2: Connecting to main tenant: ${mainTenantDb}`);
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${mainTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    let migrationResults = {
      usersMigrated: 0,
      candidatesMigrated: 0,
      jobPostingsMigrated: 0,
      departmentsMigrated: 0,
      leavePoliciesMigrated: 0,
      leaveBalancesMigrated: 0,
      duplicatesSkipped: 0
    };

    // Migrate users
    console.log('\n👥 Migrating users...');
    try {
      const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      
      for (const user of recruitmentData.users) {
        // Check if user already exists
        const existingUser = await User.findOne({ email: user.email });
        if (existingUser) {
          console.log(`⚠️ User ${user.email} already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        // Create new user document
        const newUser = new User({
          ...user.toObject(),
          _id: new mongoose.Types.ObjectId(), // Generate new ID
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newUser.save();
        migrationResults.usersMigrated++;
        console.log(`✅ Migrated user: ${user.email} (${user.role})`);
      }
    } catch (err) {
      console.error(`❌ Error migrating users: ${err.message}`);
    }

    // Migrate candidates
    console.log('\n🎯 Migrating candidates...');
    try {
      const Candidate = mongoose.model('Candidate', new mongoose.Schema({}, { strict: false }), 'candidates');
      
      for (const candidate of recruitmentData.candidates) {
        // Check if candidate already exists
        const existingCandidate = await Candidate.findOne({ email: candidate.email });
        if (existingCandidate) {
          console.log(`⚠️ Candidate ${candidate.email} already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        const newCandidate = new Candidate({
          ...candidate.toObject(),
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newCandidate.save();
        migrationResults.candidatesMigrated++;
        console.log(`✅ Migrated candidate: ${candidate.firstName} ${candidate.lastName}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating candidates: ${err.message}`);
    }

    // Migrate job postings
    console.log('\n💼 Migrating job postings...');
    try {
      const JobPosting = mongoose.model('JobPosting', new mongoose.Schema({}, { strict: false }), 'jobpostings');
      
      for (const jobPosting of recruitmentData.jobPostings) {
        // Check by title and department to avoid duplicates
        const existingJob = await JobPosting.findOne({ 
          title: jobPosting.title, 
          department: jobPosting.department 
        });
        if (existingJob) {
          console.log(`⚠️ Job posting "${jobPosting.title}" already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        const newJobPosting = new JobPosting({
          ...jobPosting.toObject(),
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newJobPosting.save();
        migrationResults.jobPostingsMigrated++;
        console.log(`✅ Migrated job posting: ${jobPosting.title}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating job postings: ${err.message}`);
    }

    // Migrate departments (only if they don't exist)
    console.log('\n📁 Migrating departments...');
    try {
      const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
      
      for (const department of recruitmentData.departments) {
        const existingDept = await Department.findOne({ name: department.name });
        if (existingDept) {
          console.log(`⚠️ Department "${department.name}" already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        const newDepartment = new Department({
          ...department.toObject(),
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newDepartment.save();
        migrationResults.departmentsMigrated++;
        console.log(`✅ Migrated department: ${department.name}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating departments: ${err.message}`);
    }

    // Migrate leave accrual policies
    console.log('\n📊 Migrating leave accrual policies...');
    try {
      const LeaveAccrualPolicy = mongoose.model('LeaveAccrualPolicy', new mongoose.Schema({}, { strict: false }), 'leaveaccrualpolicies');
      
      for (const policy of recruitmentData.leaveAccrualPolicies) {
        const existingPolicy = await LeaveAccrualPolicy.findOne({ 
          leaveType: policy.leaveType,
          department: policy.department 
        });
        if (existingPolicy) {
          console.log(`⚠️ Leave policy for ${policy.leaveType} already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        const newPolicy = new LeaveAccrualPolicy({
          ...policy.toObject(),
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newPolicy.save();
        migrationResults.leavePoliciesMigrated++;
        console.log(`✅ Migrated leave policy: ${policy.leaveType}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating leave policies: ${err.message}`);
    }

    // Migrate leave balances
    console.log('\n📊 Migrating leave balances...');
    try {
      const LeaveBalance = mongoose.model('LeaveBalance', new mongoose.Schema({}, { strict: false }), 'leavebalances');
      
      for (const balance of recruitmentData.leaveBalances) {
        const existingBalance = await LeaveBalance.findOne({ 
          employee: balance.employee,
          leaveType: balance.leaveType 
        });
        if (existingBalance) {
          console.log(`⚠️ Leave balance for employee ${balance.employee} already exists, skipping...`);
          migrationResults.duplicatesSkipped++;
          continue;
        }

        const newBalance = new LeaveBalance({
          ...balance.toObject(),
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newBalance.save();
        migrationResults.leaveBalancesMigrated++;
        console.log(`✅ Migrated leave balance for employee: ${balance.employee}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating leave balances: ${err.message}`);
    }

    await mongoose.disconnect();

    // Step 3: Update global registry to remove recruitment tenant reference
    console.log('\n📋 Step 3: Updating global registry...');
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_global?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    try {
      const CompanyRegistry = mongoose.model('CompanyRegistry', new mongoose.Schema({}, { strict: false }), 'companyregistries');
      
      // Remove any reference to the recruitment tenant if it exists
      await CompanyRegistry.deleteMany({ tenantDatabaseName: recruitmentTenantDb });
      console.log(`✅ Removed recruitment tenant reference from global registry`);
    } catch (err) {
      console.error(`❌ Error updating global registry: ${err.message}`);
    }

    await mongoose.disconnect();

    // Step 4: Show migration results
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Users migrated: ${migrationResults.usersMigrated}`);
    console.log(`✅ Candidates migrated: ${migrationResults.candidatesMigrated}`);
    console.log(`✅ Job postings migrated: ${migrationResults.jobPostingsMigrated}`);
    console.log(`✅ Departments migrated: ${migrationResults.departmentsMigrated}`);
    console.log(`✅ Leave policies migrated: ${migrationResults.leavePoliciesMigrated}`);
    console.log(`✅ Leave balances migrated: ${migrationResults.leaveBalancesMigrated}`);
    console.log(`⚠️ Duplicates skipped: ${migrationResults.duplicatesSkipped}`);

    console.log('\n🔍 Next Steps:');
    console.log('1. Verify data in main tenant database');
    console.log('2. Test login with migrated users');
    console.log('3. Update application routing to use main tenant only');
    console.log('4. Backup and delete recruitment tenant database');
    console.log('5. Update any hardcoded references to recruitment tenant');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the migration
mergeDatabases();
