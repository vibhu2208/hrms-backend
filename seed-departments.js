const mongoose = require('mongoose');
const Department = require('./src/models/Department');
require('dotenv').config();

const sampleDepartments = [
  {
    name: 'Human Resources',
    code: 'HR',
    description: 'Human Resources Department'
  },
  {
    name: 'Information Technology',
    code: 'IT',
    description: 'Information Technology Department'
  },
  {
    name: 'Finance',
    code: 'FIN',
    description: 'Finance and Accounting Department'
  },
  {
    name: 'Marketing',
    code: 'MKT',
    description: 'Marketing Department'
  },
  {
    name: 'Operations',
    code: 'OPS',
    description: 'Operations Department'
  },
  {
    name: 'Sales',
    code: 'SALES',
    description: 'Sales Department'
  }
];

const seedDepartments = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing departments
    await Department.deleteMany({});
    console.log('Cleared existing departments');

    // Insert sample departments
    const departments = await Department.insertMany(sampleDepartments);
    console.log(`✅ Created ${departments.length} sample departments:`);

    departments.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.code})`);
    });

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDepartments();
