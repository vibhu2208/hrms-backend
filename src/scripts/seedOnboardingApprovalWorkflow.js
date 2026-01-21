/**
 * Seed script for Onboarding Approval Workflow
 * Creates the default approval workflow for onboarding in tenant databases
 * 
 * Usage: node src/scripts/seedOnboardingApprovalWorkflow.js <tenantId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getTenantConnection } = require('../config/database.config');

const seedOnboardingApprovalWorkflow = async (tenantId) => {
  console.log('🌱 Starting Onboarding Approval Workflow Seed...\n');

  if (!tenantId) {
    console.error('❌ Error: Please provide a tenant ID');
    console.log('Usage: node src/scripts/seedOnboardingApprovalWorkflow.js <tenantId>');
    process.exit(1);
  }

  try {
    // Connect to main database first
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to main database');

    // Get tenant connection
    const tenantConnection = await getTenantConnection(tenantId);
    console.log(`✅ Connected to tenant database: ${tenantId}`);

    // Load the ApprovalWorkflow model
    const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    // Check if onboarding approval workflow already exists
    const existingWorkflow = await ApprovalWorkflow.findOne({
      requestType: 'onboarding_approval',
      isActive: true
    });

    if (existingWorkflow) {
      console.log('ℹ️ Onboarding approval workflow already exists:');
      console.log(`   - Name: ${existingWorkflow.name}`);
      console.log(`   - ID: ${existingWorkflow._id}`);

      // Check if we need to update the approverType
      const needsUpdate = existingWorkflow.approvalSteps.some(step => step.approverType === 'company_admin');
      if (!needsUpdate) {
        console.log('🔄 Updating workflow to use correct approverType...');

        // Update the existing workflow
        existingWorkflow.approvalSteps.forEach(step => {
          if (step.approverType === 'company_admin') return; // Already correct
          // Update to company_admin if it's set to something else
          step.approverType = 'company_admin';
        });

        existingWorkflow.levels.forEach(level => {
          if (level.approverType === 'company_admin') return; // Already correct
          level.approverType = 'company_admin';
        });

        await existingWorkflow.save();
        console.log('✅ Workflow updated successfully!');
      } else {
        console.log('✅ Workflow is already up to date.');
      }

      await mongoose.disconnect();
      return existingWorkflow;
    }

    // Create the onboarding approval workflow
    const onboardingWorkflow = await ApprovalWorkflow.create({
      name: 'Onboarding Approval Workflow',
      workflowName: 'onboarding_approval_default',
      requestType: 'onboarding_approval',
      description: 'Default workflow for approving candidate onboarding before sending offer letters. HR must request approval from Admin before sending offers.',
      priority: 100, // High priority to ensure this workflow is selected
      isDefault: true,
      isActive: true,
      approvalSteps: [
        {
          level: 1,
          approverType: 'company_admin',
          isRequired: true,
          canDelegate: false,
          slaHours: 24,
          slaMinutes: 1440, // 24 hours
          escalationHours: 36
        }
      ],
      levels: [
        {
          level: 1,
          approverType: 'company_admin',
          isRequired: true,
          canDelegate: false,
          slaMinutes: 1440
        }
      ],
      slaMinutes: 1440, // 24 hours total
      escalationRules: {
        enabled: true,
        escalationAfterMinutes: 1440, // Escalate after 24 hours
        escalateTo: 'admin',
        autoApproveAfterMinutes: null // No auto-approve
      },
      conditions: [] // No conditions - applies to all onboarding approvals
    });

    console.log('\n✅ Onboarding Approval Workflow created successfully:');
    console.log(`   - Name: ${onboardingWorkflow.name}`);
    console.log(`   - ID: ${onboardingWorkflow._id}`);
    console.log(`   - Request Type: ${onboardingWorkflow.requestType}`);
    console.log(`   - Approver: Company Admin`);
    console.log(`   - SLA: 24 hours`);
    console.log(`   - Escalation: After 36 hours`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Workflow Summary:');
    console.log('   1. HR sends candidate to onboarding');
    console.log('   2. HR clicks "Request Approval" button');
    console.log('   3. Admin receives approval request with full candidate details');
    console.log('   4. Admin approves/rejects:');
    console.log('      - Approved: HR can send offer letter');
    console.log('      - Rejected: Candidate goes on hold, HR can re-request');
    console.log('   5. SLA: 24 hours to respond, escalation after 36 hours');

    await mongoose.disconnect();
    return onboardingWorkflow;
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  const tenantId = process.argv[2];
  seedOnboardingApprovalWorkflow(tenantId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedOnboardingApprovalWorkflow };
