#!/usr/bin/env node
/**
 * Seed Roster Calendar Data for Every Employee
 *
 * Usage:
 *   node src/scripts/seedRosterCalendar.js [--companyCode=TTS] [--days=14]
 *
 * The script will:
 *   1. Locate the company in the global registry (default: TTS)
 *   2. Connect to the tenant database
 *   3. Ensure default shift templates exist (Day, Night)
 *   4. Generate work schedules for each day in the requested range
 *   5. Create roster assignments for every active employee
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectGlobalDB, getTenantConnection } = require('../config/database.config');
const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
const TenantUserSchema = require('../models/tenant/TenantUser');
const ShiftTemplateSchema = require('../models/tenant/ShiftTemplate');
const WorkScheduleSchema = require('../models/tenant/WorkSchedule');
const RosterAssignmentSchema = require('../models/tenant/RosterAssignment');

// ---- Configuration ----
const DEFAULT_COMPANY_CODE = 'TTS';
const DEFAULT_DAYS = 14;
const LOCATION = 'TTS Manufacturing Plant';
const NOTES = 'Seeded roster assignment';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key && value) {
      options[key.replace(/^--/, '')] = value;
    }
  }
  return options;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensureShiftTemplates(ShiftTemplate, companyId) {
  const templates = [
    {
      name: 'Day Shift',
      code: 'DAY01',
      startTime: '09:00',
      endTime: '18:00',
      breakDuration: 60,
      breakStartTime: '13:00',
      applicableDays: [1, 2, 3, 4, 5],
      isNightShift: false,
      location: LOCATION,
      description: 'Standard day shift'
    },
    {
      name: 'Night Shift',
      code: 'NIGHT01',
      startTime: '21:00',
      endTime: '06:00',
      breakDuration: 45,
      breakStartTime: '01:00',
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      isNightShift: true,
      location: LOCATION,
      description: 'Overnight operations shift'
    }
  ];

  const results = {};

  for (const templateData of templates) {
    let template = await ShiftTemplate.findOne({ code: templateData.code });
    if (!template) {
      template = await ShiftTemplate.create({
        ...templateData,
        createdBy: null,
        companyId
      });
      console.log(`   ✅ Created shift template: ${templateData.name}`);
    } else {
      console.log(`   ℹ️  Shift template already exists: ${templateData.name}`);
    }
    results[templateData.code] = template;
  }

  return results;
}

async function ensureWorkSchedule(WorkSchedule, date, shiftTemplateId, location) {
  const schedule = await WorkSchedule.findOneAndUpdate(
    {
      date,
      shiftTemplate: shiftTemplateId,
      location
    },
    {
      $setOnInsert: {
        isHoliday: false,
        isWeekend: false,
        notes: 'Seeded schedule',
        createdBy: null
      }
    },
    { upsert: true, new: true }
  );

  return schedule;
}

async function seedRosterCalendar() {
  const options = parseArgs();
  const companyCode = options.companyCode || DEFAULT_COMPANY_CODE;
  const days = parseInt(options.days || DEFAULT_DAYS, 10);

  if (Number.isNaN(days) || days <= 0) {
    throw new Error('Invalid days argument. Please provide a positive number.');
  }

  console.log('🌱 Seeding roster calendar');
  console.log(`   Company Code: ${companyCode}`);
  console.log(`   Days to seed: ${days}`);

  let globalConnection;
  let tenantConnection;

  try {
    globalConnection = await connectGlobalDB();
    if (!globalConnection) {
      throw new Error('Failed to establish global DB connection');
    }

    const CompanyRegistry = globalConnection.model('CompanyRegistry', CompanyRegistrySchema);

    const company = await CompanyRegistry.findOne({
      $or: [
        { companyCode: companyCode },
        { companyCode: `${companyCode}-001` },
        { companyName: new RegExp(companyCode, 'i') }
      ]
    });

    if (!company) {
      throw new Error(`Company not found for code/name: ${companyCode}`);
    }

    console.log(`✅ Found company: ${company.companyName}`);
    console.log(`   Tenant DB: ${company.tenantDatabaseName}`);

    tenantConnection = await getTenantConnection(company.tenantDatabaseName || company.companyId || company._id);

    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const ShiftTemplate = tenantConnection.model('ShiftTemplate', ShiftTemplateSchema);
    const WorkSchedule = tenantConnection.model('WorkSchedule', WorkScheduleSchema);
    const RosterAssignment = tenantConnection.model('RosterAssignment', RosterAssignmentSchema);

    const shiftTemplates = await ensureShiftTemplates(ShiftTemplate, company._id);

    const employees = await TenantUser.find({
      role: { $in: ['employee', 'manager', 'hr'] },
      isActive: true
    }).select('firstName lastName email departmentId role');

    if (employees.length === 0) {
      console.warn('⚠️  No active employees found. Nothing to seed.');
      return;
    }

    console.log(`👥 Active employees: ${employees.length}`);

    const startDate = startOfDay(new Date());
    const location = LOCATION;

    let assignmentCount = 0;

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      const dateKey = date.toISOString().split('T')[0];

      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const dayShiftSchedule = await ensureWorkSchedule(
        WorkSchedule,
        date,
        shiftTemplates.DAY01._id,
        location
      );

      const nightShiftSchedule = await ensureWorkSchedule(
        WorkSchedule,
        date,
        shiftTemplates.NIGHT01._id,
        location
      );

      for (let index = 0; index < employees.length; index++) {
        const employee = employees[index];

        const existing = await RosterAssignment.findOne({
          employeeId: employee._id,
          effectiveDate: date,
          status: 'active'
        });

        if (existing) {
          continue;
        }

        let shiftTemplate;
        let schedule;

        if (isWeekend) {
          // Alternate weekend coverage: half of employees on day shift, others night shift
          const useDayShift = (index + dayOffset) % 2 === 0;
          shiftTemplate = useDayShift ? shiftTemplates.DAY01 : shiftTemplates.NIGHT01;
          schedule = useDayShift ? dayShiftSchedule : nightShiftSchedule;
        } else {
          // Rotate employees between day and night shifts
          const useNightShift = (index + dayOffset) % 4 === 0; // roughly 25% night shift
          shiftTemplate = useNightShift ? shiftTemplates.NIGHT01 : shiftTemplates.DAY01;
          schedule = useNightShift ? nightShiftSchedule : dayShiftSchedule;
        }

        await RosterAssignment.create({
          employeeId: employee._id,
          employeeEmail: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          workScheduleId: schedule._id,
          shiftTemplateId: shiftTemplate._id,
          effectiveDate: date,
          endDate: date,
          status: 'active',
          location,
          department: employee.departmentId || null,
          assignedBy: null,
          notes: NOTES
        });

        assignmentCount++;
      }

      console.log(`   📆 ${dateKey}: seeded assignments for ${employees.length} employees`);
    }

    console.log(`
✅ Completed seeding roster calendar`);
    console.log(`   Total assignments created: ${assignmentCount}`);
    console.log(`   Range: ${startDate.toISOString().split('T')[0]} to ${new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().split('T')[0]}`);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
    if (globalConnection) {
      await globalConnection.close();
    }
    await mongoose.disconnect();
  }
}

seedRosterCalendar()
  .then(() => {
    console.log('🌟 Roster calendar seeding finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Roster calendar seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  });
