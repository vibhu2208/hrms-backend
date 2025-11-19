/**
 * Migration Script: Add reportingManager field to existing users
 * This script updates existing employee users to add reportingManager field
 */

require('dotenv').config();
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const { getCompanyRegistry } = require('../models/global');

async function updateExistingUsers() {
  let tenantConnection = null;
  
  try {
    console.log('🔄 Starting user update migration...\n');

    // Get TCS company
    const CompanyRegistry = await getCompanyRegistry();
    const company = await CompanyRegistry.findOne({
      companyCode: 'TCS00001',
      status: 'active'
    });

    if (!company) {
      console.log('❌ TCS company not found!');
      return;
    }

    console.log(`✅ Found company: ${company.companyName}`);
    console.log(`   Company ID: ${company.companyId}\n`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(company.companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Find manager
    const manager = await TenantUser.findOne({ 
      email: 'manager@tcs.com',
      role: 'manager'
    });

    if (!manager) {
      console.log('❌ Manager not found!');
      return;
    }

    console.log(`✅ Found manager: ${manager.firstName} ${manager.lastName}`);
    console.log(`   Email: ${manager.email}\n`);

    // Update all employees (except manager) to report to manager
    const result = await TenantUser.updateMany(
      { 
        role: 'employee',
        email: { $ne: 'manager@tcs.com' }
      },
      { 
        $set: { 
          reportingManager: 'manager@tcs.com'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} employee(s)`);
    console.log(`   Set reportingManager: manager@tcs.com\n`);

    // Show updated employees
    const updatedEmployees = await TenantUser.find({
      reportingManager: 'manager@tcs.com'
    }).select('firstName lastName email department designation reportingManager');

    console.log('📋 Employees now reporting to manager@tcs.com:');
    console.log('─────────────────────────────────────────────────────\n');
    
    updatedEmployees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   Department: ${emp.department || 'N/A'}`);
      console.log(`   Designation: ${emp.designation || 'N/A'}`);
      console.log(`   Reports to: ${emp.reportingManager}\n`);
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');

    // Close connection
    if (tenantConnection) await tenantConnection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (tenantConnection) await tenantConnection.close();
    process.exit(1);
  }
}

// Run migration
updateExistingUsers();
