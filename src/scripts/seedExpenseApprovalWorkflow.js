/**
 * Seed Expense Approval Workflows
 * Creates expense approval workflows based on amount
 */

const { getTenantConnection } = require('../config/database.config');
require('dotenv').config();

async function seedExpenseWorkflows(companyId) {
  try {
    console.log(`\n🌱 Seeding expense approval workflows for company: ${companyId}\n`);

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    // Clear existing expense workflows
    await ApprovalWorkflow.deleteMany({ requestType: 'expense' });
    console.log('✅ Cleared existing expense workflows');

    const workflows = [];

    // Workflow 1: Small Expense (< ₹5,000) - Manager only
    workflows.push({
      name: 'Small Expense Approval',
      workflowName: 'Small Expense Approval',
      requestType: 'expense',
      description: 'Approval workflow for expenses less than ₹5,000',
      priority: 3,
      isDefault: false,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'manager',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        }
      ],
      conditions: [
        {
          field: 'metadata.amount',
          operator: 'less_than',
          value: 5000
        }
      ],
      slaMinutes: 1440,
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'hr',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 2: Medium Expense (₹5,000 - ₹25,000) - Manager → Finance
    workflows.push({
      name: 'Medium Expense Approval',
      workflowName: 'Medium Expense Approval',
      requestType: 'expense',
      description: 'Approval workflow for expenses between ₹5,000 and ₹25,000',
      priority: 2,
      isDefault: false,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'manager',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        },
        {
          level: 2,
          approverType: 'finance',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        }
      ],
      conditions: [
        {
          field: 'metadata.amount',
          operator: 'greater_than_or_equal',
          value: 5000
        },
        {
          field: 'metadata.amount',
          operator: 'less_than_or_equal',
          value: 25000
        }
      ],
      slaMinutes: 2880,
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'next_level',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 3: Large Expense (> ₹25,000) - Manager → Finance → CFO/CEO
    workflows.push({
      name: 'Large Expense Approval',
      workflowName: 'Large Expense Approval',
      requestType: 'expense',
      description: 'Approval workflow for expenses greater than ₹25,000',
      priority: 1,
      isDefault: false,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'manager',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        },
        {
          level: 2,
          approverType: 'finance',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
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
      conditions: [
        {
          field: 'metadata.amount',
          operator: 'greater_than',
          value: 25000
        }
      ],
      slaMinutes: 4320,
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'next_level',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 4: Default Expense Workflow (fallback)
    workflows.push({
      name: 'Default Expense Approval',
      workflowName: 'Default Expense Approval',
      requestType: 'expense',
      description: 'Default approval workflow for all expenses',
      priority: 0,
      isDefault: true,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'manager',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        }
      ],
      conditions: [],
      slaMinutes: 1440,
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'hr',
        autoApproveAfterMinutes: null
      }
    });

    // Insert workflows
    const created = await ApprovalWorkflow.insertMany(workflows);
    
    console.log('\n✅ Expense approval workflows created:');
    created.forEach(wf => {
      console.log(`   - ${wf.name} (${wf.approvalSteps.length} levels, priority: ${wf.priority})`);
    });

    console.log('\n📋 Workflow Summary:');
    console.log('   < ₹5,000: Manager only');
    console.log('   ₹5,000 - ₹25,000: Manager → Finance');
    console.log('   > ₹25,000: Manager → Finance → CEO');
    console.log('   Default: Manager only\n');

    return created;
  } catch (error) {
    console.error('❌ Error seeding expense workflows:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const companyId = process.argv[2];
  
  if (!companyId) {
    console.error('❌ Please provide company ID');
    console.log('Usage: node seedExpenseApprovalWorkflow.js <companyId>');
    process.exit(1);
  }

  seedExpenseWorkflows(companyId)
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedExpenseWorkflows };
