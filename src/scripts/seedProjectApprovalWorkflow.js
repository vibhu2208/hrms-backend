/**
 * Seeder for Project Approval Workflow
 * Creates approval workflow template for project requests
 */

const { getTenantConnection } = require('../config/database.config');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');

const seedProjectApprovalWorkflow = async (companyId) => {
  let tenantConnection = null;
  
  try {
    console.log(`🌱 Seeding project approval workflow for company: ${companyId}`);
    
    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
    
    // Check if project approval workflow already exists
    const existingWorkflow = await ApprovalWorkflow.findOne({
      requestType: 'project'
    });
    
    if (existingWorkflow) {
      console.log('✅ Project approval workflow already exists');
      return existingWorkflow;
    }
    
    // Create project approval workflow
    const projectWorkflow = await ApprovalWorkflow.create({
      name: 'Project Approval Workflow',
      workflowName: 'Project Approval',
      requestType: 'project',
      entityType: 'project',
      description: 'Approval workflow for manager-submitted project requests',
      priority: 1,
      isDefault: true,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'admin',
          isRequired: true,
          canDelegate: true,
          slaHours: 48,
          slaMinutes: 2880,
          escalationHours: 72
        }
      ],
      slaMinutes: 2880, // 48 hours
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 4320, // 72 hours
        escalateTo: 'admin',
        autoApproveAfterMinutes: null // No auto-approval
      },
      conditions: [],
      legacyConditions: {}
    });
    
    console.log('✅ Project approval workflow created successfully');
    return projectWorkflow;
    
  } catch (error) {
    console.error('❌ Error seeding project approval workflow:', error);
    throw error;
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

// Run seeder if called directly
if (require.main === module) {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('Please provide company ID as argument');
    process.exit(1);
  }
  
  seedProjectApprovalWorkflow(companyId)
    .then(() => {
      console.log('🎉 Project approval workflow seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Project approval workflow seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedProjectApprovalWorkflow };
