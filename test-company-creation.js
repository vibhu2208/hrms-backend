/**
 * Test Script for Multi-Tenant Company Creation
 * 
 * This script tests the company creation flow without needing to make API calls
 * Run with: node test-company-creation.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./src/models/Company');
const { 
  createTenantDatabase, 
  createTenantAdminUser, 
  initializeTenantDatabase 
} = require('./src/utils/databaseProvisioning');
const { generateAdminPassword } = require('./src/utils/generatePassword');
const { sendCompanyAdminCredentials } = require('./src/services/emailService');

async function testCompanyCreation() {
  let mainConnection = null;
  let tenantConnection = null;

  try {
    console.log('🚀 Starting Multi-Tenant Company Creation Test\n');

    // Step 1: Connect to main database
    console.log('📊 Step 1: Connecting to main database...');
    mainConnection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to main database\n');

    // Step 2: Create test company data
    console.log('📝 Step 2: Preparing test company data...');
    const testCompanyData = {
      companyName: 'Test Company ' + Date.now(),
      email: 'krishnaupadhyay112211@gmail' + Date.now() + '.com',
      phone: '+1234567890',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'USA'
      },
      subscription: {
        plan: 'trial',
        status: 'active',
        maxEmployees: 50,
        maxAdmins: 2
      },
      enabledModules: ['hr', 'attendance', 'recruitment'],
      status: 'active',
      isActive: true,
      databaseStatus: 'provisioning'
    };
    console.log('✅ Test company data prepared');
    console.log('   Company Name:', testCompanyData.companyName);
    console.log('   Email:', testCompanyData.email, '\n');

    // Step 3: Generate admin password
    console.log('🔐 Step 3: Generating admin password...');
    const adminPassword = generateAdminPassword();
    console.log('✅ Admin password generated:', adminPassword, '\n');

    // Step 4: Create company record
    console.log('💾 Step 4: Creating company record in main database...');
    const company = await Company.create(testCompanyData);
    console.log('✅ Company record created');
    console.log('   Company Code:', company.companyCode);
    console.log('   Database Name:', company.databaseName, '\n');

    // Step 5: Create tenant database
    console.log('🗄️  Step 5: Creating tenant database...');
    const dbResult = await createTenantDatabase(company.databaseName);
    tenantConnection = dbResult.connection;
    console.log('✅ Tenant database created:', company.databaseName, '\n');

    // Step 6: Create admin user in tenant database
    console.log('👤 Step 6: Creating admin user in tenant database...');
    const adminUserResult = await createTenantAdminUser(tenantConnection, {
      email: testCompanyData.email,
      password: adminPassword
    });
    console.log('✅ Admin user created');
    console.log('   User ID:', adminUserResult.userId);
    console.log('   Email:', adminUserResult.email, '\n');

    // Step 7: Initialize tenant database
    console.log('⚙️  Step 7: Initializing tenant database with default data...');
    const initResult = await initializeTenantDatabase(tenantConnection, {
      companyName: company.companyName
    });
    console.log('✅ Tenant database initialized');
    console.log('   Departments created:', initResult.departmentsCreated);
    console.log('   Designations created:', initResult.designationsCreated, '\n');

    // Step 8: Update company record
    console.log('📝 Step 8: Updating company record with admin info...');
    company.adminUser = {
      email: testCompanyData.email,
      userId: adminUserResult.userId,
      createdAt: new Date()
    };
    company.databaseStatus = 'active';
    await company.save();
    console.log('✅ Company record updated\n');

    // Step 9: Send credentials email (optional - will fail if email not configured)
    console.log('📧 Step 9: Sending credentials email...');
    try {
      await sendCompanyAdminCredentials({
        companyName: company.companyName,
        adminEmail: testCompanyData.email,
        adminPassword: adminPassword,
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
      });
      console.log('✅ Credentials email sent successfully\n');
    } catch (emailError) {
      console.log('⚠️  Email sending skipped (not configured or failed)');
      console.log('   Error:', emailError.message, '\n');
    }

    // Step 10: Verify tenant database
    console.log('🔍 Step 10: Verifying tenant database...');
    const collections = await tenantConnection.db.listCollections().toArray();
    console.log('✅ Tenant database verification complete');
    console.log('   Collections created:', collections.length);
    console.log('   Collection names:', collections.map(c => c.name).join(', '), '\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 COMPANY CREATION TEST COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log('   Company Code:', company.companyCode);
    console.log('   Company Name:', company.companyName);
    console.log('   Database Name:', company.databaseName);
    console.log('   Admin Email:', testCompanyData.email);
    console.log('   Admin Password:', adminPassword);
    console.log('   Status:', company.status);
    console.log('   Database Status:', company.databaseStatus);
    console.log('\n🔗 Next Steps:');
    console.log('   1. Login with the admin credentials above');
    console.log('   2. Change the password on first login');
    console.log('   3. Set up company profile and preferences');
    console.log('   4. Add employees and start using the system');
    console.log('\n💡 To test login:');
    console.log('   POST /api/auth/login');
    console.log('   {');
    console.log('     "email": "' + testCompanyData.email + '",');
    console.log('     "password": "' + adminPassword + '"');
    console.log('   }');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR during company creation test:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up connections...');
    if (tenantConnection) {
      await tenantConnection.close();
      console.log('✅ Tenant connection closed');
    }
    if (mainConnection) {
      await mongoose.connection.close();
      console.log('✅ Main connection closed');
    }
    console.log('\n✅ Test completed. Exiting...\n');
    process.exit(0);
  }
}

// Run the test
console.log('\n');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   Multi-Tenant Company Creation Test Script          ║');
console.log('║   Testing automatic database provisioning            ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('\n');

testCompanyCreation();
