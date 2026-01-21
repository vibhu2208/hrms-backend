const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkEmployeeData() {
  try {
    console.log('🔍 Checking employee data quality...\n');

    await mongoose.connect(TENANT_URI);

    // Check employees collection
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log(`📋 Total employees: ${employees.length}`);

    console.log('\n--- Employee Data Quality ---');
    const poorQuality = [];

    employees.forEach((emp, index) => {
      const hasValidName = emp.firstName && emp.lastName && emp.firstName !== 'Unknown' && emp.lastName !== '';
      const hasValidEmail = emp.email && emp.email.includes('@') && !emp.email.includes('example.com');
      const hasValidCode = emp.employeeCode && emp.employeeCode.startsWith('EMP');

      const dataQuality = hasValidName && hasValidEmail && hasValidCode ? '✅ Good' : '❌ Poor';

      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.email} [${dataQuality}]`);

      if (!hasValidName || !hasValidEmail || !hasValidCode) {
        poorQuality.push(emp);
        console.log(`   ⚠️  Issues: ${!hasValidName ? 'Invalid name ' : ''}${!hasValidEmail ? 'Invalid email ' : ''}${!hasValidCode ? 'Invalid code' : ''}`);
      }
    });

    console.log(`\n🚨 Found ${poorQuality.length} employees with poor data quality`);

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEmployeeData();