const mongoose = require('mongoose');

async function listAllUsers() {
  try {
    // Try different tenant databases
    const tenantIds = ['67891af8c2e4b4d4e8d9e5f9', '67891af8c2e4b4d4e8d9e5f0']; // Common tenant IDs
    
    for (const tenantId of tenantIds) {
      try {
        await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_${tenantId}?retryWrites=true&w=majority`, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });

        console.log(`🔗 Checking tenant database: tenant_${tenantId}`);

        // Define a simple user schema
        const userSchema = new mongoose.Schema({}, { strict: false });
        const User = mongoose.model('User', userSchema);

        const users = await User.find({}).select('email role firstName lastName isActive employeeCode');
        
        if (users.length > 0) {
          console.log(`📋 Found ${users.length} users in tenant_${tenantId}:`);
          users.forEach(user => {
            console.log(`- ${user.email} (${user.role}) - ${user.firstName} ${user.lastName} - ${user.employeeCode || 'No Code'}`);
          });
        } else {
          console.log(`📭 No users found in tenant_${tenantId}`);
        }
        
        await mongoose.disconnect();
        
      } catch (error) {
        console.log(`❌ Error accessing tenant_${tenantId}: ${error.message}`);
        await mongoose.disconnect();
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listAllUsers();
