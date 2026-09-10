/**
 * Lightweight role-user seeder — reuses existing tenant DB/collections
 * (avoids Atlas free-tier 500-collection limit).
 */
require('dotenv').config();
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

const mongoose = require('mongoose');
const { connectGlobalDB, getTenantConnection } = require('../src/config/database.config');
const SuperAdminSchema = require('../src/models/global/SuperAdmin');
const CompanyRegistrySchema = require('../src/models/global/CompanyRegistry');
const TenantUserSchema = require('../src/models/tenant/TenantUser');

const CREDS = {
  superAdmin: { email: 'superadmin@hrms.com', password: 'SuperAdmin@2025' },
  companyAdmin: { email: 'admin@tcs.com', password: 'TCSAdmin@2025', role: 'company_admin', firstName: 'TCS', lastName: 'Admin' },
  hr: { email: 'hr@tcs.com', password: 'TCSHR@2025', role: 'hr', firstName: 'HR', lastName: 'Lead' },
  manager: { email: 'manager@tcs.com', password: 'TCSManager@2025', role: 'manager', firstName: 'Team', lastName: 'Manager' },
  employee: { email: 'employee@tcs.com', password: 'TCSEmployee@2025', role: 'employee', firstName: 'John', lastName: 'Doe', department: 'Engineering', designation: 'Software Engineer', employeeCode: 'TCS001' },
};

async function upsertTenantUser(User, data) {
  const existing = await User.findOne({ email: data.email }).select('+password');
  if (existing) {
    existing.password = data.password;
    existing.role = data.role;
    existing.firstName = data.firstName;
    existing.lastName = data.lastName;
    existing.isActive = true;
    existing.isFirstLogin = false;
    existing.mustChangePassword = false;
    existing.authProvider = 'local';
    if (data.department) existing.department = data.department;
    if (data.designation) existing.designation = data.designation;
    if (data.employeeCode) existing.employeeCode = data.employeeCode;
    await existing.save();
    return { email: data.email, action: 'updated' };
  }
  const user = new User({
    ...data,
    isActive: true,
    isFirstLogin: false,
    mustChangePassword: false,
    authProvider: 'local',
  });
  await user.save();
  return { email: data.email, action: 'created' };
}

(async () => {
  const globalConn = await connectGlobalDB();
  if (!globalConn) throw new Error('Global DB connection failed');

  const SuperAdmin = globalConn.model('SuperAdmin', SuperAdminSchema);
  const Company = globalConn.model('CompanyRegistry', CompanyRegistrySchema);

  // Super admin
  let sa = await SuperAdmin.findOne({ email: CREDS.superAdmin.email }).select('+password');
  if (!sa) {
    sa = new SuperAdmin({
      email: CREDS.superAdmin.email,
      password: CREDS.superAdmin.password,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      isActive: true,
    });
  } else {
    sa.password = CREDS.superAdmin.password;
    sa.isActive = true;
  }
  await sa.save();
  console.log('SUPER_ADMIN', CREDS.superAdmin.email, 'ready');

  let company = await Company.findOne({ companyCode: 'TCS00001' });
  if (!company) company = await Company.findOne({ companyName: /tcs/i });
  if (!company) throw new Error('No TCS company found — run seed:tcs after freeing Atlas collections');

  const tenantKey = company.companyId || company.tenantDatabaseName?.replace(/^tenant_/, '') || company._id.toString();
  console.log('COMPANY', company.companyName, 'tenantKey', tenantKey, 'tenantDb', company.tenantDatabaseName);

  const tenant = await getTenantConnection(tenantKey);
  if (!tenant) throw new Error('Tenant connection failed');
  try {
    const cols = await tenant.db.listCollections().toArray();
    console.log('EXISTING_COLLECTIONS', cols.map((c) => c.name).join(', ') || '(none)');
  } catch (e) {
    console.log('listCollections skipped:', e.message);
  }

  const User = tenant.models.User || tenant.model('User', TenantUserSchema);

  const results = [];
  for (const key of ['companyAdmin', 'hr', 'manager', 'employee']) {
    results.push(await upsertTenantUser(User, CREDS[key]));
  }

  if (company.companyAdmin) {
    const admin = await User.findOne({ email: CREDS.companyAdmin.email });
    company.companyAdmin.email = CREDS.companyAdmin.email;
    if (admin) company.companyAdmin.userId = admin._id.toString();
    company.databaseStatus = 'active';
    company.status = 'active';
    await company.save();
  }

  console.log('\n=== SEEDED CREDENTIALS ===');
  console.log(JSON.stringify({
    company: company.companyName,
    companyCode: company.companyCode,
    results,
    logins: [
      { role: 'Super Admin', email: CREDS.superAdmin.email, password: CREDS.superAdmin.password, url: 'http://localhost:5173 (Super Admin login)' },
      { role: 'Company Admin', email: CREDS.companyAdmin.email, password: CREDS.companyAdmin.password, company: 'TCS' },
      { role: 'HR', email: CREDS.hr.email, password: CREDS.hr.password, company: 'TCS' },
      { role: 'Manager', email: CREDS.manager.email, password: CREDS.manager.password, company: 'TCS' },
      { role: 'Employee', email: CREDS.employee.email, password: CREDS.employee.password, company: 'TCS' },
    ],
  }, null, 2));

  process.exit(0);
})().catch((e) => {
  console.error('SEED_FAIL', e.message);
  process.exit(1);
});
