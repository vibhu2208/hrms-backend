/**
 * Comprehensive Seed Script for TTS Company
 * Seeds: Managers, Employees, Attendance, Leaves, Projects, HR Users
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
const TenantUserSchema = require('../models/tenant/TenantUser');
const AttendanceModel = require('../models/Attendance');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const ProjectModel = require('../models/Project');
const ClientModel = require('../models/Client');

// Seed data configuration
const SEED_CONFIG = {
  managers: 3,
  employeesPerManager: { min: 3, max: 7 },
  hrUsers: 2,
  projects: 5,
  attendanceDays: 30, // Last 30 days
  leaveRequests: 10
};

// Departments
const DEPARTMENTS = [
  { name: 'Engineering', code: 'ENG' },
  { name: 'Sales', code: 'SAL' },
  { name: 'Marketing', code: 'MKT' },
  { name: 'Human Resources', code: 'HR' },
  { name: 'Finance', code: 'FIN' }
];

// Sample data
const FIRST_NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Kavya', 'Arjun', 'Neha', 'Karan', 'Pooja', 'Sanjay', 'Divya', 'Aditya', 'Riya', 'Manish', 'Shreya'];
const LAST_NAMES = ['Sharma', 'Kumar', 'Singh', 'Patel', 'Gupta', 'Reddy', 'Verma', 'Joshi', 'Mehta', 'Nair', 'Iyer', 'Desai', 'Rao', 'Pillai'];

const PROJECT_NAMES = ['ERP System', 'Mobile App', 'Cloud Migration', 'AI Chatbot', 'Data Analytics Platform'];
const PROJECT_DESCRIPTIONS = [
  'Enterprise Resource Planning system implementation',
  'Cross-platform mobile application development',
  'Migration of legacy systems to cloud infrastructure',
  'AI-powered customer service chatbot',
  'Real-time data analytics and reporting platform'
];

// Credentials storage
const CREDENTIALS = {
  managers: [],
  employees: [],
  hr: []
};

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName, lastName, role) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${role}@tts.com`;
}

function generatePhone() {
  return `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}

function getRandomDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

function getRandomDateRange(maxLength = 5) {
  const startOffset = Math.floor(Math.random() * 20);
  const duration = Math.max(1, Math.floor(Math.random() * maxLength));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - startOffset);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + duration);
  return { startDate, endDate, numberOfDays: duration + 1 };
}

function getRandomWorkingHours(status) {
  switch (status) {
    case 'present':
      return { workHours: 8, overtime: Math.random() > 0.8 ? 1 : 0 };
    case 'half-day':
      return { workHours: 4, overtime: 0 };
    case 'on-leave':
      return { workHours: 0, overtime: 0 };
    case 'late':
      return { workHours: 7, overtime: 0, lateBy: 30 };
    case 'early-departure':
      return { workHours: 6, overtime: 0, earlyDepartureBy: 45 };
    case 'absent':
    default:
      return { workHours: 0, overtime: 0 };
  }
}

function getRandomAttendanceStatus() {
  const statuses = ['present', 'present', 'present', 'present', 'present', 'on-leave', 'half-day', 'late'];
  return getRandomElement(statuses);
}

function getRandomLeaveStatus() {
  const statuses = ['approved', 'pending', 'rejected'];
  return getRandomElement(statuses);
}

function generateProjectName(index) {
  const adjectives = ['NextGen', 'Future', 'Quantum', 'Velocity', 'Pioneer', 'Synergy'];
  const nouns = ['Analytics', 'Connect', 'Portal', 'Insight', 'Fusion', 'Matrix'];
  return `${getRandomElement(adjectives)} ${getRandomElement(nouns)} ${index + 1}`;
}

async function seedTTSData() {
  try {
    console.log('🚀 Starting TTS Company Data Seeding...\n');

    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const CompanyRegistry = globalConnection.model('CompanyRegistry', CompanyRegistrySchema);

    // Find TTS company
    const ttsCompany = await CompanyRegistry.findOne({ 
      $or: [
        { companyCode: 'TTS' },
        { companyCode: 'TTS-001' },
        { companyName: /TTS/i }
      ]
    });
    if (!ttsCompany) {
      console.error('❌ TTS company not found. Please create it first.');
      process.exit(1);
    }

    console.log(`✅ Found TTS company: ${ttsCompany.companyName}`);
    console.log(`   Tenant DB: ${ttsCompany.tenantDatabaseName}\n`);

    // Connect to tenant database
    const tenantConnection = await getTenantConnection(ttsCompany.tenantDatabaseName);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const Attendance = tenantConnection.model('Attendance', AttendanceModel.schema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const Client = tenantConnection.model('Client', ClientModel.schema);
    const Project = tenantConnection.model('Project', ProjectModel.schema);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing employee data...');
    await TenantUser.deleteMany({ role: { $in: ['employee', 'manager', 'hr'] } });
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Project.deleteMany({});
    await Client.deleteMany({});

    console.log('\n📁 Using departments: Engineering, Sales, Marketing, HR, Finance');

    // Seed Managers
    console.log('\n👔 Seeding Managers...');
    const managers = [];
    const defaultPassword = 'Manager@123';

    for (let i = 0; i < SEED_CONFIG.managers; i++) {
      const firstName = getRandomElement(FIRST_NAMES);
      const lastName = getRandomElement(LAST_NAMES);
      const department = DEPARTMENTS[i % DEPARTMENTS.length].name;
      const email = generateEmail(firstName, lastName, 'manager');

      const manager = await TenantUser.create({
        firstName,
        lastName,
        email,
        password: defaultPassword, // Plain text - model will hash it
        phone: generatePhone(),
        role: 'manager',
        employeeCode: `MGR${String(i + 1).padStart(3, '0')}`,
        designation: 'Manager',
        department: department,
        joiningDate: getRandomDate(365),
        dateOfBirth: new Date(1985 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        isActive: true,
        isFirstLogin: false,
        mustChangePassword: false,
        salary: {
          basic: 80000,
          hra: 32000,
          allowances: 18000,
          total: 130000
        }
      });

      managers.push(manager);
      CREDENTIALS.managers.push({
        name: `${firstName} ${lastName}`,
        email,
        password: defaultPassword,
        role: 'Manager',
        employeeCode: manager.employeeCode,
        department: department
      });

      console.log(`   ✅ ${manager.employeeCode} - ${firstName} ${lastName} (${department})`);
    }

    // Seed Employees under each Manager
    console.log('\n👥 Seeding Employees...');
    const employees = [];
    const employeePassword = 'Employee@123';
    let empCount = 1;

    for (const manager of managers) {
      const numEmployees = getRandomNumber(SEED_CONFIG.employeesPerManager.min, SEED_CONFIG.employeesPerManager.max);
      console.log(`\n   Manager: ${manager.firstName} ${manager.lastName} - ${numEmployees} employees`);

      for (let i = 0; i < numEmployees; i++) {
        const firstName = getRandomElement(FIRST_NAMES);
        const lastName = getRandomElement(LAST_NAMES);
        const email = generateEmail(firstName, lastName, `emp${empCount}`);

        const employee = await TenantUser.create({
          firstName,
          lastName,
          email,
          password: employeePassword, // Plain text - model will hash it
          phone: generatePhone(),
          role: 'employee',
          employeeCode: `EMP${String(empCount).padStart(4, '0')}`,
          designation: getRandomElement(['Software Engineer', 'Senior Engineer', 'Team Lead', 'Associate', 'Analyst']),
          department: manager.department,
          reportingManager: manager.email.toLowerCase(),
          joiningDate: getRandomDate(180),
          dateOfBirth: new Date(1990 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: Math.random() > 0.5 ? 'Male' : 'Female',
          isActive: true,
          isFirstLogin: false,
          mustChangePassword: false,
          salary: {
            basic: 40000 + Math.floor(Math.random() * 30000),
            hra: 16000 + Math.floor(Math.random() * 12000),
            allowances: 9000 + Math.floor(Math.random() * 6000),
            total: 65000 + Math.floor(Math.random() * 48000)
          }
        });

        employees.push(employee);
        CREDENTIALS.employees.push({
          name: `${firstName} ${lastName}`,
          email,
          password: employeePassword,
          role: 'Employee',
          employeeCode: employee.employeeCode,
          manager: `${manager.firstName} ${manager.lastName}`,
          department: manager.department
        });

        console.log(`      ✅ ${employee.employeeCode} - ${firstName} ${lastName}`);
        empCount++;
      }
    }

    // Seed HR Users
    console.log('\n👔 Seeding HR Users...');
    const hrPassword = 'HR@123';

    for (let i = 0; i < SEED_CONFIG.hrUsers; i++) {
      const firstName = getRandomElement(FIRST_NAMES);
      const lastName = getRandomElement(LAST_NAMES);
      const department = DEPARTMENTS[3].name; // HR Department
      const email = generateEmail(firstName, lastName, `hr${i + 1}`);

      const hr = await TenantUser.create({
        firstName,
        lastName,
        email,
        password: hrPassword, // Plain text - model will hash it
        phone: generatePhone(),
        role: 'hr',
        employeeCode: `HR${String(i + 1).padStart(3, '0')}`,
        designation: i === 0 ? 'HR Manager' : 'HR Executive',
        department: department,
        joiningDate: getRandomDate(365),
        dateOfBirth: new Date(1985 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        isActive: true,
        isFirstLogin: false,
        mustChangePassword: false,
        salary: {
          basic: 60000,
          hra: 24000,
          allowances: 14000,
          total: 98000
        }
      });

      CREDENTIALS.hr.push({
        name: `${firstName} ${lastName}`,
        email,
        password: hrPassword,
        role: 'HR',
        employeeCode: hr.employeeCode,
        department: department
      });

      console.log(`   ✅ ${hr.employeeCode} - ${firstName} ${lastName}`);
    }

    // Seed Clients
    console.log('\n🤝 Seeding Clients...');
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const client = await Client.create({
        clientCode: `CLT${String(i + 1).padStart(3, '0')}`,
        name: `${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)}`,
        companyName: `${getRandomElement(['TechWave', 'Nimbus', 'Apex', 'Zenith', 'Vertex'])} Solutions`,
        email: `client${i + 1}@client.com`,
        phone: generatePhone(),
        address: {
          street: `${Math.floor(Math.random() * 200) + 1} ${getRandomElement(['Main St', 'Park Ave', 'Oak Road', 'Maple Street'])}`,
          city: getRandomElement(['Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Pune']),
          state: 'Maharashtra',
          zipCode: `${Math.floor(Math.random() * 900000) + 100000}`,
          country: 'India'
        },
        contactPerson: {
          name: `${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)}`,
          designation: getRandomElement(['CTO', 'Project Manager', 'Operations Head']),
          email: `contact${i + 1}@client.com`,
          phone: generatePhone()
        },
        contractDetails: {
          startDate: getRandomDate(180),
          endDate: getRandomDate(90),
          contractValue: 500000 + Math.floor(Math.random() * 500000),
          currency: 'INR'
        },
        billingType: getRandomElement(['per-month', 'per-day', 'fte'])
      });
      clients.push(client);
      console.log(`   ✅ ${client.clientCode} - ${client.companyName}`);
    }

    // Seed Projects
    console.log('\n📦 Seeding Projects...');
    const allEmployees = await TenantUser.find({ role: 'employee' });
    const allManagers = await TenantUser.find({ role: 'manager' });
    let projectCount = 0;

    for (let i = 0; i < SEED_CONFIG.projects; i++) {
      const manager = getRandomElement(allManagers);
      const client = clients[i % clients.length];
      const projectTeam = allEmployees
        .filter(emp => emp.reportingManager === manager.email)
        .sort(() => 0.5 - Math.random())
        .slice(0, getRandomNumber(3, 6));

      const project = await Project.create({
        projectCode: `PRJ${String(i + 1).padStart(4, '0')}`,
        name: generateProjectName(i),
        client: client._id,
        description: getRandomElement(PROJECT_DESCRIPTIONS),
        location: getRandomElement(['Mumbai', 'Bengaluru', 'Remote', 'Hyderabad']),
        startDate: getRandomDate(120),
        endDate: getRandomDate(30),
        status: getRandomElement(['planning', 'active', 'on-hold']),
        projectManager: manager._id,
        teamMembers: projectTeam.map(emp => ({
          employee: emp._id,
          role: getRandomElement(['Developer', 'QA Engineer', 'Business Analyst', 'UI Designer']),
          startDate: getRandomDate(90),
          billingRate: 500 + Math.floor(Math.random() * 500),
          billingType: getRandomElement(['per-day', 'per-month', 'fte']),
          isActive: true
        })),
        budget: {
          estimated: 200000 + Math.floor(Math.random() * 300000),
          actual: 150000 + Math.floor(Math.random() * 200000),
          currency: 'INR'
        }
      });

      projectCount++;
      console.log(`   ✅ ${project.projectCode} - ${project.name} (Manager: ${manager.firstName} ${manager.lastName})`);
    }

    // Seed Attendance Records
    console.log('\n🕒 Seeding Attendance Records...');
    const attendanceRecords = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - SEED_CONFIG.attendanceDays);

    for (const employee of allEmployees) {
      for (let day = 0; day < SEED_CONFIG.attendanceDays; day++) {
        const attendanceDate = new Date(startDate);
        attendanceDate.setDate(startDate.getDate() + day);

        // Skip weekends
        const dayOfWeek = attendanceDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }

        const status = getRandomAttendanceStatus();
        const hours = getRandomWorkingHours(status);

        attendanceRecords.push({
          employee: employee._id,
          date: attendanceDate,
          checkIn: status === 'present' || status === 'late' ? new Date(new Date(attendanceDate).setHours(9, 30)) : null,
          checkOut: status === 'present' || status === 'late' ? new Date(new Date(attendanceDate).setHours(18, 0)) : null,
          status,
          workHours: hours.workHours,
          overtime: hours.overtime || 0,
          lateBy: hours.lateBy || 0,
          earlyDepartureBy: hours.earlyDepartureBy || 0,
          location: getRandomElement(['office', 'remote']),
          totalBreakTime: status === 'present' ? 60 : 0
        });
      }
    }

    const attendanceCount = attendanceRecords.length;
    if (attendanceCount > 0) {
      await Attendance.insertMany(attendanceRecords);
    }
    console.log(`   ✅ Inserted ${attendanceCount} attendance records`);

    // Seed Leave Requests
    console.log('\n📝 Seeding Leave Requests...');
    const leaveTypes = ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs'];
    let leaveCount = 0;

    for (let i = 0; i < SEED_CONFIG.leaveRequests; i++) {
      const employee = getRandomElement(allEmployees);
      const manager = allManagers.find(m => m.email === employee.reportingManager);
      if (!manager) continue;

      const { startDate: leaveStart, endDate: leaveEnd, numberOfDays } = getRandomDateRange(3);
      const status = getRandomLeaveStatus();

      await LeaveRequest.create({
        employeeId: employee._id,
        employeeEmail: employee.email,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        leaveType: getRandomElement(leaveTypes),
        startDate: leaveStart,
        endDate: leaveEnd,
        numberOfDays,
        reason: getRandomElement([
          'Family emergency',
          'Annual vacation',
          'Health checkup',
          'Personal work',
          'Travel plan'
        ]),
        status,
        reportingManager: manager.email,
        approvedBy: status === 'approved' ? `${manager.firstName} ${manager.lastName}` : undefined,
        approvedByEmail: status === 'approved' ? manager.email : undefined,
        approvedOn: status === 'approved' ? new Date() : undefined,
        approvalComments: status === 'approved' ? 'Approved by seed data script' : undefined,
        rejectedBy: status === 'rejected' ? `${manager.firstName} ${manager.lastName}` : undefined,
        rejectedByEmail: status === 'rejected' ? manager.email : undefined,
        rejectedOn: status === 'rejected' ? new Date() : undefined,
        rejectionReason: status === 'rejected' ? 'Project priority' : undefined
      });

      leaveCount++;
    }
    console.log(`   ✅ Inserted ${leaveCount} leave requests`);

    // Close connections
    await globalConnection.close();
    await tenantConnection.close();

    // Save credentials to file
    console.log('\n💾 Saving credentials...');
    const fs = require('fs');
    const credentialsContent = `
# TTS Company - Seeded User Credentials
Generated: ${new Date().toLocaleString()}

## 🔐 Default Passwords
- **Managers:** Manager@123
- **Employees:** Employee@123
- **HR:** HR@123

---

## 👔 MANAGERS (${CREDENTIALS.managers.length})

${CREDENTIALS.managers.map((m, i) => `
### ${i + 1}. ${m.name}
- **Email:** ${m.email}
- **Password:** ${m.password}
- **Employee Code:** ${m.employeeCode}
- **Department:** ${m.department}
`).join('\n')}

---

## 👥 EMPLOYEES (${CREDENTIALS.employees.length})

${CREDENTIALS.employees.map((e, i) => `
${i + 1}. **${e.name}** | ${e.email} | ${e.password} | ${e.employeeCode} | Manager: ${e.manager}
`).join('\n')}

---

## 👔 HR USERS (${CREDENTIALS.hr.length})

${CREDENTIALS.hr.map((h, i) => `
### ${i + 1}. ${h.name}
- **Email:** ${h.email}
- **Password:** ${h.password}
- **Employee Code:** ${h.employeeCode}
- **Department:** ${h.department}
`).join('\n')}

---

## 📊 Summary
- **Total Managers:** ${CREDENTIALS.managers.length}
- **Total Employees:** ${CREDENTIALS.employees.length}
- **Total HR:** ${CREDENTIALS.hr.length}
- **Total Users:** ${CREDENTIALS.managers.length + CREDENTIALS.employees.length + CREDENTIALS.hr.length}
- **Attendance Records:** 0 (to be added)
- **Leave Requests:** 0 (to be added)
- **Projects:** 0 (to be added)

---

## 🚀 Quick Login URLs
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5000

## 📝 Notes
- All users have **isFirstLogin: false** and **mustChangePassword: false**
- Attendance records created for last ${SEED_CONFIG.attendanceDays} days
- Projects have random team assignments
- Leave requests have mixed statuses (approved/pending/rejected)
`;

    fs.writeFileSync('/Users/krishnaupadhyay/Desktop/hrms/TTS_CREDENTIALS.md', credentialsContent);
    console.log('   ✅ Credentials saved to: TTS_CREDENTIALS.md');

    console.log('\n✅ ========================================');
    console.log('✅ TTS Company Data Seeding Complete!');
    console.log('✅ ========================================\n');
    console.log(`📊 Summary:`);
    console.log(`   - Managers: ${CREDENTIALS.managers.length}`);
    console.log(`   - Employees: ${CREDENTIALS.employees.length}`);
    console.log(`   - HR Users: ${CREDENTIALS.hr.length}`);
    console.log(`   - Attendance Records: ${attendanceCount}`);
    console.log(`   - Leave Requests: ${leaveCount}`);
    console.log(`   - Projects: ${projectCount}`);
    console.log(`\n📄 Credentials file: TTS_CREDENTIALS.md\n`);

  } catch (error) {
    console.error('❌ Error seeding TTS data:', error);
    process.exit(1);
  }
}

// Run the seed script
seedTTSData()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
