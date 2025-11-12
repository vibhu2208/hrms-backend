const mongoose = require('mongoose');
const Module = require('../models/Module');
require('dotenv').config();

const modules = [
  {
    moduleId: 'hr',
    name: 'Human Resources',
    displayName: 'HR Management',
    description: 'Core HR functionalities including employee management, organizational structure, and basic HR operations',
    category: 'core',
    version: '2.1.0',
    icon: 'users',
    color: '#3B82F6',
    dependencies: [],
    features: [
      {
        featureId: 'employee_management',
        name: 'Employee Management',
        description: 'Add, edit, and manage employee profiles',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'department_management',
        name: 'Department Management',
        description: 'Organize employees into departments and teams',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'employee_directory',
        name: 'Employee Directory',
        description: 'Searchable employee directory with contact information',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'org_chart',
        name: 'Organization Chart',
        description: 'Visual organization chart and reporting structure',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'professional'
      }
    ],
    pricing: {
      basePrice: 0,
      billingType: 'included',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: -1,
      defaultStorageQuota: 2000,
      defaultApiCalls: 5000
    },
    isCore: true,
    status: 'active'
  },
  {
    moduleId: 'payroll',
    name: 'Payroll Management',
    displayName: 'Payroll & Compensation',
    description: 'Comprehensive payroll processing, salary management, and compensation tracking',
    category: 'advanced',
    version: '1.8.0',
    icon: 'dollar-sign',
    color: '#10B981',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'salary_processing',
        name: 'Salary Processing',
        description: 'Automated salary calculations and processing',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'tax_calculations',
        name: 'Tax Calculations',
        description: 'Automatic tax deductions and calculations',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'payslip_generation',
        name: 'Payslip Generation',
        description: 'Generate and distribute digital payslips',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'bonus_management',
        name: 'Bonus Management',
        description: 'Manage bonuses, incentives, and variable pay',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 15,
      billingType: 'per_user',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 1000,
      defaultStorageQuota: 5000,
      defaultApiCalls: 10000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'timesheet',
    name: 'Timesheet Management',
    displayName: 'Time Tracking',
    description: 'Time tracking, project time allocation, and timesheet management',
    category: 'advanced',
    version: '1.5.0',
    icon: 'clock',
    color: '#F59E0B',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'time_tracking',
        name: 'Time Tracking',
        description: 'Track work hours and break times',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'project_time_allocation',
        name: 'Project Time Allocation',
        description: 'Allocate time to specific projects and tasks',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'overtime_tracking',
        name: 'Overtime Tracking',
        description: 'Track and manage overtime hours',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'professional'
      },
      {
        featureId: 'timesheet_approval',
        name: 'Timesheet Approval',
        description: 'Manager approval workflow for timesheets',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 8,
      billingType: 'per_user',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 2000,
      defaultStorageQuota: 1000,
      defaultApiCalls: 8000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'attendance',
    name: 'Attendance Management',
    displayName: 'Attendance & Leave',
    description: 'Employee attendance tracking, leave management, and scheduling',
    category: 'core',
    version: '2.0.0',
    icon: 'calendar-check',
    color: '#8B5CF6',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'attendance_tracking',
        name: 'Attendance Tracking',
        description: 'Track daily attendance and working hours',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'leave_management',
        name: 'Leave Management',
        description: 'Manage leave requests and approvals',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'starter'
      },
      {
        featureId: 'shift_scheduling',
        name: 'Shift Scheduling',
        description: 'Create and manage work shifts',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'professional'
      },
      {
        featureId: 'biometric_integration',
        name: 'Biometric Integration',
        description: 'Integration with biometric attendance systems',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 5,
      billingType: 'per_user',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 3000,
      defaultStorageQuota: 1500,
      defaultApiCalls: 6000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'recruitment',
    name: 'Recruitment Management',
    displayName: 'Talent Acquisition',
    description: 'End-to-end recruitment process management and candidate tracking',
    category: 'advanced',
    version: '1.6.0',
    icon: 'user-plus',
    color: '#EF4444',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'job_posting',
        name: 'Job Posting',
        description: 'Create and publish job openings',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'candidate_tracking',
        name: 'Candidate Tracking',
        description: 'Track candidates through recruitment pipeline',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'interview_scheduling',
        name: 'Interview Scheduling',
        description: 'Schedule and manage interviews',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'offer_management',
        name: 'Offer Management',
        description: 'Generate and track job offers',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 20,
      billingType: 'per_user',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: 10,
      defaultMaxTransactions: 500,
      defaultStorageQuota: 3000,
      defaultApiCalls: 5000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'performance',
    name: 'Performance Management',
    displayName: 'Performance & Reviews',
    description: 'Employee performance tracking, reviews, and goal management',
    category: 'premium',
    version: '1.4.0',
    icon: 'trending-up',
    color: '#06B6D4',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'performance_reviews',
        name: 'Performance Reviews',
        description: 'Conduct periodic performance evaluations',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'goal_setting',
        name: 'Goal Setting',
        description: 'Set and track employee goals and objectives',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'enterprise'
      },
      {
        featureId: '360_feedback',
        name: '360-Degree Feedback',
        description: 'Comprehensive feedback from peers and managers',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'kpi_tracking',
        name: 'KPI Tracking',
        description: 'Track key performance indicators',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 25,
      billingType: 'per_user',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 200,
      defaultStorageQuota: 2000,
      defaultApiCalls: 3000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'assets',
    name: 'Asset Management',
    displayName: 'IT Assets & Equipment',
    description: 'Manage company assets, equipment allocation, and inventory tracking',
    category: 'addon',
    version: '1.3.0',
    icon: 'monitor',
    color: '#84CC16',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'asset_tracking',
        name: 'Asset Tracking',
        description: 'Track company assets and equipment',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'asset_allocation',
        name: 'Asset Allocation',
        description: 'Allocate assets to employees',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'professional'
      },
      {
        featureId: 'maintenance_tracking',
        name: 'Maintenance Tracking',
        description: 'Track asset maintenance and repairs',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'depreciation_calculation',
        name: 'Depreciation Calculation',
        description: 'Calculate asset depreciation over time',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 10,
      billingType: 'fixed_monthly',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 1000,
      defaultStorageQuota: 1000,
      defaultApiCalls: 2000
    },
    isCore: false,
    status: 'active'
  },
  {
    moduleId: 'compliance',
    name: 'Compliance Management',
    displayName: 'Legal & Compliance',
    description: 'Manage legal compliance, document management, and regulatory requirements',
    category: 'premium',
    version: '1.2.0',
    icon: 'shield-check',
    color: '#F97316',
    dependencies: [
      {
        moduleId: 'hr',
        version: '2.0.0',
        required: true
      }
    ],
    features: [
      {
        featureId: 'document_management',
        name: 'Document Management',
        description: 'Manage compliance documents and certificates',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'audit_trails',
        name: 'Audit Trails',
        description: 'Comprehensive audit logging and tracking',
        isCore: true,
        requiresUpgrade: false,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'regulatory_reporting',
        name: 'Regulatory Reporting',
        description: 'Generate compliance and regulatory reports',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      },
      {
        featureId: 'policy_management',
        name: 'Policy Management',
        description: 'Manage company policies and procedures',
        isCore: false,
        requiresUpgrade: true,
        minimumPlan: 'enterprise'
      }
    ],
    pricing: {
      basePrice: 30,
      billingType: 'fixed_monthly',
      currency: 'USD'
    },
    limits: {
      defaultMaxUsers: -1,
      defaultMaxTransactions: 100,
      defaultStorageQuota: 5000,
      defaultApiCalls: 1000
    },
    isCore: false,
    status: 'active'
  }
];

const seedModules = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');

    // Clear existing modules
    await Module.deleteMany({});
    console.log('Cleared existing modules');

    // Insert new modules
    const insertedModules = await Module.insertMany(modules);
    console.log(`✅ Successfully seeded ${insertedModules.length} modules:`);
    
    insertedModules.forEach(module => {
      console.log(`   - ${module.displayName} (${module.moduleId})`);
    });

    // Update metrics for demonstration
    for (const module of insertedModules) {
      module.metrics.totalInstalls = Math.floor(Math.random() * 1000) + 100;
      module.metrics.activeInstalls = Math.floor(module.metrics.totalInstalls * 0.8);
      module.metrics.averageRating = (Math.random() * 2 + 3).toFixed(1); // 3.0 to 5.0
      module.metrics.totalReviews = Math.floor(Math.random() * 200) + 50;
      await module.save();
    }

    console.log('✅ Updated module metrics');
    console.log('\n🎉 Module seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding modules:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
if (require.main === module) {
  seedModules();
}

module.exports = seedModules;
