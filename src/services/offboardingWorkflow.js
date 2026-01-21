const { getTenantModel } = require('../middlewares/tenantMiddleware');
const offboardingRequestSchema = require('../models/tenant/OffboardingRequest');
const offboardingTaskSchema = require('../models/tenant/OffboardingTask');
const handoverDetailSchema = require('../models/tenant/HandoverDetail');
const assetClearanceSchema = require('../models/tenant/AssetClearance');
const finalSettlementSchema = require('../models/tenant/FinalSettlement');
const exitFeedbackSchema = require('../models/tenant/ExitFeedback');

/**
 * Offboarding Workflow Engine
 * Phase 2: Workflow Definition and State Management
 */
class OffboardingWorkflowEngine {
  constructor() {
    this.workflowStates = {
      INITIATION: 'initiation',
      MANAGER_APPROVAL: 'manager_approval',
      HR_APPROVAL: 'hr_approval',
      FINANCE_APPROVAL: 'finance_approval',
      CHECKLIST_GENERATION: 'checklist_generation',
      DEPARTMENTAL_CLEARANCE: 'departmental_clearance',
      ASSET_RETURN: 'asset_return',
      KNOWLEDGE_TRANSFER: 'knowledge_transfer',
      FINAL_SETTLEMENT: 'final_settlement',
      EXIT_INTERVIEW: 'exit_interview',
      CLOSURE: 'closure'
    };

    this.workflowStatus = {
      DRAFT: 'draft',
      INITIATED: 'initiated',
      APPROVALS_PENDING: 'approvals_pending',
      CHECKLIST_ACTIVE: 'checklist_active',
      CLEARANCE_IN_PROGRESS: 'clearance_in_progress',
      SETTLEMENT_PENDING: 'settlement_pending',
      FEEDBACK_PENDING: 'feedback_pending',
      CLOSED: 'closed',
      CANCELLED: 'cancelled'
    };

    this.stateTransitions = {
      [this.workflowStates.INITIATION]: [this.workflowStates.MANAGER_APPROVAL],
      [this.workflowStates.MANAGER_APPROVAL]: [this.workflowStates.HR_APPROVAL, this.workflowStates.INITIATION],
      [this.workflowStates.HR_APPROVAL]: [this.workflowStates.FINANCE_APPROVAL, this.workflowStates.MANAGER_APPROVAL],
      [this.workflowStates.FINANCE_APPROVAL]: [this.workflowStates.CHECKLIST_GENERATION, this.workflowStates.HR_APPROVAL],
      [this.workflowStates.CHECKLIST_GENERATION]: [this.workflowStates.DEPARTMENTAL_CLEARANCE],
      [this.workflowStates.DEPARTMENTAL_CLEARANCE]: [this.workflowStates.ASSET_RETURN],
      [this.workflowStates.ASSET_RETURN]: [this.workflowStates.KNOWLEDGE_TRANSFER],
      [this.workflowStates.KNOWLEDGE_TRANSFER]: [this.workflowStates.FINAL_SETTLEMENT],
      [this.workflowStates.FINAL_SETTLEMENT]: [this.workflowStates.EXIT_INTERVIEW],
      [this.workflowStates.EXIT_INTERVIEW]: [this.workflowStates.CLOSURE],
      [this.workflowStates.CLOSURE]: []
    };
  }

  /**
   * Initialize offboarding workflow
   */
  async initiateOffboarding(tenantConnection, offboardingData, initiatedBy) {
    try {
      const OffboardingRequest = getTenantModel(tenantConnection, 'OffboardingRequest', offboardingRequestSchema);
      
      // Create main offboarding request
      const offboardingRequest = new OffboardingRequest({
        ...offboardingData,
        initiatedBy,
        status: this.workflowStatus.INITIATED,
        currentStage: this.workflowStates.INITIATION,
        initiatedAt: new Date(),
        statusHistory: [{
          status: this.workflowStatus.INITIATED,
          changedBy: initiatedBy,
          changedAt: new Date(),
          reason: 'Offboarding process initiated'
        }]
      });

      await offboardingRequest.save();

      // Auto-advance to manager approval if all required data is present
      if (this.canAdvanceToNextStage(offboardingRequest)) {
        await this.advanceToNextStage(tenantConnection, offboardingRequest._id, initiatedBy);
      }

      return offboardingRequest;
    } catch (error) {
      console.error('Error initiating offboarding:', error);
      throw error;
    }
  }

  /**
   * Advance workflow to next stage
   */
  async advanceToNextStage(tenantConnection, offboardingRequestId, userId, comments = '') {
    try {
      const OffboardingRequest = getTenantModel(tenantConnection, 'OffboardingRequest', offboardingRequestSchema);
      const offboardingRequest = await OffboardingRequest.findById(offboardingRequestId);

      if (!offboardingRequest) {
        throw new Error('Offboarding request not found');
      }

      const currentStage = offboardingRequest.currentStage;
      const nextStages = this.stateTransitions[currentStage];

      if (!nextStages || nextStages.length === 0) {
        throw new Error('No valid next stage available');
      }

      const nextStage = nextStages[0]; // Take first valid transition
      
      // Validate stage transition
      if (!this.validateStageTransition(offboardingRequest, nextStage)) {
        throw new Error(`Cannot transition from ${currentStage} to ${nextStage}`);
      }

      // Update stage and status
      offboardingRequest.currentStage = nextStage;
      offboardingRequest.status = this.getStatusForStage(nextStage);
      
      // Add to status history
      offboardingRequest.statusHistory.push({
        status: offboardingRequest.status,
        changedBy: userId,
        changedAt: new Date(),
        reason: comments || `Advanced to ${nextStage}`
      });

      await offboardingRequest.save();

      // Execute stage-specific actions
      await this.executeStageActions(tenantConnection, offboardingRequest, userId);

      return offboardingRequest;
    } catch (error) {
      console.error('Error advancing workflow stage:', error);
      throw error;
    }
  }

  /**
   * Execute actions specific to each workflow stage
   */
  async executeStageActions(tenantConnection, offboardingRequest, userId) {
    const stage = offboardingRequest.currentStage;

    switch (stage) {
      case this.workflowStates.MANAGER_APPROVAL:
        // Skip manager approval for now and go directly to HR approval
        console.log('Skipping manager approval - advancing to HR approval');
        await this.advanceToNextStage(tenantConnection, offboardingRequest._id, null, 'Manager approval skipped - advancing to HR approval');
        break;
      
      case this.workflowStates.HR_APPROVAL:
        await this.setupHRApproval(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.FINANCE_APPROVAL:
        await this.setupFinanceApproval(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.CHECKLIST_GENERATION:
        await this.generateOffboardingTasks(tenantConnection, offboardingRequest, userId);
        break;
      
      case this.workflowStates.DEPARTMENTAL_CLEARANCE:
        await this.initiateDepartmentalClearance(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.ASSET_RETURN:
        await this.initiateAssetClearance(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.KNOWLEDGE_TRANSFER:
        await this.initiateKnowledgeTransfer(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.FINAL_SETTLEMENT:
        await this.initiateFinalSettlement(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.EXIT_INTERVIEW:
        await this.initiateExitInterview(tenantConnection, offboardingRequest);
        break;
      
      case this.workflowStates.CLOSURE:
        await this.completeOffboarding(tenantConnection, offboardingRequest);
        break;
    }
  }

  /**
   * Generate departmental tasks based on employee role and company policies
   */
  async generateOffboardingTasks(tenantConnection, offboardingRequest, userId) {
    try {
      const OffboardingTask = getTenantModel(tenantConnection, 'OffboardingTask', offboardingTaskSchema);
      
      // Get employee details to determine required tasks
      const Employee = getTenantModel(tenantConnection, 'Employee', require('../models/Employee').schema);
      const employee = await Employee.findById(offboardingRequest.employeeId).populate('department');

      const tasks = await this.getTaskTemplatesForEmployee(employee, offboardingRequest);
      
      const createdTasks = [];
      for (const taskTemplate of tasks) {
        const task = new OffboardingTask({
          offboardingRequestId: offboardingRequest._id,
          clientId: offboardingRequest.clientId,
          employeeId: offboardingRequest.employeeId,
          taskName: taskTemplate.name,
          taskDescription: taskTemplate.description,
          taskType: taskTemplate.type,
          department: taskTemplate.department,
          assignedTo: taskTemplate.assignedTo,
          assignedBy: userId,
          dueDate: this.calculateTaskDueDate(offboardingRequest.lastWorkingDay, taskTemplate.daysBeforeLWD),
          priority: taskTemplate.priority,
          requiresVerification: taskTemplate.requiresVerification,
          checklist: taskTemplate.checklist || [],
          isAutoGenerated: true
        });

        await task.save();
        createdTasks.push(task);
      }

      console.log(`Generated ${createdTasks.length} offboarding tasks for employee ${offboardingRequest.employeeId}`);
      return createdTasks;
    } catch (error) {
      console.error('Error generating offboarding tasks:', error);
      throw error;
    }
  }

  /**
   * Get task templates based on employee profile
   */
  async getTaskTemplatesForEmployee(employee, offboardingRequest) {
    // This would typically come from a configuration or database
    // For now, we'll use a hardcoded template
    const baseTaskTemplates = [
      // HR Tasks
      {
        name: 'Collect resignation letter',
        description: 'Obtain formal resignation letter from employee',
        type: 'document_collection',
        department: 'hr',
        assignedTo: null, // Will be assigned to HR team lead
        daysBeforeLWD: 15,
        priority: 'high',
        requiresVerification: true,
        checklist: [
          { item: 'Resignation letter received', completed: false },
          { item: 'Letter reviewed and approved', completed: false },
          { item: 'Copy stored in employee file', completed: false }
        ]
      },
      {
        name: 'Update employee status',
        description: 'Update employee status in HRMS and related systems',
        type: 'compliance_check',
        department: 'hr',
        assignedTo: null,
        daysBeforeLWD: 10,
        priority: 'high',
        requiresVerification: true,
        checklist: [
          { item: 'HRMS status updated', completed: false },
          { item: 'Payroll system notified', completed: false },
          { item: 'Benefits provider notified', completed: false }
        ]
      },
      
      // IT Tasks
      {
        name: 'Revoke system access',
        description: 'Disable all system access and accounts',
        type: 'access_revocation',
        department: 'it',
        assignedTo: null,
        daysBeforeLWD: 1,
        priority: 'critical',
        requiresVerification: true,
        checklist: [
          { item: 'Email account disabled', completed: false },
          { item: 'VPN access revoked', completed: false },
          { item: 'System logins disabled', completed: false },
          { item: 'Access cards deactivated', completed: false }
        ]
      },
      {
        name: 'Collect IT assets',
        description: 'Retrieve all company IT equipment and assets',
        type: 'asset_return',
        department: 'it',
        assignedTo: null,
        daysBeforeLWD: 2,
        priority: 'high',
        requiresVerification: true,
        checklist: [
          { item: 'Laptop returned', completed: false },
          { item: 'Mobile phone returned', completed: false },
          { item: 'Access cards returned', completed: false },
          { item: 'Other equipment returned', completed: false }
        ]
      },
      
      // Finance Tasks
      {
        name: 'Calculate final settlement',
        description: 'Calculate final salary, benefits, and deductions',
        type: 'final_settlement',
        department: 'finance',
        assignedTo: null,
        daysBeforeLWD: 7,
        priority: 'high',
        requiresVerification: true,
        checklist: [
          { item: 'Salary calculation completed', completed: false },
          { item: 'Leave encashment calculated', completed: false },
          { item: 'Deductions calculated', completed: false },
          { item: 'Final amount approved', completed: false }
        ]
      },
      
      // Admin Tasks
      {
        name: 'Facility access cleanup',
        description: 'Remove facility access and collect access materials',
        type: 'clearance_approval',
        department: 'admin',
        assignedTo: null,
        daysBeforeLWD: 1,
        priority: 'medium',
        requiresVerification: false,
        checklist: [
          { item: 'Office keys returned', completed: false },
          { item: 'Parking pass returned', completed: false },
          { item: 'Locker cleaned out', completed: false }
        ]
      }
    ];

    // Customize tasks based on employee role/department
    return baseTaskTemplates.map(template => ({
      ...template,
      assignedTo: this.getDefaultAssigneeForDepartment(template.department, employee.clientId)
    }));
  }

  /**
   * Calculate task due date based on last working day
   */
  calculateTaskDueDate(lastWorkingDay, daysBeforeLWD) {
    const lwd = new Date(lastWorkingDay);
    const dueDate = new Date(lwd);
    dueDate.setDate(lwd.getDate() - daysBeforeLWD);
    return dueDate;
  }

  /**
   * Get default assignee for department tasks
   */
  getDefaultAssigneeForDepartment(department, clientId) {
    // This would typically query the database for department heads
    // For now, return null and let it be assigned manually
    return null;
  }

  /**
   * Setup manager approval with proper error handling
   */
  async setupManagerApproval(tenantConnection, offboardingRequest) {
    try {
      const Employee = getTenantModel(tenantConnection, 'Employee', require('../models/Employee').schema);
      const employee = await Employee.findById(offboardingRequest.employeeId);
      
      // Check if employee exists
      if (!employee) {
        console.log(`Employee not found for ID: ${offboardingRequest.employeeId}`);
        // Skip to HR approval if employee not found
        await this.advanceToNextStage(tenantConnection, offboardingRequest._id, null, 'Employee not found - auto-advancing to HR approval');
        return;
      }
      
      // Check if employee has a reporting manager
      if (employee.reportingManager) {
        // Add approval record
        offboardingRequest.approvals.push({
          stage: 'manager',
          approver: employee.reportingManager,
          status: 'pending'
        });
        await offboardingRequest.save();
        
        // Send notification to manager
        await this.sendNotification(tenantConnection, {
          type: 'offboarding_approval_required',
          recipientId: employee.reportingManager,
          offboardingRequestId: offboardingRequest._id,
          message: `Offboarding approval required for ${employee.firstName} ${employee.lastName}`
        });
      } else {
        // No manager assigned, skip to HR approval
        console.log(`No reporting manager found for employee: ${employee.firstName} ${employee.lastName}`);
        await this.advanceToNextStage(tenantConnection, offboardingRequest._id, null, 'No manager assigned - auto-advancing to HR approval');
      }
    } catch (error) {
      console.error('Error in setupManagerApproval:', error);
      // If there's any error, skip to HR approval to prevent workflow from breaking
      await this.advanceToNextStage(tenantConnection, offboardingRequest._id, null, 'Error in manager approval setup - auto-advancing to HR approval');
    }
  }

  /**
   * Setup HR approval
   */
  async setupHRApproval(tenantConnection, offboardingRequest) {
    try {
      const hrUsers = await this.getHRUsers(tenantConnection, offboardingRequest.clientId);
      
      if (hrUsers.length > 0) {
        offboardingRequest.approvals.push({
          stage: 'hr',
          approver: hrUsers[0]._id, // Assign to first HR user
          status: 'pending'
        });
        await offboardingRequest.save();
      }
    } catch (error) {
      console.error('Error in setupHRApproval:', error);
      // Continue to next stage even if HR setup fails
      await this.advanceToNextStage(tenantConnection, offboardingRequest._id, null, 'Error in HR approval setup - auto-advancing');
    }
  }

  /**
   * Setup finance approval
   */
  async setupFinanceApproval(tenantConnection, offboardingRequest) {
    // Get finance team members
    const financeUsers = await this.getFinanceUsers(tenantConnection, offboardingRequest.clientId);
    
    if (financeUsers.length > 0) {
      offboardingRequest.approvals.push({
        stage: 'finance',
        approver: financeUsers[0]._id,
        status: 'pending'
      });
      await offboardingRequest.save();
    }
  }

  /**
   * Initiate asset clearance process
   */
  async initiateAssetClearance(tenantConnection, offboardingRequest) {
    const AssetClearance = getTenantModel(tenantConnection, 'AssetClearance', assetClearanceSchema);
    
    // Get employee's assigned assets
    const Asset = getTenantModel(tenantConnection, 'Asset', require('../models/Asset').schema);
    const assignedAssets = await Asset.find({ 
      assignedTo: offboardingRequest.employeeId,
      status: 'assigned'
    });

    const assetClearance = new AssetClearance({
      offboardingRequestId: offboardingRequest._id,
      clientId: offboardingRequest.clientId,
      employeeId: offboardingRequest.employeeId,
      clearanceStartDate: new Date(),
      expectedCompletionDate: new Date(offboardingRequest.lastWorkingDay),
      physicalAssets: assignedAssets.map(asset => ({
        assetId: asset._id,
        assetType: asset.type,
        assetName: asset.name,
        assetCode: asset.assetCode,
        serialNumber: asset.serialNumber,
        brand: asset.brand,
        model: asset.model,
        assignedDate: asset.assignedDate,
        returnStatus: 'pending'
      }))
    });

    await assetClearance.save();
    return assetClearance;
  }

  /**
   * Initiate knowledge transfer process
   */
  async initiateKnowledgeTransfer(tenantConnection, offboardingRequest) {
    const HandoverDetail = getTenantModel(tenantConnection, 'HandoverDetail', handoverDetailSchema);
    
    const handoverDetail = new HandoverDetail({
      offboardingRequestId: offboardingRequest._id,
      clientId: offboardingRequest.clientId,
      employeeId: offboardingRequest.employeeId,
      overallStatus: 'not_started',
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(offboardingRequest.lastWorkingDay)
    });

    await handoverDetail.save();
    return handoverDetail;
  }

  /**
   * Initiate final settlement calculation
   */
  async initiateFinalSettlement(tenantConnection, offboardingRequest) {
    const FinalSettlement = getTenantModel(tenantConnection, 'FinalSettlement', finalSettlementSchema);
    
    const finalSettlement = new FinalSettlement({
      offboardingRequestId: offboardingRequest._id,
      clientId: offboardingRequest.clientId,
      employeeId: offboardingRequest.employeeId,
      settlementPeriod: {
        fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        toDate: new Date(offboardingRequest.lastWorkingDay)
      },
      calculationStatus: 'draft'
    });

    await finalSettlement.save();
    return finalSettlement;
  }

  /**
   * Initiate exit interview process
   */
  async initiateExitInterview(tenantConnection, offboardingRequest) {
    const ExitFeedback = getTenantModel(tenantConnection, 'ExitFeedback', exitFeedbackSchema);
    
    const exitFeedback = new ExitFeedback({
      offboardingRequestId: offboardingRequest._id,
      clientId: offboardingRequest.clientId,
      employeeId: offboardingRequest.employeeId,
      completionStatus: 'not_started'
    });

    await exitFeedback.save();
    return exitFeedback;
  }

  /**
   * Complete offboarding process
   */
  async completeOffboarding(tenantConnection, offboardingRequest) {
    // Get the complete employee data before removing from employees collection
    const TenantEmployee = tenantConnection.models.Employee || tenantConnection.model('Employee', require('../models/tenant/TenantEmployee'));

    const employeeData = await TenantEmployee.findById(offboardingRequest.employeeId).lean();

    if (employeeData) {
      // Store complete employee data in offboarding record
      offboardingRequest.employeeSnapshot = {
        // Basic Information
        _id: employeeData._id,
        firstName: employeeData.firstName,
        lastName: employeeData.lastName,
        email: employeeData.email,
        phone: employeeData.phone,
        employeeCode: employeeData.employeeCode,

        // Employment Information
        joiningDate: employeeData.joiningDate,
        designation: employeeData.designation,
        department: employeeData.department,
        departmentId: employeeData.departmentId,
        reportingManager: employeeData.reportingManager,

        // Salary Information
        salary: employeeData.salary,

        // Status Information
        isActive: employeeData.isActive,
        isFirstLogin: employeeData.isFirstLogin,
        mustChangePassword: employeeData.mustChangePassword,
        terminatedAt: new Date(), // Mark termination date

        // Metadata
        createdBy: employeeData.createdBy,
        createdAt: employeeData.createdAt,
        updatedAt: employeeData.updatedAt,

        // Original status before termination
        originalStatus: employeeData.status,
        terminationReason: offboardingRequest.reason,
        terminationDetails: offboardingRequest.reasonDetails,
        lastWorkingDay: offboardingRequest.lastWorkingDay
      };

      // Remove employee from employees collection
      await TenantEmployee.findByIdAndDelete(offboardingRequest.employeeId);

      console.log(`✅ Employee ${employeeData.firstName} ${employeeData.lastName} (${employeeData.employeeCode}) removed from employees collection and archived in offboarding record`);
    } else {
      console.warn(`⚠️  Employee ${offboardingRequest.employeeId} not found in employees collection during offboarding completion`);
    }

    // Update offboarding record status
    offboardingRequest.status = this.workflowStatus.CLOSED;
    offboardingRequest.isCompleted = true;
    offboardingRequest.completedAt = new Date();
    offboardingRequest.completionPercentage = 100;

    await offboardingRequest.save();
  }

  /**
   * Validate stage transition
   */
  validateStageTransition(offboardingRequest, nextStage) {
    const currentStage = offboardingRequest.currentStage;
    const validTransitions = this.stateTransitions[currentStage];
    return validTransitions && validTransitions.includes(nextStage);
  }

  /**
   * Get status for workflow stage
   */
  getStatusForStage(stage) {
    const stageStatusMap = {
      [this.workflowStates.INITIATION]: this.workflowStatus.INITIATED,
      [this.workflowStates.MANAGER_APPROVAL]: this.workflowStatus.APPROVALS_PENDING,
      [this.workflowStates.HR_APPROVAL]: this.workflowStatus.APPROVALS_PENDING,
      [this.workflowStates.FINANCE_APPROVAL]: this.workflowStatus.APPROVALS_PENDING,
      [this.workflowStates.CHECKLIST_GENERATION]: this.workflowStatus.CHECKLIST_ACTIVE,
      [this.workflowStates.DEPARTMENTAL_CLEARANCE]: this.workflowStatus.CLEARANCE_IN_PROGRESS,
      [this.workflowStates.ASSET_RETURN]: this.workflowStatus.CLEARANCE_IN_PROGRESS,
      [this.workflowStates.KNOWLEDGE_TRANSFER]: this.workflowStatus.CLEARANCE_IN_PROGRESS,
      [this.workflowStates.FINAL_SETTLEMENT]: this.workflowStatus.SETTLEMENT_PENDING,
      [this.workflowStates.EXIT_INTERVIEW]: this.workflowStatus.FEEDBACK_PENDING,
      [this.workflowStates.CLOSURE]: this.workflowStatus.CLOSED
    };
    
    return stageStatusMap[stage] || this.workflowStatus.INITIATED;
  }

  /**
   * Check if workflow can advance to next stage
   */
  canAdvanceToNextStage(offboardingRequest) {
    // Add validation logic based on current stage requirements
    return true; // Simplified for now
  }

  /**
   * Send notification (placeholder)
   */
  async sendNotification(tenantConnection, notificationData) {
    // Implementation would integrate with notification service
    console.log('Notification sent:', notificationData);
  }

  /**
   * Get HR users for tenant
   */
  async getHRUsers(tenantConnection, clientId) {
    const User = getTenantModel(tenantConnection, 'User', require('../models/User').schema);
    return await User.find({ clientId, role: 'hr', isActive: true });
  }

  /**
   * Get finance users for tenant
   */
  async getFinanceUsers(tenantConnection, clientId) {
    const User = getTenantModel(tenantConnection, 'User', require('../models/User').schema);
    return await User.find({ clientId, role: 'admin', isActive: true }); // Assuming admin handles finance
  }
}

module.exports = new OffboardingWorkflowEngine();
