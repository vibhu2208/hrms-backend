const { getTenantConnection } = require('./src/config/database.config');

async function checkSpecificEmployee() {
  let tenantConnection = null;
  
  try {
    console.log('🔍 Checking specific employee EMP0048...');
    
    // Connect to tenant database
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    tenantConnection = await getTenantConnection(tenantDbName);
    
    console.log('✅ Connected to tenant database');
    
    // Get Employee model
    const Employee = tenantConnection.models.Employee || tenantConnection.model('Employee', require('./src/models/tenant/TenantEmployee'));
    
    // Find the specific employee
    const employee = await Employee.findOne({ employeeCode: 'EMP0048' });
    
    if (!employee) {
      console.log('❌ Employee EMP0048 not found');
      return;
    }
    
    console.log('\n👤 Employee Details:');
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Email: ${employee.email}`);
    console.log(`   Code: ${employee.employeeCode}`);
    console.log(`   Status: ${employee.status}`);
    console.log(`   isActive: ${employee.isActive}`);
    console.log(`   isExEmployee: ${employee.isExEmployee}`);
    console.log(`   terminatedAt: ${employee.terminatedAt || 'Not set'}`);
    
    // Check if this employee should be filtered out
    const shouldFilter = 
      employee.isActive === false || 
      employee.isExEmployee === true || 
      employee.status === 'terminated';
    
    console.log(`\n🔍 Should be filtered out: ${shouldFilter}`);
    
    if (shouldFilter) {
      console.log('❌ ISSUE: This employee should be filtered but is still showing!');
      console.log('   Reasons for filtering:');
      if (employee.isActive === false) console.log('   - isActive is false');
      if (employee.isExEmployee === true) console.log('   - isExEmployee is true');
      if (employee.status === 'terminated') console.log('   - status is terminated');
    } else {
      console.log('✅ This employee should not be filtered (based on current values)');
    }
    
    // Test the filter query directly
    console.log('\n🧪 Testing filter query...');
    
    const filteredQuery = {
      isActive: true,
      status: { $ne: 'terminated' }, // Exclude terminated employees
      $or: [
        { isExEmployee: { $exists: false } },
        { isExEmployee: null },
        { isExEmployee: false }
      ]
    };
    
    console.log('Query:', JSON.stringify(filteredQuery, null, 2));
    
    const wouldBeIncluded = await Employee.findOne({
      ...filteredQuery,
      employeeCode: 'EMP0048'
    });
    
    if (wouldBeIncluded) {
      console.log('❌ PROBLEM: Employee passes the filter query and would be included');
    } else {
      console.log('✅ Employee would be correctly filtered out');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
      console.log('🔒 Database connection closed');
    }
  }
}

// Run the check
checkSpecificEmployee();
