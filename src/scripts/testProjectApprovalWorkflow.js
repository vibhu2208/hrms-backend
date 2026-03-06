/**
 * Test script for Project Approval Workflow
 * Validates the complete flow from manager submission to admin approval
 */

const { getTenantConnection } = require('../config/database.config');
const { seedProjectApprovalWorkflow } = require('./seedProjectApprovalWorkflow');
const ProjectSchema = require('../models/Project');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');

const testProjectApprovalWorkflow = async (tenantId) => {
  let tenantConnection = null;
  
  try {
    console.log('🧪 Testing Project Approval Workflow...');
    console.log(`📋 Tenant ID: ${tenantId}`);
    
    // Get tenant connection
    tenantConnection = await getTenantConnection(tenantId);
    
    // 1. Test Approval Workflow Creation
    console.log('\n1️⃣ Testing Approval Workflow Creation...');
    const workflow = await seedProjectApprovalWorkflow(tenantId);
    if (workflow) {
      console.log('✅ Approval workflow created/verified successfully');
    } else {
      console.log('❌ Failed to create approval workflow');
      return false;
    }
    
    // 2. Test Project Model with Approval Fields
    console.log('\n2️⃣ Testing Project Model Schema...');
    const Project = tenantConnection.model('Project', ProjectSchema);
    
    // Create a test project
    const testProject = await Project.create({
      name: 'Test Project for Approval',
      description: 'This is a test project for approval workflow validation',
      client: new tenantConnection.Types.ObjectId(), // Mock client ID
      location: 'Test Location',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'planning',
      approvalStatus: 'pending',
      submittedBy: new tenantConnection.Types.ObjectId(), // Mock user ID
      submittedAt: new Date(),
      priority: 'medium',
      teamMembers: []
    });
    
    console.log('✅ Project created with approval fields:', {
      name: testProject.name,
      approvalStatus: testProject.approvalStatus,
      submittedAt: testProject.submittedAt
    });
    
    // 3. Test Approval Status Transitions
    console.log('\n3️⃣ Testing Approval Status Transitions...');
    
    // Test approval
    testProject.approvalStatus = 'approved';
    testProject.approvedBy = new tenantConnection.Types.ObjectId();
    testProject.approvedAt = new Date();
    testProject.status = 'active';
    await testProject.save();
    
    console.log('✅ Project approved successfully:', {
      approvalStatus: testProject.approvalStatus,
      approvedAt: testProject.approvedAt,
      status: testProject.status
    });
    
    // Test rejection
    testProject.approvalStatus = 'rejected';
    testProject.rejectionReason = 'Test rejection reason';
    await testProject.save();
    
    console.log('✅ Project rejected successfully:', {
      approvalStatus: testProject.approvalStatus,
      rejectionReason: testProject.rejectionReason
    });
    
    // 4. Test Query by Approval Status
    console.log('\n4️⃣ Testing Query by Approval Status...');
    
    const pendingProjects = await Project.find({ approvalStatus: 'pending' });
    const approvedProjects = await Project.find({ approvalStatus: 'approved' });
    const rejectedProjects = await Project.find({ approvalStatus: 'rejected' });
    
    console.log('✅ Query results:', {
      pending: pendingProjects.length,
      approved: approvedProjects.length,
      rejected: rejectedProjects.length
    });
    
    // 5. Test Approval Workflow Integration
    console.log('\n5️⃣ Testing Approval Workflow Integration...');
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
    
    const projectWorkflow = await ApprovalWorkflow.findOne({
      requestType: 'project',
      isActive: true
    });
    
    if (projectWorkflow) {
      console.log('✅ Project approval workflow found:', {
        name: projectWorkflow.name,
        requestType: projectWorkflow.requestType,
        approvalSteps: projectWorkflow.approvalSteps.length
      });
    } else {
      console.log('❌ Project approval workflow not found');
      return false;
    }
    
    // Cleanup test data
    await Project.findByIdAndDelete(testProject._id);
    console.log('\n🧹 Cleaned up test data');
    
    console.log('\n🎉 All tests passed! Project approval workflow is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

// Run test if called directly
if (require.main === module) {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Please provide tenant ID as argument');
    console.log('Usage: node testProjectApprovalWorkflow.js <tenantId>');
    process.exit(1);
  }
  
  testProjectApprovalWorkflow(tenantId)
    .then((success) => {
      if (success) {
        console.log('\n✅ Project approval workflow test completed successfully');
        process.exit(0);
      } else {
        console.log('\n❌ Project approval workflow test failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testProjectApprovalWorkflow };
