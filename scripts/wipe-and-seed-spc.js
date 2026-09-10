/**
 * Wipe ALL app databases, then seed SPC Management demo data:
 * - Super Admin
 * - Company Admin, HR, Manager
 * - Departments + many employees (users + employee records)
 *
 * Run: ALLOW_WIPE=1 node scripts/wipe-and-seed-spc.js
 * Never run against production.
 */
require('dotenv').config();

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('❌ Refusing to run wipe-and-seed while NODE_ENV=production');
  process.exit(1);
}
if (process.env.ALLOW_WIPE !== '1') {
  console.error('❌ Refusing to wipe databases. Re-run with ALLOW_WIPE=1 if you really intend this.');
  process.exit(1);
}

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

const mongoose = require('mongoose');
const {
  connectGlobalDB,
  getTenantConnection,
  initializeTenantDatabase,
  closeAllTenantConnections,
  closeGlobalConnection,
} = require('../src/config/database.config');
const SuperAdminSchema = require('../src/models/global/SuperAdmin');
const CompanyRegistrySchema = require('../src/models/global/CompanyRegistry');
const CompanyThemeSchema = require('../src/models/global/CompanyTheme');
const TenantUserSchema = require('../src/models/tenant/TenantUser');
const TenantEmployeeSchema = require('../src/models/tenant/TenantEmployee');
const DepartmentSchema = require('../src/models/Department').schema;

const CREDS = {
  superAdmin: { email: 'superadmin@hrms.com', password: 'SuperAdmin@2025' },
  companyAdmin: {
    email: 'admin@spc.com',
    password: 'SpcAdmin@2025',
    role: 'company_admin',
    firstName: 'Priya',
    lastName: 'Sharma',
  },
  hr: {
    email: 'hr@spc.com',
    password: 'SpcHR@2025',
    role: 'hr',
    firstName: 'Neha',
    lastName: 'Kapoor',
  },
  manager: {
    email: 'manager@spc.com',
    password: 'SpcManager@2025',
    role: 'manager',
    firstName: 'Rohan',
    lastName: 'Mehta',
  },
};

