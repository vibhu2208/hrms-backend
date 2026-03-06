const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority';

async function checkEmployees() {
  try {
    console.log('🔗 Connecting to hrms_spc database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully');

    // Check employees created from onboarding
    const employees = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👷 Found ${employees.length} employees created from onboarding:`);

    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName} - ${emp.email} (${emp.employeeCode}) - Joined: ${emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : 'N/A'}`);
      console.log(`   Department: ${emp.department || 'N/A'}, Designation: ${emp.designation || 'N/A'}`);
      console.log('');
    });

    // Check completed onboardings
    const onboardings = await mongoose.connection.db.collection('onboardings').find({ status: 'completed' }).toArray();
    console.log(`📋 Found ${onboardings.length} completed onboardings:`);

    onboardings.forEach((onb, index) => {
      console.log(`${index + 1}. ${onb.candidateName} - ${onb.candidateEmail} - Completed: ${onb.completedAt ? new Date(onb.completedAt).toLocaleDateString() : 'N/A'}`);
      console.log(`   Position: ${onb.position || 'N/A'}, Department: ${onb.department?.name || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
}

checkEmployees();