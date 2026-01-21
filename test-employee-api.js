const mongoose = require('mongoose');
const { getTenantModels } = require('./src/utils/tenantModels');

async function testEmployeeAPI() {
  try {
    console.log('🧪 Testing Employee API...\n');

    const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

    await mongoose.connect(TENANT_URI);

    // Simulate the tenant middleware
    const tenantConnection = mongoose.connection;
    const { Employee: TenantEmployee } = getTenantModels(tenantConnection);

    // Test the same query as the controller
    const query = { isActive: true };
    const employees = await TenantEmployee.find(query).sort({ createdAt: -1 });

    console.log(`✅ Found ${employees.length} active employees:`);
    employees.forEach((emp, index) => {
      console.log(`  ${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.status}`);
    });

    // Test filtering by status
    const activeEmployees = employees.filter(emp => emp.status === 'active');
    console.log(`\n✅ Active employees: ${activeEmployees.length}`);

    await mongoose.connection.close();

    console.log('\n🎉 Employee API test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testEmployeeAPI();