/**
 * Seed Leave Approval Workflows
 * Creates default leave approval workflows based on duration
 */

const { getTenantConnection } = require('../config/database.config');
require('dotenv').config();

async function seedLeaveWorkflows(companyId) {
  try {
    console.log(`\n🌱 Seeding leave approval workflows for company: ${companyId}\n`);

    const tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    // Clear existing leave workflows
    await ApprovalWorkflow.deleteMany({ requestType: 'leave' });
    console.log('✅ Cleared existing leave workflows');

    const workflows = [];

    // Workflow 1: Short Leave (1-3 days) - Manager only
    workflows.push({
      name: 'Short Leave Approval',
      workflowName: 'Short Leave Approval',
      requestType: 'leave',
      entityType: 'leave',
      description: 'Approval workflow for short leaves (1-3 days)',
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
          field: 'metadata.duration',
          operator: 'greater_than_or_equal',
          value: 1
        },
        {
          field: 'metadata.duration',
          operator: 'less_than_or_equal',
          value: 3
        }
      ],
      slaMinutes: 1440, // 24 hours
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'hr',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 2: Medium Leave (4-7 days) - Manager → HR
    workflows.push({
      name: 'Medium Leave Approval',
      workflowName: 'Medium Leave Approval',
      requestType: 'leave',
      entityType: 'leave',
      description: 'Approval workflow for medium leaves (4-7 days)',
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
          approverType: 'hr',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        }
      ],
      conditions: [
        {
          field: 'metadata.duration',
          operator: 'greater_than_or_equal',
          value: 4
        },
        {
          field: 'metadata.duration',
          operator: 'less_than_or_equal',
          value: 7
        }
      ],
      slaMinutes: 2880, // 48 hours
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'next_level',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 3: Long Leave (8+ days) - Manager → HR → Department Head
    workflows.push({
      name: 'Long Leave Approval',
      workflowName: 'Long Leave Approval',
      requestType: 'leave',
      entityType: 'leave',
      description: 'Approval workflow for long leaves (8+ days)',
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
          approverType: 'hr',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        },
        {
          level: 3,
          approverType: 'department_head',
          isRequired: true,
          canDelegate: true,
          slaHours: 24,
          slaMinutes: 1440,
          escalationHours: 36
        }
      ],
      conditions: [
        {
          field: 'metadata.duration',
          operator: 'greater_than_or_equal',
          value: 8
        }
      ],
      slaMinutes: 4320, // 72 hours
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440,
        escalateTo: 'next_level',
        autoApproveAfterMinutes: null
      }
    });

    // Workflow 4: Default Leave Workflow (fallback)
    workflows.push({
      name: 'Default Leave Approval',
      workflowName: 'Default Leave Approval',
      requestType: 'leave',
      entityType: 'leave',
      description: 'Default approval workflow for all leaves',
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
    
    console.log('\n✅ Leave approval workflows created:');
    created.forEach(wf => {
      console.log(`   - ${wf.name} (${wf.approvalSteps.length} levels, priority: ${wf.priority})`);
    });

    console.log('\n📋 Workflow Summary:');
    console.log('   1-3 days: Manager only');
    console.log('   4-7 days: Manager → HR');
    console.log('   8+ days: Manager → HR → Department Head');
    console.log('   Default: Manager only\n');

    return created;
  } catch (error) {
    console.error('❌ Error seeding leave workflows:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const companyId = process.argv[2];
  
  if (!companyId) {
    console.error('❌ Please provide company ID');
    console.log('Usage: node seedLeaveApprovalWorkflow.js <companyId>');
    process.exit(1);
  }

  seedLeaveWorkflows(companyId)
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedLeaveWorkflows };
