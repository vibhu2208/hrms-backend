const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function checkEmails() {
  try {
    await mongoose.connect(TENANT_URI);

    const users = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();

    console.log('Users with employee role:');
    users.forEach(u => console.log(`  ${u.firstName || u.name}: ${u.email}`));

    console.log('\nEmployees:');
    employees.forEach(e => console.log(`  ${e.firstName} ${e.lastName}: ${e.email}`));

    await mongoose.connection.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkEmails();