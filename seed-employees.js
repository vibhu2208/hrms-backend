const mongoose = require('mongoose');
const Employee = require('./src/models/Employee');
const Department = require('./src/models/Department');
require('dotenv').config();

const sampleEmployees = [
  {
    firstName: 'Rajesh',
    lastName: 'Kumar',
    email: 'rajesh.kumar@company.com',
    phone: '+91-9876543210',
    dateOfBirth: new Date('1985-03-15'),
    gender: 'male',
    bloodGroup: 'B+',
    maritalStatus: 'married',
    address: {
      street: '123 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560001',
      country: 'India'
    },
    designation: 'Senior Software Engineer',
    joiningDate: new Date('2020-01-15'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 85001,
      hra: 34000,
      allowances: 10000,
      deductions: 5001,
      total: 124000
    },
    bankDetails: {
      accountNumber: '1234567890123456',
      bankName: 'HDFC Bank',
      ifscCode: 'HDFC0001234',
      accountHolderName: 'Rajesh Kumar',
      branch: 'Bangalore Main'
    },
    emergencyContact: {
      name: 'Priya Kumar',
      relationship: 'wife',
      phone: '+91-9876543211'
    }
  },
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@company.com',
    phone: '+91-9876543212',
    dateOfBirth: new Date('1990-07-22'),
    gender: 'female',
    bloodGroup: 'A+',
    maritalStatus: 'single',
    address: {
      street: '456 Brigade Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560025',
      country: 'India'
    },
    designation: 'HR Manager',
    joiningDate: new Date('2019-06-01'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 75001,
      hra: 30000,
      allowances: 8000,
      deductions: 4000,
      total: 107000
    },
    bankDetails: {
      accountNumber: '1234567890123457',
      bankName: 'ICICI Bank',
      ifscCode: 'ICIC0001234',
      accountHolderName: 'Priya Sharma',
      branch: 'Bangalore'
    },
    emergencyContact: {
      name: 'Vikram Sharma',
      relationship: 'brother',
      phone: '+91-9876543213'
    }
  },
  {
    firstName: 'Amit',
    lastName: 'Patel',
    email: 'amit.patel@company.com',
    phone: '+91-9876543214',
    dateOfBirth: new Date('1988-11-08'),
    gender: 'male',
    bloodGroup: 'O+',
    maritalStatus: 'married',
    address: {
      street: '789 Residency Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560025',
      country: 'India'
    },
    designation: 'Finance Manager',
    joiningDate: new Date('2018-03-20'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 90000,
      hra: 36000,
      allowances: 12000,
      deductions: 6000,
      total: 132000
    },
    bankDetails: {
      accountNumber: '1234567890123458',
      bankName: 'SBI',
      ifscCode: 'SBIN0001234',
      accountHolderName: 'Amit Patel',
      branch: 'Bangalore'
    },
    emergencyContact: {
      name: 'Kavita Patel',
      relationship: 'wife',
      phone: '+91-9876543215'
    }
  },
  {
    firstName: 'Sneha',
    lastName: 'Reddy',
    email: 'sneha.reddy@company.com',
    phone: '+91-9876543216',
    dateOfBirth: new Date('1992-05-30'),
    gender: 'female',
    bloodGroup: 'AB+',
    maritalStatus: 'single',
    address: {
      street: '321 Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560034',
      country: 'India'
    },
    designation: 'Marketing Specialist',
    joiningDate: new Date('2021-09-10'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 55001,
      hra: 22000,
      allowances: 6000,
      deductions: 3000,
      total: 80000
    },
    bankDetails: {
      accountNumber: '1234567890123459',
      bankName: 'Axis Bank',
      ifscCode: 'UTIB0001234',
      accountHolderName: 'Sneha Reddy',
      branch: 'Koramangala'
    },
    emergencyContact: {
      name: 'Arjun Reddy',
      relationship: 'brother',
      phone: '+91-9876543217'
    }
  },
  {
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'vikram.singh@company.com',
    phone: '+91-9876543218',
    dateOfBirth: new Date('1983-12-12'),
    gender: 'male',
    bloodGroup: 'B-',
    maritalStatus: 'married',
    address: {
      street: '654 Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560038',
      country: 'India'
    },
    designation: 'Operations Manager',
    joiningDate: new Date('2017-11-05'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 80000,
      hra: 32000,
      allowances: 10000,
      deductions: 5001,
      total: 117000
    },
    bankDetails: {
      accountNumber: '1234567890123460',
      bankName: 'Punjab National Bank',
      ifscCode: 'PUNB0001234',
      accountHolderName: 'Vikram Singh',
      branch: 'Indiranagar'
    },
    emergencyContact: {
      name: 'Meera Singh',
      relationship: 'wife',
      phone: '+91-9876543219'
    }
  },
  {
    firstName: 'Anjali',
    lastName: 'Gupta',
    email: 'anjali.gupta@company.com',
    phone: '+91-9876543220',
    dateOfBirth: new Date('1991-08-25'),
    gender: 'female',
    bloodGroup: 'A-',
    maritalStatus: 'single',
    address: {
      street: '987 Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560066',
      country: 'India'
    },
    designation: 'Software Developer',
    joiningDate: new Date('2022-02-14'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 65001,
      hra: 26000,
      allowances: 7000,
      deductions: 3500,
      total: 94500
    },
    bankDetails: {
      accountNumber: '1234567890123461',
      bankName: 'Kotak Mahindra Bank',
      ifscCode: 'KKBK0001234',
      accountHolderName: 'Anjali Gupta',
      branch: 'Whitefield'
    },
    emergencyContact: {
      name: 'Rohit Gupta',
      relationship: 'brother',
      phone: '+91-9876543221'
    }
  },
  {
    firstName: 'Rohit',
    lastName: 'Mehra',
    email: 'rohit.mehra@company.com',
    phone: '+91-9876543222',
    dateOfBirth: new Date('1987-04-18'),
    gender: 'male',
    bloodGroup: 'O-',
    maritalStatus: 'married',
    address: {
      street: '147 HSR Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560102',
      country: 'India'
    },
    designation: 'Sales Manager',
    joiningDate: new Date('2019-08-12'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 70000,
      hra: 28000,
      allowances: 15001,
      deductions: 4000,
      total: 109000
    },
    bankDetails: {
      accountNumber: '1234567890123462',
      bankName: 'Yes Bank',
      ifscCode: 'YESB0001234',
      accountHolderName: 'Rohit Mehra',
      branch: 'HSR Layout'
    },
    emergencyContact: {
      name: 'Pooja Mehra',
      relationship: 'wife',
      phone: '+91-9876543223'
    }
  },
  {
    firstName: 'Kavita',
    lastName: 'Agarwal',
    email: 'kavita.agarwal@company.com',
    phone: '+91-9876543224',
    dateOfBirth: new Date('1989-01-10'),
    gender: 'female',
    bloodGroup: 'B+',
    maritalStatus: 'married',
    address: {
      street: '258 JP Nagar',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560078',
      country: 'India'
    },
    designation: 'Business Analyst',
    joiningDate: new Date('2020-07-30'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 60000,
      hra: 24000,
      allowances: 8000,
      deductions: 3000,
      total: 89000
    },
    bankDetails: {
      accountNumber: '1234567890123463',
      bankName: 'Canara Bank',
      ifscCode: 'CNRB0001234',
      accountHolderName: 'Kavita Agarwal',
      branch: 'JP Nagar'
    },
    emergencyContact: {
      name: 'Suresh Agarwal',
      relationship: 'husband',
      phone: '+91-9876543225'
    }
  },
  {
    firstName: 'Deepak',
    lastName: 'Verma',
    email: 'deepak.verma@company.com',
    phone: '+91-9876543226',
    dateOfBirth: new Date('1993-06-05'),
    gender: 'male',
    bloodGroup: 'AB-',
    maritalStatus: 'single',
    address: {
      street: '369 BTM Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560076',
      country: 'India'
    },
    designation: 'Junior Developer',
    joiningDate: new Date('2023-01-20'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 45001,
      hra: 18000,
      allowances: 5001,
      deductions: 2500,
      total: 65500
    },
    bankDetails: {
      accountNumber: '1234567890123464',
      bankName: 'Union Bank',
      ifscCode: 'UBIN0001234',
      accountHolderName: 'Deepak Verma',
      branch: 'BTM Layout'
    },
    emergencyContact: {
      name: 'Sunita Verma',
      relationship: 'mother',
      phone: '+91-9876543227'
    }
  },
  {
    firstName: 'Meera',
    lastName: 'Iyer',
    email: 'meera.iyer@company.com',
    phone: '+91-9876543228',
    dateOfBirth: new Date('1986-09-14'),
    gender: 'female',
    bloodGroup: 'A+',
    maritalStatus: 'married',
    address: {
      street: '741 Rajajinagar',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560010',
      country: 'India'
    },
    designation: 'Quality Assurance Lead',
    joiningDate: new Date('2018-12-03'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 72000,
      hra: 28800,
      allowances: 9000,
      deductions: 4500,
      total: 105300
    },
    bankDetails: {
      accountNumber: '1234567890123465',
      bankName: 'Bank of Baroda',
      ifscCode: 'BARB0001234',
      accountHolderName: 'Meera Iyer',
      branch: 'Rajajinagar'
    },
    emergencyContact: {
      name: 'Karthik Iyer',
      relationship: 'husband',
      phone: '+91-9876543229'
    }
  },
  {
    firstName: 'Suresh',
    lastName: 'Nair',
    email: 'suresh.nair@company.com',
    phone: '+91-9876543230',
    dateOfBirth: new Date('1984-02-28'),
    gender: 'male',
    bloodGroup: 'O+',
    maritalStatus: 'married',
    address: {
      street: '852 Malleswaram',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560003',
      country: 'India'
    },
    designation: 'DevOps Engineer',
    joiningDate: new Date('2019-05-18'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 78000,
      hra: 31200,
      allowances: 10000,
      deductions: 5001,
      total: 114200
    },
    bankDetails: {
      accountNumber: '1234567890123466',
      bankName: 'Indian Bank',
      ifscCode: 'IDIB0001234',
      accountHolderName: 'Suresh Nair',
      branch: 'Malleswaram'
    },
    emergencyContact: {
      name: 'Lakshmi Nair',
      relationship: 'wife',
      phone: '+91-9876543231'
    }
  },
  {
    firstName: 'Pooja',
    lastName: 'Joshi',
    email: 'pooja.joshi@company.com',
    phone: '+91-9876543232',
    dateOfBirth: new Date('1994-11-20'),
    gender: 'female',
    bloodGroup: 'B+',
    maritalStatus: 'single',
    address: {
      street: '963 Jayanagar',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560011',
      country: 'India'
    },
    designation: 'UI/UX Designer',
    joiningDate: new Date('2022-06-15'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 58000,
      hra: 23200,
      allowances: 7000,
      deductions: 3500,
      total: 84700
    },
    bankDetails: {
      accountNumber: '1234567890123467',
      bankName: 'Central Bank',
      ifscCode: 'CBIN0001234',
      accountHolderName: 'Pooja Joshi',
      branch: 'Jayanagar'
    },
    emergencyContact: {
      name: 'Manoj Joshi',
      relationship: 'father',
      phone: '+91-9876543233'
    }
  },
  {
    firstName: 'Arjun',
    lastName: 'Pillai',
    email: 'arjun.pillai@company.com',
    phone: '+91-9876543234',
    dateOfBirth: new Date('1981-07-07'),
    gender: 'male',
    bloodGroup: 'A+',
    maritalStatus: 'married',
    address: {
      street: '159 Richmond Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560025',
      country: 'India'
    },
    designation: 'Project Manager',
    joiningDate: new Date('2016-10-25'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 95001,
      hra: 38000,
      allowances: 15001,
      deductions: 7000,
      total: 141000
    },
    bankDetails: {
      accountNumber: '1234567890123468',
      bankName: 'Vijaya Bank',
      ifscCode: 'VIJB0001234',
      accountHolderName: 'Arjun Pillai',
      branch: 'Richmond Road'
    },
    emergencyContact: {
      name: 'Divya Pillai',
      relationship: 'wife',
      phone: '+91-9876543235'
    }
  },
  {
    firstName: 'Ritu',
    lastName: 'Saxena',
    email: 'ritu.saxena@company.com',
    phone: '+91-9876543236',
    dateOfBirth: new Date('1990-12-01'),
    gender: 'female',
    bloodGroup: 'O+',
    maritalStatus: 'single',
    address: {
      street: '357 Cunningham Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560052',
      country: 'India'
    },
    designation: 'Content Writer',
    joiningDate: new Date('2021-11-08'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 48000,
      hra: 19200,
      allowances: 5001,
      deductions: 2500,
      total: 69700
    },
    bankDetails: {
      accountNumber: '1234567890123469',
      bankName: 'Dena Bank',
      ifscCode: 'BKDN0001234',
      accountHolderName: 'Ritu Saxena',
      branch: 'Cunningham Road'
    },
    emergencyContact: {
      name: 'Rajeev Saxena',
      relationship: 'father',
      phone: '+91-9876543237'
    }
  },
  {
    firstName: 'Kiran',
    lastName: 'Desai',
    email: 'kiran.desai@company.com',
    phone: '+91-9876543238',
    dateOfBirth: new Date('1985-05-17'),
    gender: 'male',
    bloodGroup: 'AB+',
    maritalStatus: 'married',
    address: {
      street: '468 St. Marks Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560001',
      country: 'India'
    },
    designation: 'System Administrator',
    joiningDate: new Date('2017-08-22'),
    employmentType: 'full-time',
    status: 'active',
    salary: {
      basic: 62000,
      hra: 24800,
      allowances: 8000,
      deductions: 4000,
      total: 90800
    },
    bankDetails: {
      accountNumber: '1234567890123470',
      bankName: 'Oriental Bank',
      ifscCode: 'ORBC0001234',
      accountHolderName: 'Kiran Desai',
      branch: 'St. Marks Road'
    },
    emergencyContact: {
      name: 'Nisha Desai',
      relationship: 'wife',
      phone: '+91-9876543239'
    }
  }
];

const seedEmployees = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get existing departments
    const departments = await Department.find({});
    console.log(`Found ${departments.length} departments`);

    if (departments.length === 0) {
      console.log('No departments found. Please run department seeding first:');
      console.log('node seed-departments.js');
      process.exit(1);
    }

    // Clear existing employees
    await Employee.deleteMany({});
    console.log('Cleared existing employees');

    // Map departments for easy lookup
    const deptMap = {};
    departments.forEach(dept => {
      deptMap[dept.name] = dept._id;
    });

    // Assign departments and reporting managers to employees
    const employeesWithDetails = sampleEmployees.map((emp, index) => {
      let departmentId = null;

      // Assign departments based on designation
      switch (emp.designation.toLowerCase()) {
        case 'hr manager':
          departmentId = deptMap['Human Resources'];
          break;
        case 'senior software engineer':
        case 'software developer':
        case 'junior developer':
        case 'devops engineer':
        case 'system administrator':
          departmentId = deptMap['Information Technology'];
          break;
        case 'finance manager':
          departmentId = deptMap['Finance'];
          break;
        case 'marketing specialist':
          departmentId = deptMap['Marketing'];
          break;
        case 'operations manager':
          departmentId = deptMap['Operations'];
          break;
        case 'sales manager':
          departmentId = deptMap['Sales'];
          break;
        default:
          // Assign to IT as default
          departmentId = deptMap['Information Technology'];
      }

      return {
        ...emp,
        employeeCode: `EMP${String(index + 1).padStart(5, '0')}`, // Generate employee code manually
        department: departmentId,
        reportingManager: undefined // Will be set later after employees are created
      };
    });

    // Insert sample employees
    const employees = await Employee.insertMany(employeesWithDetails);
    console.log(`\n✅ Created ${employees.length} sample employees:`);

    employees.forEach((emp, index) => {
      console.log(`  ${index + 1}. ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - ${emp.designation}`);
    });

    console.log('\n📋 Department-wise distribution:');
    const deptCounts = {};
    employees.forEach(emp => {
      const deptName = departments.find(d => d._id.toString() === emp.department.toString())?.name || 'Unknown';
      deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
    });

    Object.entries(deptCounts).forEach(([dept, count]) => {
      console.log(`  - ${dept}: ${count} employees`);
    });

    console.log('\n🎉 Employee database seeded successfully!');
    console.log('\n💡 Tip: Employee codes are auto-generated as EMP00001, EMP00002, etc.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedEmployees();
