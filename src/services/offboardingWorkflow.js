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
   * Calculate experience in years and months from two dates
   */
  calculateExperience(startDate, endDate) {
    if (!startDate || !endDate) {
      return { years: 0, months: 0 };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // Adjust for days
    if (end.getDate() < start.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months += 12;
      }
    }
    
    return { years, months };
  }

  /**
   * Complete offboarding process
   */
  async completeOffboarding(tenantConnection, offboardingRequest) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:583',message:'completeOffboarding entry',data:{employeeId:offboardingRequest.employeeId,status:offboardingRequest.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Get the complete employee data before marking as ex-employee
    const TenantEmployee = tenantConnection.models.Employee || tenantConnection.model('Employee', require('../models/tenant/TenantEmployee'));
    const TalentPool = require('../models/TalentPool');

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:588',message:'Before employee findById',data:{employeeId:offboardingRequest.employeeId,employeeIdType:typeof offboardingRequest.employeeId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const employeeData = await TenantEmployee.findById(offboardingRequest.employeeId);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:594',message:'After employee findById',data:{employeeFound:!!employeeData,employeeId:employeeData?._id,employeeCode:employeeData?.employeeCode,firstName:employeeData?.firstName,lastName:employeeData?.lastName,email:employeeData?.email,currentIsExEmployee:employeeData?.isExEmployee,currentIsActive:employeeData?.isActive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!employeeData) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:600',message:'Employee not found - cannot complete offboarding',data:{employeeId:offboardingRequest.employeeId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw new Error('Employee not found');
    }

    // Check if employee is already an ex-employee
    if (employeeData.isExEmployee) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:606',message:'Employee already marked as ex-employee - checking candidate',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode,isExEmployee:employeeData.isExEmployee},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
      
      // Even if already ex-employee, ensure candidate exists
      try {
        const Candidate = getTenantModel(tenantConnection, 'Candidate', require('../models/Candidate'));
        const existingCandidate = await Candidate.findOne({
          $or: [
            { exEmployeeId: employeeData._id },
            { exEmployeeCode: employeeData.employeeCode },
            { email: employeeData.email, isExEmployee: true }
          ]
        });
        
        if (!existingCandidate) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:620',message:'Ex-employee found but no candidate - creating candidate',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
          // #endregion
          // Employee is ex-employee but candidate doesn't exist - create it
          // This will be handled in the main flow below
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:625',message:'Ex-employee already has candidate - skipping',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode,candidateCode:existingCandidate.candidateCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
          // #endregion
          console.log(`ℹ️  Employee ${employeeData.employeeCode} is already an ex-employee with candidate ${existingCandidate.candidateCode}`);
          // Still mark offboarding as completed even if employee is already processed
          if (offboardingRequest && typeof offboardingRequest.save === 'function') {
            offboardingRequest.status = 'completed';
            offboardingRequest.currentStage = 'success';
            offboardingRequest.completedAt = new Date();
            await offboardingRequest.save();
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:636',message:'Offboarding marked as completed for already-processed ex-employee',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            // #endregion
          }
          return { success: true, message: 'Employee already processed as ex-employee' };
        }
      } catch (candidateCheckError) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:631',message:'Error checking candidate for ex-employee',data:{error:candidateCheckError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
        console.warn('Error checking candidate for ex-employee:', candidateCheckError);
        // Continue with normal flow
      }
    }

    if (employeeData) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:646',message:'Starting offboarding processing',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode,isExEmployee:employeeData.isExEmployee,isActive:employeeData.isActive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
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

      // Calculate experience from joining date to termination date
      const terminationDate = offboardingRequest.lastWorkingDay || new Date();
      const experience = this.calculateExperience(employeeData.joiningDate, terminationDate);

      // Mark employee as ex-employee instead of deleting
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:633',message:'Before marking as ex-employee',data:{employeeId:employeeData._id,currentIsExEmployee:employeeData.isExEmployee,currentIsActive:employeeData.isActive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      employeeData.isExEmployee = true;
      employeeData.isActive = false;
      employeeData.status = 'terminated';
      employeeData.terminatedAt = terminationDate;
      employeeData.terminationReason = offboardingRequest.reason || 'Offboarding completed';
      
      // Don't modify department field - it might cause validation errors
      // Only update isExEmployee, isActive, status, and termination fields
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:712',message:'Before employee save',data:{employeeId:employeeData._id,isExEmployee:employeeData.isExEmployee,isActive:employeeData.isActive,status:employeeData.status,department:employeeData.department,departmentId:employeeData.departmentId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      try {
        await employeeData.save();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:718',message:'After employee save - success',data:{employeeId:employeeData._id,isExEmployee:employeeData.isExEmployee,isActive:employeeData.isActive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (saveError) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:721',message:'Employee save failed',data:{employeeId:employeeData._id,error:saveError.message,errorStack:saveError.stack,employeeData:{department:employeeData.department,departmentId:employeeData.departmentId,isExEmployee:employeeData.isExEmployee,isActive:employeeData.isActive}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.error('❌ Failed to save employee as ex-employee:', saveError);
        // Try using updateOne directly to bypass validation if needed
        try {
          const updateResult = await TenantEmployee.updateOne(
            { _id: employeeData._id },
            { 
              $set: { 
                isExEmployee: true,
                isActive: false,
                status: 'terminated',
                terminatedAt: terminationDate,
                terminationReason: offboardingRequest.reason || 'Offboarding completed'
              }
            },
            { runValidators: false } // Bypass validation
          );
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:728',message:'Employee updated using updateOne (bypassed validation)',data:{employeeId:employeeData._id,matchedCount:updateResult.matchedCount,modifiedCount:updateResult.modifiedCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Verify the update worked by re-fetching
          const verifyAfterUpdate = await TenantEmployee.findById(employeeData._id).lean();
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:736',message:'Verification after updateOne',data:{employeeId:employeeData._id,employeeCode:employeeData.employeeCode,isExEmployee:verifyAfterUpdate?.isExEmployee,isActive:verifyAfterUpdate?.isActive},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          if (verifyAfterUpdate && verifyAfterUpdate.isExEmployee !== true) {
            // Update didn't work, try using findByIdAndUpdate
            await TenantEmployee.findByIdAndUpdate(
              employeeData._id,
              { 
                $set: { 
                  isExEmployee: true,
                  isActive: false,
                  status: 'terminated',
                  terminatedAt: terminationDate,
                  terminationReason: offboardingRequest.reason || 'Offboarding completed'
                }
              },
              { new: true, runValidators: false }
            );
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:750',message:'Used findByIdAndUpdate as fallback',data:{employeeId:employeeData._id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          }
          
          console.log(`✅ Employee ${employeeData.employeeCode} marked as ex-employee using updateOne`);
        } catch (updateError) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:755',message:'updateOne also failed',data:{employeeId:employeeData._id,error:updateError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          throw new Error(`Failed to mark employee as ex-employee: ${updateError.message}`);
        }
      }
      
      // Verify the save by re-fetching from database
      const verifyEmployee = await TenantEmployee.findById(employeeData._id).lean();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:643',message:'Verifying employee after save',data:{employeeId:verifyEmployee?._id,isExEmployee:verifyEmployee?.isExEmployee,isActive:verifyEmployee?.isActive,employeeCode:verifyEmployee?.employeeCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Add ex-employee to talent pool
      try {
        const talentPoolData = {
          name: `${employeeData.firstName} ${employeeData.lastName}`,
          email: employeeData.email,
          phone: employeeData.phone || '',
          desiredDepartment: employeeData.department || 'General',
          desiredPosition: employeeData.designation || 'Previous Role',
          experience: {
            years: experience.years,
            months: experience.months
          },
          currentCompany: 'Previous Employer',
          currentDesignation: employeeData.designation,
          currentCTC: employeeData.salary?.total || employeeData.salary || null,
          skills: [], // Can be populated from employee profile if available
          status: 'new',
          isExEmployee: true,
          exEmployeeId: employeeData._id,
          exEmployeeCode: employeeData.employeeCode,
          comments: `Ex-employee from ${employeeData.department || 'General'} department. ${offboardingRequest.reason ? `Reason: ${offboardingRequest.reason}` : ''}`,
          timeline: [{
            action: 'Added from Offboarding',
            description: `Employee offboarding completed. Previous employee code: ${employeeData.employeeCode}. Experience: ${experience.years} years ${experience.months} months.`,
            timestamp: new Date()
          }]
        };

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:669',message:'Before talent pool create',data:{email:talentPoolData.email,name:talentPoolData.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        const talentPoolEntry = await TalentPool.create(talentPoolData);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:671',message:'Talent pool created successfully',data:{talentCode:talentPoolEntry.talentCode,isExEmployee:talentPoolEntry.isExEmployee},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

        console.log(`✅ Employee ${employeeData.firstName} ${employeeData.lastName} (${employeeData.employeeCode}) marked as ex-employee and added to talent pool (${talentPoolEntry.talentCode})`);
        
        // Also add ex-employee to candidate pool
        try {
          const Candidate = getTenantModel(tenantConnection, 'Candidate', require('../models/Candidate'));
          // Capture employee data values immediately to avoid closure issues
          const empFirstName = String(employeeData.firstName || '').trim();
          const empLastName = String(employeeData.lastName || '').trim();
          const empEmail = String(employeeData.email || '').trim();
          const empPhone = String(employeeData.phone || '').trim();
          const empCode = String(employeeData.employeeCode || '').trim();
          
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:707',message:'Creating candidate for ex-employee',data:{employeeId:employeeData._id,employeeCode:empCode,firstName:empFirstName,lastName:empLastName,email:empEmail,phone:empPhone},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          
          // Check if candidate already exists for this ex-employee
          const existingCandidate = await Candidate.findOne({
            $or: [
              { exEmployeeId: employeeData._id },
              { exEmployeeCode: empCode },
              { email: empEmail, isExEmployee: true }
            ]
          });
          
          if (existingCandidate) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:720',message:'Candidate already exists for ex-employee',data:{candidateId:existingCandidate._id,candidateCode:existingCandidate.candidateCode,exEmployeeCode:empCode,existingFirstName:existingCandidate.firstName,existingLastName:existingCandidate.lastName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            console.log(`⚠️  Candidate already exists for ex-employee ${empFirstName} ${empLastName} (${empCode}): ${existingCandidate.candidateCode}`);
            // Update existing candidate if needed
            if (existingCandidate.firstName !== empFirstName || existingCandidate.lastName !== empLastName) {
              existingCandidate.firstName = empFirstName;
              existingCandidate.lastName = empLastName;
              await existingCandidate.save();
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:728',message:'Updated existing candidate name',data:{candidateCode:existingCandidate.candidateCode,newFirstName:empFirstName,newLastName:empLastName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
              // #endregion
              console.log(`✅ Updated candidate name for ${existingCandidate.candidateCode}`);
            }
            // Skip creating new candidate since one already exists
          } else {
            // Create new candidate for ex-employee
            const candidateData = {
              firstName: empFirstName,
              lastName: empLastName,
              email: empEmail,
              phone: empPhone,
              currentLocation: employeeData.address?.city || employeeData.address || '',
              experience: {
                years: experience.years,
                months: experience.months
              },
              currentCompany: 'Previous Employer',
              currentDesignation: employeeData.designation || 'Previous Role',
              currentCTC: employeeData.salary?.total || employeeData.salary || null,
              skills: employeeData.skills || [],
              source: 'internal',
              stage: 'applied',
              status: 'active',
              isExEmployee: true,
              exEmployeeId: employeeData._id,
              exEmployeeCode: empCode,
              notes: `Ex-employee from ${employeeData.department || 'General'} department. ${offboardingRequest.reason ? `Reason: ${offboardingRequest.reason}` : ''}`,
              timeline: [{
                action: 'Added from Offboarding',
                description: `Employee offboarding completed. Previous employee code: ${empCode}. Experience: ${experience.years} years ${experience.months} months.`,
                timestamp: new Date()
              }]
            };
            
            // Generate candidate code
            const lastCandidate = await Candidate.findOne({}).sort({ createdAt: -1 });
            let candidateNumber = 1;
            if (lastCandidate && lastCandidate.candidateCode) {
              const match = lastCandidate.candidateCode.match(/CAND(\d+)/);
              if (match) {
                candidateNumber = parseInt(match[1]) + 1;
              }
            }
            candidateData.candidateCode = `CAND${String(candidateNumber).padStart(5, '0')}`;
            
            const candidateEntry = await Candidate.create(candidateData);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:782',message:'Candidate entry created for ex-employee',data:{candidateCode:candidateEntry.candidateCode,firstName:candidateEntry.firstName,lastName:candidateEntry.lastName,isExEmployee:candidateEntry.isExEmployee,exEmployeeCode:candidateEntry.exEmployeeCode,email:candidateEntry.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            console.log(`✅ Ex-employee ${empFirstName} ${empLastName} (${empCode}) added to candidate pool (${candidateEntry.candidateCode})`);
          }
        } catch (candidateError) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:733',message:'Candidate creation failed for ex-employee',data:{error:candidateError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          console.error('⚠️  Error adding ex-employee to candidate pool:', candidateError);
          // Continue with offboarding completion even if candidate addition fails
        }
      } catch (talentPoolError) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'offboardingWorkflow.js:737',message:'Talent pool creation failed',data:{error:talentPoolError.message,stack:talentPoolError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        console.error('⚠️  Error adding ex-employee to talent pool:', talentPoolError);
        // Continue with offboarding completion even if talent pool addition fails
      }

      console.log(`✅ Employee ${employeeData.firstName} ${employeeData.lastName} (${employeeData.employeeCode}) marked as ex-employee`);
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
