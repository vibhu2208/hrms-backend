/**
 * Seed Employee Portal Data
 * Populates all fields and features for demonstration
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectGlobalDB, getTenantConnection, initializeTenantDatabase } = require('../config/database.config');
const Company = require('../models/Company');
const User = require('../models/User');

// Tenant schemas
const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const LeaveAccrualPolicySchema = require('../models/tenant/LeaveAccrualPolicy');
const LeaveEncashmentRuleSchema = require('../models/tenant/LeaveEncashmentRule');
const LeaveEncashmentRequestSchema = require('../models/tenant/LeaveEncashmentRequest');
const FamilyDetailSchema = require('../models/tenant/FamilyDetail');
const CertificationSchema = require('../models/tenant/Certification');
const ProfileUpdateRequestSchema = require('../models/tenant/ProfileUpdateRequest');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
const ApprovalMatrixSchema = require('../models/tenant/ApprovalMatrix');
const ShiftTemplateSchema = require('../models/tenant/ShiftTemplate');
const WorkScheduleSchema = require('../models/tenant/WorkSchedule');
const RosterAssignmentSchema = require('../models/tenant/RosterAssignment');

// Global models
const Attendance = require('../models/Attendance');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');

dotenv.config();

async function seedEmployeePortal() {
  try {
    console.log('🌱 Starting Employee Portal Seeding...');

    // Connect to global DB
    const globalConn = await connectGlobalDB();

    // Get Company model from global connection
    const CompanyModel = globalConn.model('Company', Company.schema);
    
    // Get or create demo company
    let company = await CompanyModel.findOne({ companyName: 'Demo Company' });
    if (!company) {
      company = await CompanyModel.create({
        companyName: 'Demo Company',
        email: 'demo@company.com',
        phone: '+91-1234567890',
        address: {
          street: '123 Demo Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        isActive: true
      });
      console.log('✅ Created demo company');
    }

    // Initialize tenant database if needed
    await initializeTenantDatabase(company._id);
    
    // Get tenant connection
    const tenantConnection = await getTenantConnection(company._id);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
    const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);
    const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
    const FamilyDetail = tenantConnection.model('FamilyDetail', FamilyDetailSchema);
    const Certification = tenantConnection.model('Certification', CertificationSchema);
    const ProfileUpdateRequest = tenantConnection.model('ProfileUpdateRequest', ProfileUpdateRequestSchema);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
    const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);
    const ShiftTemplate = tenantConnection.model('ShiftTemplate', ShiftTemplateSchema);
    const WorkSchedule = tenantConnection.model('WorkSchedule', WorkScheduleSchema);
    const RosterAssignment = tenantConnection.model('RosterAssignment', RosterAssignmentSchema);

    // Create demo employees
    const employees = [
      {
        firstName: 'Rajesh',
        lastName: 'Kumar',
        email: 'rajesh.kumar@demo.com',
        employeeCode: 'EMP001',
        designation: 'Software Engineer',
        department: 'IT',
        joiningDate: new Date('2023-01-15'),
        salary: { basic: 50000, total: 65000 },
        phone: '+91-9876543210',
        isActive: true,
        role: 'employee'
      },
      {
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya.sharma@demo.com',
        employeeCode: 'EMP002',
        designation: 'HR Manager',
        department: 'HR',
        joiningDate: new Date('2022-06-01'),
        salary: { basic: 80000, total: 100000 },
        phone: '+91-9876543211',
        isActive: true,
        role: 'hr'
      },
      {
        firstName: 'Amit',
        lastName: 'Patel',
        email: 'amit.patel@demo.com',
        employeeCode: 'EMP003',
        designation: 'Project Manager',
        department: 'IT',
        joiningDate: new Date('2021-03-10'),
        salary: { basic: 90000, total: 115000 },
        phone: '+91-9876543212',
        isActive: true,
        role: 'manager'
      },
      {
        firstName: 'Sneha',
        lastName: 'Reddy',
        email: 'sneha.reddy@demo.com',
        employeeCode: 'EMP004',
        designation: 'Senior Developer',
        department: 'IT',
        joiningDate: new Date('2023-08-20'),
        salary: { basic: 60000, total: 78000 },
        phone: '+91-9876543213',
        isActive: true,
        role: 'employee'
      }
    ];

    const createdEmployees = [];
    for (const empData of employees) {
      let employee = await TenantUser.findOne({ email: empData.email });
      if (!employee) {
        employee = await TenantUser.create({
          ...empData,
          companyId: company._id,
          password: '$2a$10$YourHashedPasswordHere' // In real scenario, hash properly
        });
        console.log(`✅ Created employee: ${employee.firstName} ${employee.lastName}`);
      }
      createdEmployees.push(employee);
    }

    // Create Leave Accrual Policies
    const accrualPolicies = [
      {
        leaveType: 'Personal Leave',
        accrualFrequency: 'monthly',
        accrualAmount: 1.5,
        proRataEnabled: true,
        carryForwardEnabled: true,
        maxCarryForward: 10,
        applicableFrom: new Date('2025-01-01'),
        isActive: true
      },
      {
        leaveType: 'Sick Leave',
        accrualFrequency: 'yearly',
        accrualAmount: 12,
        proRataEnabled: true,
        carryForwardEnabled: false,
        applicableFrom: new Date('2025-01-01'),
        isActive: true
      },
      {
        leaveType: 'Casual Leave',
        accrualFrequency: 'monthly',
        accrualAmount: 1,
        proRataEnabled: true,
        carryForwardEnabled: true,
        maxCarryForward: 5,
        applicableFrom: new Date('2025-01-01'),
        isActive: true
      }
    ];

    for (const policyData of accrualPolicies) {
      let policy = await LeaveAccrualPolicy.findOne({ leaveType: policyData.leaveType });
      if (!policy) {
        await LeaveAccrualPolicy.create({
          ...policyData,
          companyId: company._id
        });
        console.log(`✅ Created accrual policy: ${policyData.leaveType}`);
      }
    }

    // Create Leave Balances for 2025
    const currentYear = 2025;
    const leaveTypes = ['Personal Leave', 'Sick Leave', 'Casual Leave'];
    
    for (const employee of createdEmployees) {
      for (const leaveType of leaveTypes) {
        let balance = await LeaveBalance.findOne({
          employeeEmail: employee.email,
          year: currentYear,
          leaveType: leaveType
        });

        if (!balance) {
          const total = leaveType === 'Personal Leave' ? 18 : leaveType === 'Sick Leave' ? 12 : 12;
          const consumed = Math.floor(Math.random() * 5);
          const available = total - consumed;

          await LeaveBalance.create({
            employeeId: employee._id,
            employeeEmail: employee.email,
            year: currentYear,
            leaveType: leaveType,
            total: total,
            consumed: consumed,
            available: available,
            accrued: total,
            carriedForward: 0,
            lapsed: 0
          });
        }
      }
    }
    console.log('✅ Created leave balances');

    // Create Leave Requests
    const leaveRequests = [
      {
        employeeId: createdEmployees[0]._id,
        employeeEmail: createdEmployees[0].email,
        employeeName: `${createdEmployees[0].firstName} ${createdEmployees[0].lastName}`,
        leaveType: 'Personal Leave',
        startDate: new Date('2025-02-10'),
        endDate: new Date('2025-02-12'),
        numberOfDays: 3,
        reason: 'Family function',
        status: 'approved',
        appliedOn: new Date('2025-01-15')
      },
      {
        employeeId: createdEmployees[0]._id,
        employeeEmail: createdEmployees[0].email,
        employeeName: `${createdEmployees[0].firstName} ${createdEmployees[0].lastName}`,
        leaveType: 'Sick Leave',
        startDate: new Date('2025-02-20'),
        endDate: new Date('2025-02-20'),
        numberOfDays: 1,
        reason: 'Fever',
        status: 'pending',
        appliedOn: new Date('2025-01-20')
      },
      {
        employeeId: createdEmployees[3]._id,
        employeeEmail: createdEmployees[3].email,
        employeeName: `${createdEmployees[3].firstName} ${createdEmployees[3].lastName}`,
        leaveType: 'Casual Leave',
        startDate: new Date('2025-02-15'),
        endDate: new Date('2025-02-15'),
        numberOfDays: 1,
        reason: 'Personal work',
        status: 'approved',
        appliedOn: new Date('2025-01-18')
      }
    ];

    for (const requestData of leaveRequests) {
      await LeaveRequest.create({
        ...requestData,
        companyId: company._id
      });
    }
    console.log('✅ Created leave requests');

    // Create Leave Encashment Rules
    const encashmentRules = [
      {
        leaveType: 'Personal Leave',
        isEncashable: true,
        minBalance: 5,
        maxEncashable: 10,
        calculationMethod: 'basic_salary',
        eligibilityCriteria: {
          minServicePeriod: 6,
          minBalanceAfterEncashment: 5,
          maxEncashmentsPerYear: 2
        },
        applicableFrom: new Date('2025-01-01'),
        requiresApproval: true,
        isActive: true
      }
    ];

    for (const ruleData of encashmentRules) {
      let rule = await LeaveEncashmentRule.findOne({ leaveType: ruleData.leaveType });
      if (!rule) {
        await LeaveEncashmentRule.create({
          ...ruleData,
          companyId: company._id
        });
        console.log(`✅ Created encashment rule: ${ruleData.leaveType}`);
      }
    }

    // Create Family Details
    const familyDetails = [
      {
        employeeId: createdEmployees[0]._id,
        employeeEmail: createdEmployees[0].email,
        relationship: 'spouse',
        name: 'Rekha Kumar',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'female',
        isNominee: true,
        nomineeFor: ['PF', 'Gratuity'],
        nomineePercentage: 100
      },
      {
        employeeId: createdEmployees[0]._id,
        employeeEmail: createdEmployees[0].email,
        relationship: 'son',
        name: 'Rohan Kumar',
        dateOfBirth: new Date('2015-08-20'),
        gender: 'male',
        isNominee: false
      }
    ];

    for (const familyData of familyDetails) {
      await FamilyDetail.create({
        ...familyData,
        companyId: company._id
      });
    }
    console.log('✅ Created family details');

    // Create Certifications
    const certifications = [
      {
        employeeId: createdEmployees[0]._id,
        employeeEmail: createdEmployees[0].email,
        certificationName: 'AWS Certified Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: new Date('2023-06-01'),
        expiryDate: new Date('2026-06-01'),
        certificateNumber: 'AWS-12345',
        skills: ['Cloud Computing', 'AWS', 'Architecture'],
        isActive: true
      },
      {
        employeeId: createdEmployees[3]._id,
        employeeEmail: createdEmployees[3].email,
        certificationName: 'React Developer Certification',
        issuingOrganization: 'Meta',
        issueDate: new Date('2024-01-15'),
        expiryDate: null,
        certificateNumber: 'REACT-67890',
        skills: ['React', 'JavaScript', 'Frontend'],
        isActive: true
      }
    ];

    for (const certData of certifications) {
      await Certification.create({
        ...certData,
        companyId: company._id
      });
    }
    console.log('✅ Created certifications');

    // Create Approval Workflows
    const workflow = await ApprovalWorkflow.create({
      companyId: company._id,
      entityType: 'leave',
      workflowName: 'Standard Leave Approval',
      description: 'Two-level approval for leave requests',
      levels: [
        {
          level: 1,
          approverType: 'reporting_manager',
          isRequired: true
        },
        {
          level: 2,
          approverType: 'hr',
          isRequired: true
        }
      ],
      slaMinutes: 1440,
      isActive: true
    });
    console.log('✅ Created approval workflow');

    // Create Shift Templates
    const shiftTemplates = [
      {
        name: 'Day Shift',
        code: 'DAY01',
        startTime: '09:00',
        endTime: '18:00',
        breakDuration: 60,
        breakStartTime: '13:00',
        workHours: 8,
        applicableDays: [1, 2, 3, 4, 5], // Monday to Friday
        location: 'Mumbai Office',
        isNightShift: false
      },
      {
        name: 'Night Shift',
        code: 'NIGHT01',
        startTime: '18:00',
        endTime: '03:00',
        breakDuration: 60,
        breakStartTime: '22:00',
        workHours: 8,
        applicableDays: [1, 2, 3, 4, 5], // Monday to Friday
        location: 'Mumbai Office',
        isNightShift: true
      }
    ];

    for (const shiftData of shiftTemplates) {
      let shift = await ShiftTemplate.findOne({ name: shiftData.name });
      if (!shift) {
        await ShiftTemplate.create({
          ...shiftData,
          companyId: company._id
        });
        console.log(`✅ Created shift template: ${shiftData.name}`);
      }
    }

    // Create Work Schedules
    const dayShift = await ShiftTemplate.findOne({ name: 'Day Shift' });
    if (dayShift) {
      for (const employee of createdEmployees) {
        let schedule = await WorkSchedule.findOne({ employeeId: employee._id });
        if (!schedule) {
          await WorkSchedule.create({
            employeeId: employee._id,
            shiftTemplateId: dayShift._id,
            effectiveFrom: new Date('2025-01-01'),
            location: 'Mumbai Office',
            companyId: company._id
          });
        }
      }
      console.log('✅ Created work schedules');
    }

    // Create Sample Attendance Records
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
        for (const employee of createdEmployees) {
          const globalUser = await User.findOne({ email: employee.email });
          if (globalUser) {
            let attendance = await Attendance.findOne({
              employee: globalUser._id,
              date: date
            });

            if (!attendance) {
              const checkIn = new Date(date);
              checkIn.setHours(9, Math.floor(Math.random() * 30), 0);

              const checkOut = new Date(date);
              checkOut.setHours(18, Math.floor(Math.random() * 30), 0);

              await Attendance.create({
                employee: globalUser._id,
                date: date,
                checkIn: checkIn,
                checkOut: checkOut,
                status: 'present',
                workingHours: 8.5,
                lateBy: Math.random() > 0.7 ? Math.floor(Math.random() * 30) : 0
              });
            }
          }
        }
      }
    }
    console.log('✅ Created attendance records');

    // Create Sample Documents
    for (const employee of createdEmployees) {
      const globalUser = await User.findOne({ email: employee.email });
      if (globalUser) {
        await Document.create({
          employee: globalUser._id,
          documentName: 'PAN Card',
          documentType: 'PAN',
          documentUrl: '/documents/pan-card.pdf',
          expiryDate: new Date('2030-12-31'),
          status: 'active'
        });

        await Document.create({
          employee: globalUser._id,
          documentName: 'Aadhaar Card',
          documentType: 'Aadhaar',
          documentUrl: '/documents/aadhaar-card.pdf',
          status: 'active'
        });
      }
    }
    console.log('✅ Created documents');

    console.log('🎉 Employee Portal seeding completed successfully!');
    
    if (tenantConnection) await tenantConnection.close();
    if (globalConn) await globalConn.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding employee portal:', error);
    process.exit(1);
  }
}

// Run seeding
if (require.main === module) {
  seedEmployeePortal();
}

module.exports = seedEmployeePortal;

