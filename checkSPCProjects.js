const mongoose = require('mongoose');

async function checkSPCProjects() {
  try {
    console.log('🔍 Checking existing SPC projects...');
    
    const spcTenantId = '696b515db6c9fd5fd51aed1c';
    const spcTenantDb = `tenant_${spcTenantId}`;

    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${spcTenantDb}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ Connected to SPC tenant: ${spcTenantDb}`);

    // Check if projects collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const projectsCollection = collections.find(c => c.name === 'projects');
    
    if (projectsCollection) {
      console.log('📁 Projects collection exists');
      
      // Check existing projects
      try {
        const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
        const projects = await Project.find({});
        console.log(`📊 Found ${projects.length} existing projects:`);
        
        projects.forEach(project => {
          console.log(`  - ${project.name || project.projectName} (ID: ${project._id})`);
          console.log(`    Status: ${project.status || 'N/A'}`);
          console.log(`    Created: ${project.createdAt || 'N/A'}`);
        });
        
        // Check indexes
        const indexes = await mongoose.connection.db.collection('projects').indexInformation();
        console.log('\n🔑 Current indexes on projects collection:');
        Object.keys(indexes).forEach(indexName => {
          console.log(`  - ${indexName}: ${JSON.stringify(indexes[indexName].key)}`);
        });
        
      } catch (err) {
        console.error(`Error reading projects: ${err.message}`);
      }
    } else {
      console.log('📁 Projects collection does not exist yet');
    }

    // Check users and their current roles
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await User.find({}).select('email role firstName lastName isActive');
    
    console.log('\n👥 Current users in SPC tenant:');
    const roleCount = {};
    users.forEach(user => {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
      console.log(`  - ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
    });
    
    console.log('\n📊 Role distribution:');
    Object.keys(roleCount).forEach(role => {
      console.log(`  - ${role}: ${roleCount[role]}`);
    });

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkSPCProjects();
