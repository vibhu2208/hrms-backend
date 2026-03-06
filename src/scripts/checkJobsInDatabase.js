/**
 * Quick script to check if jobs exist in the tenant database
 * Run: node src/scripts/checkJobsInDatabase.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const TENANT_ID = '696b515db6c9fd5fd51aed1c';
const TENANT_DB_NAME = `tenant_${TENANT_ID}`;
const BASE_URI = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';
const TENANT_DB_URI = `${BASE_URI}/${TENANT_DB_NAME}?retryWrites=true&w=majority`;

async function checkJobs() {
  let connection = null;
  
  try {
    console.log('🔄 Connecting to tenant database...');
    console.log(`   Database: ${TENANT_DB_NAME}`);
    connection = await mongoose.createConnection(TENANT_DB_URI);
    console.log('✅ Connected\n');

    // Check collections
    const collections = await connection.db.listCollections().toArray();
    console.log('📚 Collections in database:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');

    // Check jobpostings collection
    const jobPostingsCollection = connection.db.collection('jobpostings');
    const jobCount = await jobPostingsCollection.countDocuments();
    console.log(`📋 Total jobs: ${jobCount}\n`);

    if (jobCount > 0) {
      const jobs = await jobPostingsCollection.find({}).limit(5).toArray();
      console.log('📝 Sample jobs:');
      jobs.forEach((job, index) => {
        console.log(`\n   ${index + 1}. ${job.title || 'No title'}`);
        console.log(`      Status: ${job.status || 'N/A'}`);
        console.log(`      Location: ${job.location || 'N/A'}`);
        console.log(`      ID: ${job._id}`);
      });
    } else {
      console.log('⚠️  No jobs found in database!');
      console.log('   Run the seed script: node src/scripts/seedTenant696b515db6c9fd5fd51aed1c.js');
    }

    // Check users collection
    const usersCollection = connection.db.collection('users');
    const userCount = await usersCollection.countDocuments();
    console.log(`\n👥 Total users: ${userCount}`);

    if (userCount > 0) {
      const users = await usersCollection.find({}).limit(3).toArray();
      console.log('📝 Sample users:');
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email || 'No email'} (${user.role || 'N/A'})`);
      });
    }

    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.close();
    process.exit(1);
  }
}

checkJobs();
