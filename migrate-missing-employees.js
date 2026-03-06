const mongoose = require('mongoose');
const TENANT_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_696b515db6c9fd5fd51aed1c?retryWrites=true&w=majority';

async function migrateMissingEmployees() {
  try {
    console.log('🚀 Migrating missing employees from users to employees collection...\n');

    await mongoose.connect(TENANT_URI);

    // Get all users with role 'employee'
    const employeeUsers = await mongoose.connection.db.collection('users').find({ role: 'employee' }).toArray();
    console.log(`👥 Found ${employeeUsers.length} users with employee role`);

    // Get all existing employees
    const existingEmployees = await mongoose.connection.db.collection('employees').find({}).toArray();
    const existingEmails = new Set(existingEmployees.map(e => e.email));

    let migratedCount = 0;

    for (const user of employeeUsers) {
      if (!existingEmails.has(user.email)) {
        // Create employee record for this user
        const employeeData = {
          userId: user._id, // Reference to the user
          firstName: user.firstName || user.name?.split(' ')[0] || 'Unknown',
          lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
          email: user.email,
          phone: user.phone || '',
          employeeCode: `EMP${Date.now().toString().slice(-6)}`, // Generate a temporary code
          joiningDate: user.createdAt || new Date(),
          designation: 'Employee', // Default designation
          status: 'active',
          isActive: true,
          isFirstLogin: user.isFirstLogin !== false,
          mustChangePassword: user.mustChangePassword !== false,
          createdAt: user.createdAt || new Date(),
          updatedAt: new Date()
        };

        const result = await mongoose.connection.db.collection('employees').insertOne(employeeData);
        console.log(`✅ Migrated ${user.firstName} ${user.lastName} (${user.email}) -> Employee ID: ${result.insertedId}`);
        migratedCount++;
      } else {
        console.log(`⏭️  ${user.firstName} ${user.lastName} (${user.email}) already exists in employees`);
      }
    }

    console.log(`\n🎉 Migrated ${migratedCount} employees`);

    // Now fix the offboarding records
    console.log('\n🔧 Fixing offboarding employee IDs...');
    const offboardings = await mongoose.connection.db.collection('offboardingrequests').find({}).toArray();

    for (const offboarding of offboardings) {
      const user = await mongoose.connection.db.collection('users').findOne({ _id: offboarding.employeeId });

      if (user) {
        const employee = await mongoose.connection.db.collection('employees').findOne({ email: user.email });

        if (employee) {
          await mongoose.connection.db.collection('offboardingrequests').updateOne(
            { _id: offboarding._id },
            { $set: { employeeId: employee._id } }
          );
          console.log(`✅ Fixed offboarding ${offboarding._id} for ${user.firstName}`);
        }
      }
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

migrateMissingEmployees();