const DEPARTMENTS = [
  { name: 'Consulting', code: 'CONS', description: 'Client consulting engagements' },
  { name: 'Engineering', code: 'ENG', description: 'Software & platform engineering' },
  { name: 'Human Resources', code: 'HR', description: 'People operations' },
  { name: 'Finance', code: 'FIN', description: 'Finance and payroll' },
  { name: 'Operations', code: 'OPS', description: 'Delivery operations' },
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Ananya', 'Diya', 'Ira', 'Kiara', 'Myra',
  'Kabir', 'Reyansh', 'Ishaan', 'Shaurya', 'Atharv', 'Aisha', 'Saanvi', 'Pari', 'Riya', 'Meera',
  'James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Sophia', 'Lucas', 'Mia',
];
const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Gupta', 'Reddy', 'Nair', 'Iyer', 'Khan', 'Das', 'Joshi',
  'Chopra', 'Malhotra', 'Banerjee', 'Pillai', 'Verma', 'Anderson', 'Brown', 'Garcia', 'Wilson', 'Taylor',
];
const DESIGNATIONS = [
  'Software Engineer', 'Senior Consultant', 'Business Analyst', 'UI/UX Designer',
  'QA Engineer', 'DevOps Engineer', 'Project Coordinator', 'Data Analyst',
  'Associate Consultant', 'Technical Lead', 'Support Specialist', 'Payroll Executive',
];
const CITIES = [
  { city: 'Mumbai', state: 'MH', zip: '400001' },
  { city: 'Bengaluru', state: 'KA', zip: '560001' },
  { city: 'Hyderabad', state: 'TS', zip: '500001' },
  { city: 'Pune', state: 'MH', zip: '411001' },
  { city: 'Delhi', state: 'DL', zip: '110001' },
  { city: 'Chennai', state: 'TN', zip: '600001' },
  { city: 'New York', state: 'NY', zip: '10001' },
];
const GENDERS = ['male', 'female', 'other'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const MARITAL = ['single', 'married'];
const EMP_TYPES = ['full-time', 'contract-based', 'consultant', 'intern'];

const EMPLOYEE_PASSWORD = 'SpcEmp@2025';
const EMPLOYEE_COUNT = 18;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function slugEmail(first, last, i) {
  return `${first}.${last}${i}@spc.com`.toLowerCase().replace(/[^a-z0-9.@]/g, '');
}

function baseUriWithoutDb(mongoUri) {
  const [withoutQuery, query = ''] = mongoUri.split('?');
  const noDb = withoutQuery.replace(/\/[^/]*$/, '');
  return { noDb, query: query || 'retryWrites=true&w=majority' };
}

async function wipeAllDatabases(mongoUri) {
  console.log('\n🗑️  Wiping all application databases...');
  const { noDb, query } = baseUriWithoutDb(mongoUri);
  const adminUri = `${noDb}/admin?${query}`;
  const conn = await mongoose.createConnection(adminUri, {
    serverSelectionTimeoutMS: 30000,
    family: 4,
  }).asPromise();

  const { databases } = await conn.db.admin().listDatabases();
  const skip = new Set(['admin', 'local', 'config']);
  const targets = databases.filter((d) => !skip.has(d.name));
  console.log(`   Found ${targets.length} databases to drop`);

  for (const db of targets) {
    try {
      await conn.useDb(db.name).dropDatabase();
      console.log(`   ✓ Dropped ${db.name}`);
    } catch (err) {
      console.log(`   ✗ Failed ${db.name}: ${err.message}`);
    }
  }

  await conn.close();
  console.log('✅ Wipe complete\n');
}

async function createUser(User, data) {
  return User.create({
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone || `+91-98${String(randInt(10000000, 99999999))}`,
    role: data.role,
    department: data.department,
    designation: data.designation,
    employeeCode: data.employeeCode,
    employeeId: data.employeeId,
    reportingManager: data.reportingManager,
    joiningDate: data.joiningDate,
    isActive: true,
    isFirstLogin: false,
    mustChangePassword: false,
    authProvider: 'local',
  });
}

async function seedSpc() {
  const globalConn = await connectGlobalDB();
  if (!globalConn) throw new Error('Failed to connect to hrms_global');

  const SuperAdmin = globalConn.model('SuperAdmin', SuperAdminSchema);
  const CompanyRegistry = globalConn.model('CompanyRegistry', CompanyRegistrySchema);
  const CompanyTheme = globalConn.model('CompanyTheme', CompanyThemeSchema);

  console.log('👤 Creating Super Admin...');
  const superAdmin = await SuperAdmin.create({
    email: CREDS.superAdmin.email,
    password: CREDS.superAdmin.password,
    firstName: 'Super',
    lastName: 'Admin',
    phone: '+1-555-0000',
    role: 'superadmin',
    isActive: true,
  });
  console.log(`✅ ${superAdmin.email}`);

  console.log('\n🏢 Creating SPC Management company...');
  const companyId = new mongoose.Types.ObjectId().toString();
  const company = await CompanyRegistry.create({
    companyCode: 'SPC00001',
    companyId,
    companyName: 'SPC Management',
    email: 'admin@spc.com',
    phone: '+1-555-9999',
    website: 'https://spc.example.com',
    tenantDatabaseName: `tenant_${companyId}`,
    companyAdmin: { email: CREDS.companyAdmin.email },
    address: {
      street: '100 SPC Plaza',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    subscription: {
      plan: 'enterprise',
      status: 'active',
      maxEmployees: 1000,
      maxAdmins: 20,
      billingCycle: 'yearly',
    },
    enabledModules: [
      'hr', 'payroll', 'timesheet', 'attendance', 'recruitment',
      'performance', 'assets', 'compliance', 'projects', 'leave_management',
    ],
    status: 'active',
    databaseStatus: 'provisioning',
    isActive: true,
    onboardedBy: superAdmin._id,
    onboardedByModel: 'SuperAdmin',
  });
  console.log(`✅ ${company.companyName} → ${company.tenantDatabaseName}`);

  const theme = await CompanyTheme.create({
    companyId: company.companyId,
    colors: {
      primary: '#10b981',
      secondary: '#064e3b',
      accent: '#34d399',
      background: '#0f172a',
      text: '#f8fafc',
      cardBackground: '#1e293b',
    },
    loginPage: {
      welcomeMessage: 'Welcome to SPC Management',
      subtitle: 'Sign in to your SPC portal',
      showCompanyName: true,
      showLogo: true,
      showBackgroundImage: true,
    },
  });
  company.themeId = theme._id;
  await company.save();

  console.log('\n🗄️  Initializing tenant database...');
  let tenantConnection;
  try {
    tenantConnection = await initializeTenantDatabase(company.companyId);
  } catch (err) {
    console.log(`⚠️  Full init failed (${err.message}) — connecting anyway`);
    tenantConnection = await getTenantConnection(company.companyId);
  }

  const User = tenantConnection.model('User', TenantUserSchema);
  const Employee = tenantConnection.model('Employee', TenantEmployeeSchema);
  const Department = tenantConnection.model('Department', DepartmentSchema);

  console.log('\n🏬 Creating departments...');
  const deptDocs = {};
  for (const d of DEPARTMENTS) {
    const doc = await Department.create({ ...d, isActive: true });
    deptDocs[d.name] = doc;
    console.log(`   ✓ ${d.name}`);
  }

  console.log('\n👔 Creating Admin / HR / Manager logins...');
  const adminUser = await createUser(User, {
    ...CREDS.companyAdmin,
    department: 'Human Resources',
    designation: 'Company Administrator',
  });
  const hrUser = await createUser(User, {
    ...CREDS.hr,
    department: 'Human Resources',
    designation: 'HR Manager',
  });
  const managerUser = await createUser(User, {
    ...CREDS.manager,
    department: 'Consulting',
    designation: 'Delivery Manager',
  });
  console.log(`✅ ${adminUser.email}`);
  console.log(`✅ ${hrUser.email}`);
  console.log(`✅ ${managerUser.email}`);

  company.companyAdmin.userId = adminUser._id.toString();
  company.companyAdmin.createdAt = new Date();
  company.databaseStatus = 'active';
  company.status = 'active';
  await company.save();

  console.log(`\n👥 Creating ${EMPLOYEE_COUNT} employees with random data...`);
  const usedEmails = new Set([
    CREDS.companyAdmin.email,
    CREDS.hr.email,
    CREDS.manager.email,
  ]);
  const employeeLogins = [];

  for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
    let firstName = pick(FIRST_NAMES);
    let lastName = pick(LAST_NAMES);
    let email = slugEmail(firstName, lastName, i);
    let guard = 0;
    while (usedEmails.has(email) && guard < 20) {
      firstName = pick(FIRST_NAMES);
      lastName = pick(LAST_NAMES);
      email = slugEmail(firstName, lastName, i + guard);
      guard += 1;
    }
    usedEmails.add(email);

    const deptName = pick(DEPARTMENTS).name;
    const designation = pick(DESIGNATIONS);
    const loc = pick(CITIES);
    const employeeCode = `SPC${String(i).padStart(3, '0')}`;
    const joiningDate = daysAgo(randInt(30, 1200));
    const basic = randInt(35000, 180000);
    const hra = Math.round(basic * 0.4);
    const allowances = Math.round(basic * 0.15);
    const gender = pick(GENDERS);

    const empRecord = await Employee.create({
      firstName,
      lastName,
      email,
      phone: `+91-9${String(randInt(100000000, 999999999))}`,
      dateOfBirth: daysAgo(randInt(8000, 14000)),
      gender,
      bloodGroup: pick(BLOOD),
      maritalStatus: pick(MARITAL),
      address: {
        street: `${randInt(1, 200)} SPC Avenue`,
        city: loc.city,
        state: loc.state,
        zipCode: loc.zip,
        country: loc.city === 'New York' ? 'USA' : 'India',
      },
      employeeCode,
      joiningDate,
      designation,
      employmentType: pick(EMP_TYPES),
      department: deptName,
      departmentId: deptDocs[deptName]?._id,
      reportingManager: CREDS.manager.email,
      salary: {
        currency: loc.city === 'New York' ? 'USD' : 'INR',
        basic,
        hra,
        allowances,
        deductions: Math.round(basic * 0.08),
        total: basic + hra + allowances,
      },
      status: 'active',
      isActive: true,
      isExEmployee: false,
    });

    const loginUser = await createUser(User, {
      email,
      password: EMPLOYEE_PASSWORD,
      firstName,
      lastName,
      role: 'employee',
      department: deptName,
      designation,
      employeeCode,
      employeeId: empRecord._id,
      reportingManager: CREDS.manager.email,
      joiningDate,
      phone: empRecord.phone,
    });

    employeeLogins.push({
      email: loginUser.email,
      password: EMPLOYEE_PASSWORD,
      name: `${firstName} ${lastName}`,
      code: employeeCode,
      department: deptName,
      designation,
    });

    process.stdout.write(`   ✓ ${employeeCode} ${firstName} ${lastName}\n`);
  }

  return { company, employeeLogins };
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing in .env');

    await wipeAllDatabases(process.env.MONGODB_URI);
    await closeAllTenantConnections().catch(() => {});
    await closeGlobalConnection().catch(() => {});

    const { company, employeeLogins } = await seedSpc();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎉 FRESH SPC DEMO DATA SEEDED');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Company: ${company.companyName} (${company.companyCode})`);
    console.log('\nPrimary logins (SPC Portal):');
    console.log(`  Super Admin   ${CREDS.superAdmin.email} / ${CREDS.superAdmin.password}`);
    console.log(`  Admin         ${CREDS.companyAdmin.email} / ${CREDS.companyAdmin.password}`);
    console.log(`  HR            ${CREDS.hr.email} / ${CREDS.hr.password}`);
    console.log(`  Manager       ${CREDS.manager.email} / ${CREDS.manager.password}`);
    console.log(`\nEmployees (${employeeLogins.length}) — password for ALL: ${EMPLOYEE_PASSWORD}`);
    employeeLogins.slice(0, 8).forEach((e) => {
      console.log(`  ${e.code.padEnd(7)} ${e.email.padEnd(34)} ${e.department} / ${e.designation}`);
    });
    if (employeeLogins.length > 8) {
      console.log(`  ... and ${employeeLogins.length - 8} more`);
    }
    console.log('\nOpen http://localhost:5173 → Access SPC Portal');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌', err.message);
    console.error(err);
    process.exit(1);
  }
})();
