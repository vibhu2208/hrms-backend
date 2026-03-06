const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function cleanupTestUsers() {
  try {
    console.log('🧹 Cleaning up test user accounts...\n');

    await mongoose.connect(TENANT_URI);

    // Get remaining employees
    const remainingEmployees = await mongoose.connection.db.collection('employees').find({}).toArray();
    const employeeEmails = new Set(remainingEmployees.map(e => e.email));

    // Get all users with employee role
    const employeeUsers = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👤 Found ${employeeUsers.length} users with employee role`);

    let removedCount = 0;
    let keptCount = 0;

    for (const user of employeeUsers) {
      if (employeeEmails.has(user.email)) {
        console.log(`✅ Kept user: ${user.firstName} ${user.lastName} (${user.email})`);
        keptCount++;
      } else {
        // Remove user that's not in employees collection
        await mongoose.connection.db.collection('users').deleteOne({ _id: user._id });
        console.log(`🗑️  Removed test user: ${user.firstName} ${user.lastName} (${user.email})`);
        removedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Removed: ${removedCount} test users`);
    console.log(`   Kept: ${keptCount} users`);

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupTestUsers();