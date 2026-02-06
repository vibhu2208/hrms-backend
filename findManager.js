const mongoose = require('mongoose');
const { getSuperAdmin, getCompanyRegistry } = require('./src/models/global');

async function findManager() {
  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/hrms_spc?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to main MongoDB database');

    // Get company registry to find SPC company
    const companyRegistry = await getCompanyRegistry();
    const spcCompany = companyRegistry.find(company => company.name === 'SPC Management' || company.name.includes('SPC'));
    
    if (!spcCompany) {
      console.log('❌ SPC company not found');
      console.log('Available companies:');
      companyRegistry.forEach(company => {
        console.log(`- ${company.name} (${company._id})`);
      });
      return;
    }

    console.log(`✅ Found SPC company: ${spcCompany.name} (${spcCompany._id})`);
    
    // Connect to tenant database
    const tenantDbName = `tenant_${spcCompany._id}`;
    await mongoose.disconnect();
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`🔗 Connected to tenant database: ${tenantDbName}`);

    // Import tenant user model
    const TenantUserSchema = require('./src/models/tenant/TenantUser');
    const TenantUser = mongoose.model('User', TenantUserSchema);

    // Find manager with email vibhu2208@gmail.com
    const manager = await TenantUser.findOne({ email: 'vibhu2208@gmail.com' });
    
    if (manager) {
      console.log('✅ Manager found!');
      console.log('📧 Email:', manager.email);
      console.log('🆔 User ID:', manager._id);
      console.log('👤 Name:', manager.firstName + ' ' + manager.lastName);
      console.log('🔑 Role:', manager.role);
      console.log('✅ Status:', manager.isActive ? 'Active' : 'Inactive');
      console.log('🔐 Password is hashed in database');
      console.log('📝 If you need to reset password, use admin panel reset password feature');
      console.log('🌐 Login URL: http://localhost:5173/login');
    } else {
      console.log('❌ Manager with email vibhu2208@gmail.com not found');
      
      // Show all users to help debug
      const allUsers = await TenantUser.find({}).select('email role firstName lastName isActive');
      console.log('📋 All users in tenant:');
      allUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

findManager();
