const mongoose = require('mongoose');

async function checkAllTenantUsers() {
  try {
    // Try different tenant databases
    const tenantIds = ['67891af8c2e4b4d4e8d9e5f9', '67891af8c2e4b4d4e8d9e5f0'];
    
    for (const tenantId of tenantIds) {
      try {
        await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/tenant_${tenantId}?retryWrites=true&w=majority`, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });

        console.log(`\n🔍 Checking tenant database: tenant_${tenantId}`);

        // Define tenant user schema with unique model name
        const tenantUserSchema = new mongoose.Schema({}, { strict: false });
        const TenantUser = mongoose.model(`TenantUser_${tenantId}`, tenantUserSchema);

        const users = await TenantUser.find({}).select('email role firstName lastName isActive employeeCode department');
        
        if (users.length > 0) {
          console.log(`📋 Found ${users.length} users in tenant_${tenantId}:`);
          
          // Group by role
          const roleGroups = {};
          users.forEach(user => {
            const role = user.role || 'unknown';
            if (!roleGroups[role]) {
              roleGroups[role] = [];
            }
            roleGroups[role].push(user);
          });

          // Display users by role
          Object.keys(roleGroups).forEach(role => {
            console.log(`\n   ${role.toUpperCase()} (${roleGroups[role].length}):`);
            roleGroups[role].forEach(user => {
              console.log(`   - ${user.email} - ${user.firstName} ${user.lastName} - ${user.employeeCode || 'No Code'} - Dept: ${user.department || 'None'}`);
            });
          });

          // Check for unwanted employee roles
          const employees = roleGroups['employee'] || [];
          if (employees.length > 0) {
            console.log(`\n⚠️  FOUND ${employees.length} EMPLOYEE ENTRIES (should be removed):`);
            employees.forEach(emp => {
              console.log(`   ❌ ${emp.email} - ${emp.firstName} ${emp.lastName} - ${emp.employeeCode || 'No Code'}`);
            });
          }

          // Summary
          const allowedRoles = ['company_admin', 'hr', 'manager'];
          const hasUnwantedRoles = Object.keys(roleGroups).some(role => !allowedRoles.includes(role));
          
          if (hasUnwantedRoles) {
            console.log(`\n❌ ISSUES FOUND: User roles other than ${allowedRoles.join(', ')} detected`);
          } else {
            console.log(`\n✅ OK: Only allowed roles (${allowedRoles.join(', ')}) found`);
          }
          
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

checkAllTenantUsers();
