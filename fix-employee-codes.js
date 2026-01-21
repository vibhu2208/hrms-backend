const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function fixEmployeeCodes() {
  try {
    console.log('🔧 Fixing employee codes for existing employees...\n');

    await mongoose.connect(TENANT_URI);
    console.log('✅ Connected successfully');

    // Get all employees without employee codes
    const employeesWithoutCodes = await mongoose.connection.db.collection('users').find({
      role: 'employee',
      $or: [
        { employeeCode: { $exists: false } },
        { employeeCode: null },
        { employeeCode: '' }
      ]
    }).toArray();

    console.log(`👷 Found ${employeesWithoutCodes.length} employees without codes\n`);

    for (let i = 0; i < employeesWithoutCodes.length; i++) {
      const employee = employeesWithoutCodes[i];

      // Get current employee count for code generation
      const employeeCount = await mongoose.connection.db.collection('users').countDocuments({
        role: { $in: ['employee', 'manager'] },
        employeeCode: { $exists: true, $ne: null, $ne: '' }
      });

      // Generate code: EMP + 4-digit number
      const codeNumber = (employeeCount + i + 1).toString().padStart(4, '0');
      const employeeCode = `EMP${codeNumber}`;

      // Update employee with code
      await mongoose.connection.db.collection('users').updateOne(
        { _id: employee._id },
        {
          $set: {
            employeeCode: employeeCode,
            updatedAt: new Date()
          }
        }
      );

      console.log(`✅ ${employee.firstName} ${employee.lastName}: ${employeeCode}`);
    }

    // Verify all employees now have codes
    console.log('\n🔍 Verification:');
    const allEmployees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Total employees: ${allEmployees.length}`);

    allEmployees.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.firstName} ${emp.lastName} - Code: ${emp.employeeCode || 'none'}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Employee codes fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

fixEmployeeCodes();