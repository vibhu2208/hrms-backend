const seedPackages = require('./seedPackages');
const seedClients = require('./seedClients');

const seedAll = async () => {
  console.log('🚀 Starting complete database seeding...\n');
  
  try {
    console.log('📦 Seeding packages...');
    await seedPackages();
    
    console.log('\n👥 Seeding clients...');
    await seedClients();
    
    console.log('\n🎉 All seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Packages seeded with 4 different plans');
    console.log('   ✅ Clients seeded with 5 test companies');
    console.log('   ✅ Admin users created for each client');
    console.log('\n🔧 Next Steps:');
    console.log('   1. Test package assignment in Package Management');
    console.log('   2. View clients in Client Management');
    console.log('   3. Login as client admin users to test functionality');
    console.log('\n🔑 Default password for all users: password123');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  }
};

// Run if called directly
if (require.main === module) {
  seedAll();
}

module.exports = seedAll;
