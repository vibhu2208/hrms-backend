/**
 * Approval Workflow Service
 * Handles multi-level approval workflows, SLA tracking, escalation, and delegation
 * @module services/approvalWorkflowService
 */

const { getTenantConnection } = require('../config/database.config');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
const ApprovalMatrixSchema = require('../models/tenant/ApprovalMatrix');
const ApprovalDelegationSchema = require('../models/tenant/ApprovalDelegation');
const TenantUserSchema = require('../models/tenant/TenantUser');
const emailService = require('./emailService');

class ApprovalWorkflowService {
  /**
   * Normalize workflow for runtime execution.
   * Keeps backward compatibility by deriving legacy `levels[]` from new `steps[]` when needed.
   */
  normalizeWorkflowForExecution(workflow) {
    if (!workflow) return workflow;
    const wf = typeof workflow.toObject === 'function' ? workflow.toObject() : { ...workflow };

    const hasLegacyLevels = Array.isArray(wf.levels) && wf.levels.length > 0;
    const hasNewSteps = Array.isArray(wf.steps) && wf.steps.length > 0;

    if (!hasLegacyLevels && hasNewSteps) {
      const sortedSteps = [...wf.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
      wf.levels = sortedSteps.map((s, idx) => ({
        level: idx + 1,
        approverType: s.role, // 'hr' | 'manager' | 'admin' (supported by resolver)
        approverId: null,
        approverRole: s.role,
        approverEmail: null,
        isRequired: true,
        canDelegate: s.permissions?.canDelegate !== false,
        slaMinutes: s.sla?.timeLimitMinutes || 1440
      }));
      wf.slaMinutes = wf.levels.reduce((sum, l) => sum + (l.slaMinutes || 1440), 0);
    }

    return wf;
  }

  /**
   * Get applicable workflow for an entity
   */
  async getApplicableWorkflow(companyId, entityType, entityData) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
      const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);

      const requesterRole = entityData?.requesterRole;

      // First, try to find matching approval matrix
      const matrices = await ApprovalMatrix.find({
        entityType: entityType,
        isActive: true
      }).sort({ priority: -1 });

      for (const matrix of matrices) {
        if (this.matchesMatrixConditions(matrix, entityData)) {
          // Create workflow from matrix
          return {
            levels: matrix.requiredApprovers.map(approver => ({
              level: approver.level,
              approverType: approver.approverType,
              approverId: approver.approverId,
              approverRole: approver.approverRole,
              approverEmail: approver.approverEmail,
              isRequired: approver.isRequired,
              canDelegate: true,
              slaMinutes: approver.slaMinutes
            })),
            slaMinutes: matrix.requiredApprovers.reduce((max, a) => Math.max(max, a.slaMinutes || 1440), 0)
          };
        }
      }

      // Next, try to find an explicit workflow match (v2): entityType + requesterRole
      // Allows defining different workflows per requester role.
      if (requesterRole) {
        const roleMatchedWorkflow = await ApprovalWorkflow.findOne({
          entityType: entityType,
          requesterRole: requesterRole,
          status: 'active'
        }).sort({ priority: -1, updatedAt: -1 });

        if (roleMatchedWorkflow) {
          return this.normalizeWorkflowForExecution(roleMatchedWorkflow);
        }
      }

      // Fallback to default workflow
      const defaultWorkflow = await ApprovalWorkflow.findOne({
        entityType: entityType,
        isDefault: true,
        isActive: true
      });

      if (defaultWorkflow) {
        return this.normalizeWorkflowForExecution(defaultWorkflow);
      }

      // Return null if no workflow found
      return null;
    } catch (error) {
      throw new Error(`Failed to get applicable workflow: ${error.message}`);
    }
  }

  /**
   * Check if entity data matches matrix conditions
   */
  matchesMatrixConditions(matrix, entityData) {
    const conditions = matrix.conditions || {};

    // Check leave type
    if (conditions.leaveType && conditions.leaveType.length > 0) {
      if (!conditions.leaveType.includes(entityData.leaveType)) {
        return false;
      }
    }

    // Check amount range
    if (conditions.amountRange) {
      const amount = entityData.amount || entityData.numberOfDays || 0;
      if (conditions.amountRange.min !== undefined && amount < conditions.amountRange.min) {
        return false;
      }
      if (conditions.amountRange.max !== undefined && amount > conditions.amountRange.max) {
        return false;
      }
    }

    // Check number of days range
    if (conditions.numberOfDaysRange) {
      const days = entityData.numberOfDays || 0;
      if (conditions.numberOfDaysRange.min !== undefined && days < conditions.numberOfDaysRange.min) {
        return false;
      }
      if (conditions.numberOfDaysRange.max !== undefined && days > conditions.numberOfDaysRange.max) {
        return false;
      }
    }

    // Check department
    if (conditions.department && conditions.department.length > 0) {
      if (!conditions.department.some(dept => dept.toString() === entityData.departmentId?.toString())) {
        return false;
      }
    }

    // Check designation
    if (conditions.designation && conditions.designation.length > 0) {
      if (!conditions.designation.includes(entityData.designation)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize approval workflow for an entity
   */
  async initializeWorkflow(companyId, entityType, entityId, entityData, employeeId) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

      // Get employee details
      const employee = await TenantUser.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get applicable workflow
      const workflow = await this.getApplicableWorkflow(companyId, entityType, {
        ...entityData,
        requesterRole: employee?.role,
        departmentId: employee.departmentId,
        designation: employee.designation
      });

      if (!workflow) {
        throw new Error('No applicable workflow found');
      }

      // Resolve approvers for each level
      const approvalLevels = [];
      const now = new Date();

      for (const level of workflow.levels) {
        const approver = await this.resolveApprover(companyId, level, employee);

        if (!approver && level.isRequired) {
          throw new Error(`Required approver not found for level ${level.level}`);
        }

        if (approver) {
          const slaDeadline = new Date(now.getTime() + (level.slaMinutes || 1440) * 60 * 1000);
          approvalLevels.push({
            level: level.level,
            approverId: approver._id,
            approverEmail: approver.email,
            approverName: `${approver.firstName} ${approver.lastName}`,
            status: 'pending',
            slaDeadline: slaDeadline,
            isEscalated: false
          });
        }
      }

      // Calculate overall SLA deadline
      const totalSlaMinutes = workflow.slaMinutes || approvalLevels.reduce((sum, l) => sum + (l.slaMinutes || 1440), 0);
      const overallSlaDeadline = new Date(now.getTime() + totalSlaMinutes * 60 * 1000);

      return {
        workflowId: workflow._id || null,
        currentLevel: 1,
        approvalLevels: approvalLevels,
        slaDeadline: overallSlaDeadline,
        isEscalated: false
      };
    } catch (error) {
      throw new Error(`Failed to initialize workflow: ${error.message}`);
    }
  }

  /**
   * Resolve approver for a level
   */
  async resolveApprover(companyId, level, employee) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      const ApprovalDelegation = tenantConnection.model('ApprovalDelegation', ApprovalDelegationSchema);

      let approver = null;

      switch (level.approverType) {
        case 'reporting_manager':
          if (employee.reportingManager) {
            approver = await TenantUser.findOne({ email: employee.reportingManager });
            // Check for delegation
            if (approver) {
              const delegation = await ApprovalDelegation.findOne({
                delegatorEmail: approver.email,
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() },
                $or: [
                  { entityTypes: 'all' },
                  { entityTypes: level.entityType || 'leave' }
                ]
              });
              if (delegation) {
                approver = await TenantUser.findOne({ email: delegation.delegateEmail });
              }
            }
          }
          break;

        case 'department_head':
          // Find department head - this would need department model
          // Placeholder logic
          approver = await TenantUser.findOne({
            departmentId: employee.departmentId,
            role: { $in: ['manager', 'admin', 'hr'] }
          });
          break;

        case 'hr':
          approver = await TenantUser.findOne({ role: 'hr', isActive: true });
          break;

        case 'admin':
          approver = await TenantUser.findOne({ role: 'admin', isActive: true });
          break;

        case 'specific_user':
          if (level.approverId) {
            approver = await TenantUser.findById(level.approverId);
          } else if (level.approverEmail) {
            approver = await TenantUser.findOne({ email: level.approverEmail });
          }
          break;

        case 'role_based':
          if (level.approverRole) {
            approver = await TenantUser.findOne({ role: level.approverRole, isActive: true });
          }
          break;
      }

      return approver;
    } catch (error) {
      console.error('Error resolving approver:', error);
      return null;
    }
  }

  /**
   * Process approval action
   */
  async processApproval(companyId, entityType, entityId, level, approverId, action, comments) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get entity model based on type
      let EntityModel = null;
      if (entityType === 'leave') {
        const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
        EntityModel = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
      }
      // Add other entity types as needed

      if (!EntityModel) {
        throw new Error(`Entity type ${entityType} not supported`);
      }

      const entity = await EntityModel.findById(entityId);
      if (!entity) {
        throw new Error('Entity not found');
      }

      const approver = await TenantUser.findById(approverId);
      if (!approver) {
        throw new Error('Approver not found');
      }

      // Find the approval level
      const approvalLevel = entity.approvalLevels.find(al => al.level === level);
      if (!approvalLevel) {
        throw new Error('Approval level not found');
      }

      // Check if approver is authorized
      if (approvalLevel.approverId.toString() !== approverId.toString() &&
          approvalLevel.approverEmail !== approver.email) {
        throw new Error('Unauthorized approver');
      }

      // Update approval level
      if (action === 'approve') {
        approvalLevel.status = 'approved';
        approvalLevel.comments = comments || '';
        approvalLevel.approvedAt = new Date();

        // Move to next level or finalize
        if (level < entity.approvalLevels.length) {
          entity.currentLevel = level + 1;
          // Send notification to next approver
          await this.notifyNextApprover(companyId, entity, level + 1);
        } else {
          // All levels approved
          entity.status = 'approved';
          await this.finalizeApproval(companyId, entityType, entity);
        }
      } else if (action === 'reject') {
        approvalLevel.status = 'rejected';
        approvalLevel.comments = comments || '';
        approvalLevel.rejectedAt = new Date();
        entity.status = 'rejected';
        entity.rejectionReason = comments || 'Rejected by approver';
      }

      await entity.save();

      // Send notifications
      await this.sendApprovalNotification(companyId, entity, approver, action);

      return {
        success: true,
        message: `Request ${action}d successfully`,
        entity: entity
      };
    } catch (error) {
      throw new Error(`Failed to process approval: ${error.message}`);
    }
  }

  /**
   * Check and process SLA escalations
   */
  async checkSLAEscalations(companyId) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
      const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
      const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

      const now = new Date();
      const pendingRequests = await LeaveRequest.find({
        status: 'pending',
        isEscalated: false,
        slaDeadline: { $lte: now }
      });

      const results = {
        checked: pendingRequests.length,
        escalated: 0,
        errors: []
      };

      for (const request of pendingRequests) {
        try {
          // Get workflow
          const workflow = await ApprovalWorkflow.findById(request.workflowId);
          if (!workflow || !workflow.escalationRules || !workflow.escalationRules.enabled) {
            continue;
          }

          // Check current level SLA
          const currentLevel = request.approvalLevels.find(al => al.level === request.currentLevel);
          if (currentLevel && currentLevel.slaDeadline <= now && currentLevel.status === 'pending') {
            await this.escalateApproval(companyId, request, workflow);
            results.escalated++;
          }
        } catch (error) {
          results.errors.push({
            requestId: request._id,
            error: error.message
          });
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return results;
    } catch (error) {
      throw new Error(`SLA escalation check failed: ${error.message}`);
    }
  }

  /**
   * Escalate approval
   */
  async escalateApproval(companyId, entity, workflow) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const escalationRules = workflow.escalationRules;
      const currentLevel = entity.approvalLevels.find(al => al.level === entity.currentLevel);

      if (!currentLevel) {
        return;
      }

      currentLevel.isEscalated = true;
      currentLevel.escalatedAt = new Date();
      entity.isEscalated = true;
      entity.escalatedAt = new Date();

      // Determine escalation target
      let escalationTarget = null;

      if (escalationRules.escalateTo === 'next_level' && entity.currentLevel < entity.approvalLevels.length) {
        const nextLevel = entity.approvalLevels.find(al => al.level === entity.currentLevel + 1);
        if (nextLevel) {
          escalationTarget = await TenantUser.findById(nextLevel.approverId);
        }
      } else if (escalationRules.escalateTo === 'hr') {
        escalationTarget = await TenantUser.findOne({ role: 'hr', isActive: true });
      } else if (escalationRules.escalateTo === 'admin') {
        escalationTarget = await TenantUser.findOne({ role: 'admin', isActive: true });
      } else if (escalationRules.escalateTo === 'specific_user' && escalationRules.escalateToEmail) {
        escalationTarget = await TenantUser.findOne({ email: escalationRules.escalateToEmail });
      }

      if (escalationTarget) {
        entity.escalationReason = `Escalated to ${escalationTarget.firstName} ${escalationTarget.lastName}`;
        // Send escalation notification
        await this.sendEscalationNotification(companyId, entity, escalationTarget, currentLevel);
      }

      await entity.save();

      if (tenantConnection) await tenantConnection.close();
    } catch (error) {
      throw new Error(`Escalation failed: ${error.message}`);
    }
  }

  /**
   * Finalize approval
   */
  async finalizeApproval(companyId, entityType, entity) {
    // This would trigger entity-specific actions
    // For leave requests, update leave balance, etc.
    console.log(`Finalizing approval for ${entityType}: ${entity._id}`);
  }

  /**
   * Send notification to next approver
   */
  async notifyNextApprover(companyId, entity, nextLevel) {
    const nextApproval = entity.approvalLevels.find(al => al.level === nextLevel);
    if (nextApproval) {
      // Send email notification
      // Implementation depends on email service
      console.log(`Notifying approver: ${nextApproval.approverEmail}`);
    }
  }

  /**
   * Send approval notification
   */
  async sendApprovalNotification(companyId, entity, approver, action) {
    // Send email notification
    console.log(`Sending ${action} notification for ${entity._id}`);
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(companyId, entity, escalationTarget, level) {
    // Send email notification
    console.log(`Sending escalation notification to ${escalationTarget.email}`);
  }
}

module.exports = new ApprovalWorkflowService();


