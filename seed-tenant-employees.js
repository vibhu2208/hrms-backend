const mongoose = require('mongoose');
const { getTenantConnection } = require('./src/config/database.config');
const { getTenantModel } = require('./src/middlewares/tenantMiddleware');
const TenantEmployeeSchema = require('./src/models/tenant/TenantEmployee');
const Department = require('./src/models/Department');
const Client = require('./src/models/Client');
require('dotenv').config();

// Sample employee data - 20 diverse employees
const sampleEmployees = [
  {
    firstName: 'Rajesh',
    lastName: 'Kumar',
    email: 'rajesh.kumar@company.com',
    phone: '+91-9876543210',
    designation: 'Senior Software Engineer',
    joiningDate: new Date('2020-01-15'),
    salary: { basic: 85000, hra: 34000, allowances: 10000, total: 124000 }
  },
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@company.com',
    phone: '+91-9876543211',
    designation: 'HR Manager',
    joiningDate: new Date('2019-06-01'),
    salary: { basic: 75000, hra: 30000, allowances: 8000, total: 107000 }
  },
  {
    firstName: 'Amit',
    lastName: 'Patel',
    email: 'amit.patel@company.com',
    phone: '+91-9876543212',
    designation: 'Finance Manager',
    joiningDate: new Date('2018-03-20'),
    salary: { basic: 90000, hra: 36000, allowances: 12000, total: 132000 }
  },
  {
    firstName: 'Sneha',
    lastName: 'Reddy',
    email: 'sneha.reddy@company.com',
    phone: '+91-9876543213',
    designation: 'Marketing Specialist',
    joiningDate: new Date('2021-09-10'),
    salary: { basic: 55000, hra: 22000, allowances: 6000, total: 80000 }
  },
  {
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'vikram.singh@company.com',
    phone: '+91-9876543214',
    designation: 'Operations Manager',
    joiningDate: new Date('2017-11-05'),
    salary: { basic: 80000, hra: 32000, allowances: 10000, total: 117000 }
  },
  {
    firstName: 'Anjali',
    lastName: 'Gupta',
    email: 'anjali.gupta@company.com',
    phone: '+91-9876543215',
    designation: 'Software Developer',
    joiningDate: new Date('2022-02-14'),
    salary: { basic: 65000, hra: 26000, allowances: 7000, total: 94500 }
  },
  {
    firstName: 'Rohit',
    lastName: 'Mehra',
    email: 'rohit.mehra@company.com',
    phone: '+91-9876543216',
    designation: 'Sales Manager',
    joiningDate: new Date('2019-08-12'),
    salary: { basic: 70000, hra: 28000, allowances: 15000, total: 109000 }
  },
  {
    firstName: 'Kavita',
    lastName: 'Agarwal',
    email: 'kavita.agarwal@company.com',
    phone: '+91-9876543217',
    designation: 'Business Analyst',
    joiningDate: new Date('2020-07-30'),
    salary: { basic: 60000, hra: 24000, allowances: 8000, total: 89000 }
  },
  {
    firstName: 'Deepak',
    lastName: 'Verma',
    email: 'deepak.verma@company.com',
    phone: '+91-9876543218',
    designation: 'Junior Developer',
    joiningDate: new Date('2023-01-20'),
    salary: { basic: 45000, hra: 18000, allowances: 5000, total: 65500 }
  },
  {
    firstName: 'Meera',
    lastName: 'Iyer',
    email: 'meera.iyer@company.com',
    phone: '+91-9876543219',
    designation: 'Quality Assurance Lead',
    joiningDate: new Date('2018-12-03'),
    salary: { basic: 72000, hra: 28800, allowances: 9000, total: 105300 }
  },
  {
    firstName: 'Suresh',
    lastName: 'Nair',
    email: 'suresh.nair@company.com',
    phone: '+91-9876543220',
    designation: 'DevOps Engineer',
    joiningDate: new Date('2019-05-18'),
    salary: { basic: 78000, hra: 31200, allowances: 10000, total: 114200 }
  },
  {
    firstName: 'Pooja',
    lastName: 'Joshi',
    email: 'pooja.joshi@company.com',
    phone: '+91-9876543221',
    designation: 'UI/UX Designer',
    joiningDate: new Date('2022-06-15'),
    salary: { basic: 58000, hra: 23200, allowances: 7000, total: 84700 }
  },
  {
    firstName: 'Arjun',
    lastName: 'Pillai',
    email: 'arjun.pillai@company.com',
    phone: '+91-9876543222',
    designation: 'Project Manager',
    joiningDate: new Date('2016-10-25'),
    salary: { basic: 95000, hra: 38000, allowances: 15000, total: 141000 }
  },
  {
    firstName: 'Ritu',
    lastName: 'Saxena',
    email: 'ritu.saxena@company.com',
    phone: '+91-9876543223',
    designation: 'Content Writer',
    joiningDate: new Date('2021-11-08'),
    salary: { basic: 48000, hra: 19200, allowances: 5000, total: 69700 }
  },
  {
    firstName: 'Kiran',
    lastName: 'Desai',
    email: 'kiran.desai@company.com',
    phone: '+91-9876543224',
    designation: 'System Administrator',
    joiningDate: new Date('2017-08-22'),
    salary: { basic: 62000, hra: 24800, allowances: 8000, total: 90800 }
  },
  {
    firstName: 'Neha',
    lastName: 'Chopra',
    email: 'neha.chopra@company.com',
    phone: '+91-9876543225',
    designation: 'Data Analyst',
    joiningDate: new Date('2021-03-10'),
    salary: { basic: 58000, hra: 23200, allowances: 6500, total: 84700 }
  },
  {
    firstName: 'Manish',
    lastName: 'Yadav',
    email: 'manish.yadav@company.com',
    phone: '+91-9876543226',
    designation: 'Network Engineer',
    joiningDate: new Date('2019-09-14'),
    salary: { basic: 68000, hra: 27200, allowances: 8500, total: 99500 }
  },
  {
    firstName: 'Swati',
    lastName: 'Mishra',
    email: 'swati.mishra@company.com',
    phone: '+91-9876543227',
    designation: 'Legal Counsel',
    joiningDate: new Date('2018-04-20'),
    salary: { basic: 85000, hra: 34000, allowances: 11000, total: 125000 }
  },
  {
    firstName: 'Rahul',
    lastName: 'Jain',
    email: 'rahul.jain@company.com',
    phone: '+91-9876543228',
    designation: 'Product Manager',
    joiningDate: new Date('2017-07-01'),
    salary: { basic: 95000, hra: 38000, allowances: 16000, total: 142000 }
  },
  {
    firstName: 'Divya',
    lastName: 'Krishnan',
    email: 'divya.krishnan@company.com',
    phone: '+91-9876543229',
    designation: 'Research Scientist',
    joiningDate: new Date('2020-11-12'),
    salary: { basic: 75000, hra: 30000, allowances: 9500, total: 107500 }
  }
];

// Department mapping based on designation
const getDepartmentForDesignation = (designation) => {
  const deptMap = {
    'HR Manager': 'Human Resources',
    'Finance Manager': 'Finance',
    'Marketing Specialist': 'Marketing',
    'Operations Manager': 'Operations',
    'Sales Manager': 'Sales',
    'Senior Software Engineer': 'Information Technology',
    'Software Developer': 'Information Technology',
    'Junior Developer': 'Information Technology',
    'DevOps Engineer': 'Information Technology',
    'System Administrator': 'Information Technology',
    'UI/UX Designer': 'Information Technology',
    'Business Analyst': 'Information Technology',
    'Data Analyst': 'Information Technology',
    'Network Engineer': 'Information Technology',
    'Quality Assurance Lead': 'Information Technology',
    'Project Manager': 'Information Technology',
    'Product Manager': 'Information Technology',
    'Legal Counsel': 'Human Resources',
    'Content Writer': 'Marketing',
    'Research Scientist': 'Information Technology'
  };
  return deptMap[designation] || 'Information Technology';
};

// Get tenant ID from command line argument or use default
const tenantId = process.argv[2] || '696b515db6c9fd5fd51aed1c';
const tenantDbName = `tenant_${tenantId}`;

const seedTenantEmployees = async () => {
  try {
    console.log('🚀 HRMS Tenant Employee Seeding Script');
    console.log('=====================================');
    console.log(`🎯 Target Tenant: ${tenantDbName}`);

    // Try to connect to MongoDB (Atlas first, then fallback to local)
    let baseUri;
    let isAtlas = false;

    try {
      // Connect to the provided MongoDB Atlas database
      const mongoUri = 'mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net';
      await mongoose.connect(`${mongoUri}/${tenantDbName}?retryWrites=true&w=majority`, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 second timeout for Atlas
      });
      isAtlas = true;
      console.log('🔗 Connected to MongoDB Atlas');
    } catch (atlasError) {
      console.error('❌ Failed to connect to MongoDB Atlas:', atlasError.message);
      console.log('💡 Please check:');
      console.log('   - Network connectivity');
      console.log('   - IP whitelist in MongoDB Atlas');
      console.log('   - Connection string is correct');
      process.exit(1);
    }

    // We're already connected to the tenant database
    console.log(`✅ Connected to Tenant Database: ${tenantDbName}`);

    // Use mongoose connection as tenant connection
    const tenantConnection = mongoose.connection;

    // Ensure departments exist in tenant database
    const TenantDepartment = getTenantModel(tenantConnection, 'Department', Department.schema);
    const existingDepartments = await TenantDepartment.find({});

    if (existingDepartments.length === 0) {
      console.log('📁 Creating departments...');
      const departments = await TenantDepartment.insertMany([
        { name: 'Human Resources', code: 'HR', description: 'Human Resources Department', isActive: true },
        { name: 'Information Technology', code: 'IT', description: 'Information Technology Department', isActive: true },
        { name: 'Finance', code: 'FIN', description: 'Finance and Accounting Department', isActive: true },
        { name: 'Marketing', code: 'MKT', description: 'Marketing Department', isActive: true },
        { name: 'Operations', code: 'OPS', description: 'Operations Department', isActive: true },
        { name: 'Sales', code: 'SALES', description: 'Sales Department', isActive: true }
      ]);
      console.log(`✅ Created ${departments.length} departments`);
    }

    // Get all departments
    const departments = await TenantDepartment.find({});
    const deptMap = {};
    departments.forEach(dept => {
      deptMap[dept.name] = dept._id;
    });

    // Create Tenant Employee model
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);

    // Clear existing employees
    await TenantEmployee.deleteMany({});
    console.log('🧹 Cleared existing employees');

    // Create employees with proper department assignments
    const employeesWithDetails = sampleEmployees.map((emp, index) => {
      const employeeCount = index + 1;
      const employeeCode = `EMP${String(employeeCount).padStart(4, '0')}`;
      const departmentName = getDepartmentForDesignation(emp.designation);
      const departmentId = deptMap[departmentName];

      return {
        ...emp,
        employeeCode,
        department: departmentId,
        departmentId: departmentId,
        isActive: true,
        isFirstLogin: true,
        mustChangePassword: true,
        createdBy: tenantId // Link to tenant/client
      };
    });

    // Insert employees
    const employees = await TenantEmployee.insertMany(employeesWithDetails);
    console.log(`\n✅ Successfully created ${employees.length} employees:`);

    // Display created employees
    employees.forEach((emp, index) => {
      const dept = emp.departmentId ? departments.find(d => d._id.toString() === emp.departmentId.toString()) : null;
      const deptName = dept ? dept.name : 'Unknown';
      console.log(`  ${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.designation} - ${deptName}`);
    });

    // Department-wise summary
    console.log('\n📊 Department-wise distribution:');
    const deptCounts = {};
    employees.forEach(emp => {
      const dept = emp.departmentId ? departments.find(d => d._id.toString() === emp.departmentId.toString()) : null;
      const deptName = dept ? dept.name : 'Unknown';
      deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
    });

    Object.entries(deptCounts).forEach(([dept, count]) => {
      console.log(`  - ${dept}: ${count} employees`);
    });

    console.log('\n🎉 Employee seeding completed successfully!');
    console.log(`📧 All employees have email addresses in the format: firstname.lastname@company.com`);
    console.log('🔐 All employees are set for first-time login (mustChangePassword: true)');
    console.log('\n📋 Seeding Summary:');
    console.log(`   - Tenant Database: ${tenantDbName}`);
    console.log(`   - Total Employees: ${employees.length}`);
    if (isAtlas) {
      console.log('   - Database Type: MongoDB Atlas');
    } else {
      console.log('   - Database Type: Local MongoDB');
    }
    console.log('\n💡 Next Steps:');
    console.log('   - Employees can now login with their email addresses');
    console.log('   - All passwords must be changed on first login');
    console.log('   - HR can manage these employees through the HRMS interface');

  } catch (error) {
    console.error('❌ Error seeding employees:', error.message);

    // If database connection fails, show demo mode
    if (error.message.includes('ECONNREFUSED') || error.message.includes('querySrv')) {
      console.log('\n📋 DEMO MODE: Showing what would be seeded');
      console.log('==========================================');

      console.log('\n🎯 Sample employees that would be created:');
      sampleEmployees.forEach((emp, index) => {
        const employeeCode = `EMP${String(index + 1).padStart(4, '0')}`;
        const deptName = getDepartmentForDesignation(emp.designation);
        console.log(`  ${index + 1}. ${emp.firstName} ${emp.lastName} (${employeeCode}) - ${emp.designation} - ${deptName}`);
      });

      console.log('\n📊 Department distribution:');
      const deptCounts = {};
      sampleEmployees.forEach(emp => {
        const deptName = getDepartmentForDesignation(emp.designation);
        deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
      });

      Object.entries(deptCounts).forEach(([dept, count]) => {
        console.log(`  - ${dept}: ${count} employees`);
      });

      console.log('\n📧 All employees would have email format: firstname.lastname@company.com');
      console.log('🔐 All employees would be set for first-time login');

      console.log('\n💡 To run this script successfully:');
      console.log('   1. Ensure MongoDB is running (Atlas or local)');
      console.log('   2. Create a client first: node create-working-client-admin.js');
      console.log('   3. Then run: node seed-tenant-employees.js');
    } else {
      console.error('Stack:', error.stack);
    }
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Database connections closed');
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    process.exit(0);
  }
};

seedTenantEmployees();