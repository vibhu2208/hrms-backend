/**
 * Seed Payroll Approval Workflow
 * Creates payroll approval workflow: HR → Finance → CEO
 */

const { getTenantConnection } = require('../config/database.config');
require('dotenv').config();

async function seedPayrollWorkflow(companyId) {
  try {
    console.log(`\n🌱 Seeding payroll approval workflow for company: ${companyId}\n`);

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    // Clear existing payroll workflows
    await ApprovalWorkflow.deleteMany({ requestType: 'payroll' });
    console.log('✅ Cleared existing payroll workflows');

    // Payroll Approval Workflow: HR → Finance → CEO
    const payrollWorkflow = {
      name: 'Payroll Approval Workflow',
      workflowName: 'Payroll Approval Workflow',
      requestType: 'payroll',
      description: 'Multi-stage approval for monthly payroll processing',
      priority: 1,
      isDefault: true,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'hr',
          isRequired: true,
          canDelegate: false,
          slaHours: 48,
          slaMinutes: 2880,
          escalationHours: 72
        },
        {
          level: 2,
          approverType: 'finance',
          isRequired: true,
          canDelegate: false,
          slaHours: 48,
          slaMinutes: 2880,
          escalationHours: 72
        },
        {
          level: 3,
          approverType: 'ceo',
          isRequired: true,
          canDelegate: false,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 48
        }
      ],
      conditions: [],
      slaMinutes: 7200, // 5 days total
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 2880,
        escalateTo: 'next_level',
        autoApproveAfterMinutes: null
      }
    };

    const created = await ApprovalWorkflow.create(payrollWorkflow);
    
    console.log('\n✅ Payroll approval workflow created:');
    console.log(`   - ${created.name}`);
    console.log(`   - ${created.approvalSteps.length} levels: HR → Finance → CEO`);
    console.log(`   - Total SLA: 5 days\n`);

    console.log('📋 Workflow Details:');
    console.log('   Level 1: HR (48h SLA)');
    console.log('   Level 2: Finance (48h SLA)');
    console.log('   Level 3: CEO (24h SLA)');
    console.log('\n💡 Features:');
    console.log('   - Anomaly detection for salary spikes');
    console.log('   - Payroll freeze on 25th of month');
    console.log('   - Auto-escalation on SLA breach');
    console.log('   - Cannot be delegated\n');

    return created;
  } catch (error) {
    console.error('❌ Error seeding payroll workflow:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const companyId = process.argv[2];
  
  if (!companyId) {
    console.error('❌ Please provide company ID');
    console.log('Usage: node seedPayrollApprovalWorkflow.js <companyId>');
    process.exit(1);
  }

  seedPayrollWorkflow(companyId)
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedPayrollWorkflow };
