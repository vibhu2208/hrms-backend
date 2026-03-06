const { getTenantConnection } = require('../config/database.config');
const { getTenantModel } = require('../utils/tenantModels');
const TenantUserSchema = require('../models/tenant/TenantUser');
const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const emailService = require('../config/email.config');

// @desc    Get team members reporting to manager
// @route   GET /api/manager/team-members
// @access  Private (Manager only)
exports.getTeamMembers = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching team members for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Find all employees reporting to this manager
    const teamMembers = await TenantUser.find({
      reportingManager: managerEmail,
      isActive: true
    }).select('-password').sort({ firstName: 1 });

    res.status(200).json({
      success: true,
      count: teamMembers.length,
      data: teamMembers
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Schedule a new team meeting
// @route   POST /api/manager/meetings
// @access  Private (Manager only)
exports.createTeamMeeting = async (req, res) => {
  let tenantConnection = null;

  try {
    const {
      title,
      description,
      meetingDate,
      startTime,
      duration = 30,
      meetingType = 'online',
      location,
      meetingLink,
      attendees = []
    } = req.body;

    const managerId = req.user._id || req.user.id;
    const managerEmail = req.user.email;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Meeting title is required' });
    }

    if (!meetingDate || !startTime) {
      return res.status(400).json({ success: false, message: 'Meeting date and time are required' });
    }

    if (meetingType === 'online' && !meetingLink) {
      return res.status(400).json({ success: false, message: 'Meeting link is required for online meetings' });
    }

    if (meetingType === 'offline' && !location) {
      return res.status(400).json({ success: false, message: 'Location is required for offline meetings' });
    }

    const combinedDate = new Date(`${meetingDate}T${startTime}`);
    if (Number.isNaN(combinedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid meeting date or time' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const TeamMeeting = getTenantModel(tenantConnection, 'TeamMeeting');

    if (!TeamMeeting) {
      throw new Error('Team meeting model is not available for this tenant');
    }

    const teamMembers = await TenantUser.find({
      reportingManager: managerEmail,
      isActive: true
    }).select('_id');

    const teamMemberIds = new Set(teamMembers.map(member => member._id.toString()));
    const selectedAttendees = (Array.isArray(attendees) ? attendees : [])
      .filter(id => typeof id === 'string' || typeof id === 'object')
      .map(id => id.toString())
      .filter(id => teamMemberIds.has(id));

    if (selectedAttendees.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one valid team member' });
    }

    // Always include the manager in the attendee list
    selectedAttendees.push(managerId.toString());

    const meeting = await TeamMeeting.create({
      title: title.trim(),
      description,
      meetingDate,
      startTime,
      startDateTime: combinedDate,
      duration,
      meetingType,
      location: meetingType === 'offline' ? location : undefined,
      meetingLink: meetingType === 'online' ? meetingLink : undefined,
      attendees: [...new Set(selectedAttendees)],
      createdBy: managerId,
      status: 'scheduled'
    });

    const populatedMeeting = await TeamMeeting.findById(meeting._id)
      .populate('attendees', 'firstName lastName email designation')
      .populate('createdBy', 'firstName lastName email');

    return res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      data: populatedMeeting
    });
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get meetings scheduled by manager
// @route   GET /api/manager/meetings
// @access  Private (Manager only)
exports.getTeamMeetings = async (req, res) => {
  let tenantConnection = null;

  try {
    const managerId = req.user._id || req.user.id;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const TeamMeeting = getTenantModel(tenantConnection, 'TeamMeeting');

    if (!TeamMeeting) {
      throw new Error('Team meeting model is not available for this tenant');
    }

    const meetings = await TeamMeeting.find({
      createdBy: managerId,
      isActive: { $ne: false }
    })
      .sort({ startDateTime: 1 })
      .populate('attendees', 'firstName lastName email designation')
      .lean();

    res.status(200).json({
      success: true,
      count: meetings.length,
      data: meetings
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update project progress
// @route   PUT /api/manager/projects/:id/progress
// @access  Private (Project Manager only)
exports.updateProjectProgress = async (req, res) => {
  let tenantConnection = null;

  try {
    const { id } = req.params;
    let { percentage, status } = req.body;
    const managerId = req.user._id || req.user.id;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    if (percentage === undefined && !status) {
      return res.status(400).json({
        success: false,
        message: 'Provide progress percentage or status to update'
      });
    }

    if (percentage !== undefined) {
      const parsed = Number(percentage);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ success: false, message: 'Progress percentage must be a number' });
      }
      percentage = Math.max(0, Math.min(100, parsed));
    }

    const allowedStatuses = ['not-started', 'in-progress', 'at-risk', 'completed'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid progress status'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Project = getTenantModel(tenantConnection, 'Project');

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!project.projectManager || project.projectManager.toString() !== managerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project manager can update project progress'
      });
    }

    const updatedProgress = {
      ...project.progress,
      updatedAt: new Date(),
      updatedBy: managerId
    };

    if (percentage !== undefined) {
      updatedProgress.percentage = percentage;
    } else if (updatedProgress.percentage === undefined) {
      updatedProgress.percentage = 0;
    }

    if (status) {
      updatedProgress.status = status;
    } else {
      // Derive status if not explicitly set
      if (updatedProgress.percentage >= 100) {
        updatedProgress.status = 'completed';
      } else if (updatedProgress.percentage > 0) {
        updatedProgress.status = updatedProgress.status && updatedProgress.status !== 'not-started'
          ? updatedProgress.status
          : 'in-progress';
      } else {
        updatedProgress.status = 'not-started';
      }
    }

    project.progress = updatedProgress;
    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('client', 'name clientCode')
      .populate('teamMembers.employee', 'firstName lastName email employeeCode designation')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Project progress updated successfully',
      data: populatedProject
    });
  } catch (error) {
    console.error('Error updating project progress:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create and assign a new project for manager's team
// @route   POST /api/manager/projects
// @access  Private (Manager only)
exports.assignProject = async (req, res) => {
  let tenantConnection = null;

  try {
    const {
      projectName,
      description,
      startDate,
      endDate,
      priority = 'medium',
      clientId,
      location,
      selectedEmployees
    } = req.body;

    const managerId = req.user._id || req.user.id;
    const managerEmail = req.user.email;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H1', location: 'hrms-backend/src/controllers/managerController.js:assignProject:entry', message: 'Manager assignProject called', data: { companyId, managerId: String(managerId), hasTenantConn: Boolean(req?.tenant?.connection), selectedEmployeesCount: Array.isArray(selectedEmployees) ? selectedEmployees.length : null, hasClientId: Boolean(clientId), hasProjectName: Boolean(projectName) }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    if (!projectName || !description || !startDate || !clientId || !location) {
      return res.status(400).json({
        success: false,
        message: 'Project name, description, start date, client, and location are required'
      });
    }

    if (!Array.isArray(selectedEmployees) || selectedEmployees.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one team member' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Project = getTenantModel(tenantConnection, 'Project');
    const Client = getTenantModel(tenantConnection, 'Client');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const client = await Client.findById(clientId).select('_id name');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Validate selected employees belong to this manager
    const teamMembers = await TenantUser.find({
      _id: { $in: selectedEmployees },
      reportingManager: managerEmail,
      isActive: true
    }).select('_id firstName lastName email');

    if (teamMembers.length !== selectedEmployees.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected employees are invalid or not part of your team'
      });
    }

    // Generate project code similar to admin flow
    const currentYear = new Date().getFullYear();
    const latestProject = await Project.findOne()
      .sort({ createdAt: -1 })
      .select('projectCode')
      .lean();

    let nextSequence = 1;
    if (latestProject && latestProject.projectCode) {
      const match = latestProject.projectCode.match(/PRJ(\d{4})(\d+)/);
      if (match && parseInt(match[1], 10) === currentYear) {
        nextSequence = parseInt(match[2], 10) + 1;
      }
    }

    const projectCode = `PRJ${currentYear}${String(nextSequence).padStart(5, '0')}`;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : undefined;

    const newProject = await Project.create({
      projectCode,
      name: projectName,
      client: client._id,
      description,
      location,
      startDate: start,
      endDate: end,
      status: 'planning',
      approvalStatus: 'pending',
      submittedBy: managerId,
      submittedAt: new Date(),
      priority,
      projectManager: managerId,
      teamMembers: teamMembers.map(member => ({
        employee: member._id,
        role: 'Team Member',
        startDate: start,
        isActive: true
      }))
    });

    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H1', location: 'hrms-backend/src/controllers/managerController.js:assignProject:projectCreated', message: 'Project created (pending)', data: { companyId, projectId: String(newProject?._id), approvalStatus: newProject?.approvalStatus, status: newProject?.status }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    // Create approval instance using the approval engine
    try {
      console.log('🔍 Creating approval instance for project:', {
        requestType: 'project',
        requestId: newProject._id,
        requestedBy: managerId,
        companyId: req.companyId
      });
      
      const approvalEngine = require('../services/approvalEngine');

      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H1', location: 'hrms-backend/src/controllers/managerController.js:assignProject:createApprovalInstance:before', message: 'Creating approval instance for project', data: { requestType: 'project', requestId: String(newProject?._id), requestedBy: String(managerId) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      
      const approvalInstance = await approvalEngine.createApprovalInstance({
        requestType: 'project',
        requestId: newProject._id,
        requestedBy: managerId,
        companyId: req.companyId,
        metadata: {
          projectName: projectName,
          projectCode: projectCode,
          client: client.name,
          priority: priority,
          estimatedDuration: end ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) : null
        }
      }, req.tenant.connection);

      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H1', location: 'hrms-backend/src/controllers/managerController.js:assignProject:createApprovalInstance:after', message: 'Approval instance created for project', data: { instanceId: String(approvalInstance?._id), instanceStatus: approvalInstance?.status, currentLevel: approvalInstance?.currentLevel, totalLevels: approvalInstance?.totalLevels, firstApproverId: approvalInstance?.approvalChain?.[0]?.approverId ? String(approvalInstance.approvalChain[0].approverId) : null }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      
      console.log(`✅ Project approval instance created: ${approvalInstance._id}`);
      console.log('Approval instance details:', {
        id: approvalInstance._id,
        status: approvalInstance.status,
        currentLevel: approvalInstance.currentLevel,
        totalLevels: approvalInstance.totalLevels,
        approvalChain: approvalInstance.approvalChain
      });
      
      // Update project with approval instance reference
      newProject.approvalInstanceId = approvalInstance._id;
      await newProject.save();
      
    } catch (approvalError) {
      console.error('Failed to create project approval instance:', approvalError);
      console.error('Stack trace:', approvalError.stack);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H1', location: 'hrms-backend/src/controllers/managerController.js:assignProject:createApprovalInstance:error', message: 'Approval instance creation failed', data: { errorMessage: String(approvalError?.message || approvalError) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      // Don't fail the project creation if approval workflow fails
    }

    // Attempt to set current project for assigned employees (best effort)
    try {
      await TenantUser.updateMany(
        { _id: { $in: selectedEmployees } },
        {
          currentProject: newProject._id,
          currentClient: client._id
        }
      );
    } catch (updateError) {
      console.warn('Note: Unable to update tenant user current project fields', updateError.message);
    }

    const populatedProject = await Project.findById(newProject._id)
      .populate('client', 'name clientCode')
      .populate('teamMembers.employee', 'firstName lastName email employeeCode designation')
      .lean();

    // Send notification to admins about pending project
    try {
      // Find admin users to notify
      const adminUsers = await TenantUser.find({
        role: { $in: ['admin', 'hr'] },
        isActive: true
      }).select('email firstName lastName').lean();

      if (adminUsers.length > 0) {
        const projectDetails = {
          ...populatedProject,
          submittedBy: {
            firstName: req.user.firstName,
            lastName: req.user.lastName
          }
        };

        // Send notifications to all admins
        const notificationPromises = adminUsers.map(admin => 
          emailService.sendProjectSubmissionNotification(
            admin.email,
            projectDetails,
            req.tenant?.companyName || 'HRMS System'
          ).catch(err => console.warn('Failed to send email to admin:', admin.email, err.message))
        );

        await Promise.allSettled(notificationPromises);
        console.log(`📧 Sent project submission notifications to ${adminUsers.length} admins`);
      }
    } catch (emailError) {
      console.warn('Failed to send project submission notifications:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Project submitted for approval successfully',
      data: populatedProject
    });
  } catch (error) {
    console.error('Error assigning project:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get team statistics
// @route   GET /api/manager/team-stats
// @access  Private (Manager only)
exports.getTeamStats = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching team stats for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Get total team members
    const totalMembers = await TenantUser.countDocuments({
      reportingManager: managerEmail,
      isActive: true
    });

    // TODO: Get attendance data for present/absent counts
    // For now, returning mock data structure
    const stats = {
      totalMembers: totalMembers,
      present: 0, // TODO: Calculate from today's attendance
      onLeave: 0, // TODO: Calculate from leave requests
      pendingApprovals: 0 // TODO: Calculate from pending leave requests
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching team stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get clients list for manager project assignment
// @route   GET /api/manager/clients
// @access  Private (Manager only)
exports.getManagerClients = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Client = getTenantModel(tenantConnection, 'Client');

    const clients = await Client.find({})
      .select('name companyName clientCode email phone status contactPerson')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    console.error('Error fetching manager clients:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending leave requests for team
// @route   GET /api/manager/pending-leaves
// @access  Private (Manager only)
exports.getPendingLeaves = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId; // From auth middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching pending leaves for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Fetch pending leave requests for this manager's team
    const pendingLeaves = await LeaveRequest.find({
      reportingManager: managerEmail,
      status: 'pending'
    }).sort({ appliedOn: -1 });

    console.log(`✅ Found ${pendingLeaves.length} pending leave requests`);

    res.status(200).json({
      success: true,
      count: pendingLeaves.length,
      data: pendingLeaves
    });
  } catch (error) {
    console.error('Error fetching pending leaves:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get approval history for manager
// @route   GET /api/manager/approval-history
// @access  Private (Manager only)
exports.getApprovalHistory = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerEmail = req.user.email;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching approval history for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Find all leave requests approved or rejected by this manager
    const approvedRequests = await LeaveRequest.find({
      $or: [
        { approvedByEmail: managerEmail },
        { rejectedByEmail: managerEmail }
      ],
      status: { $in: ['approved', 'rejected'] }
    })
    .sort({ approvedOn: -1, rejectedOn: -1 })
    .lean();

    console.log(`✅ Found ${approvedRequests.length} approved/rejected requests for manager ${managerEmail}`);

    res.status(200).json({
      success: true,
      count: approvedRequests.length,
      data: approvedRequests
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
    }
  }
};

// @desc    Approve leave request
// @route   PUT /api/manager/leave/:id/approve
// @access  Private (Manager only)
exports.approveLeave = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Find leave request
    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Verify it's for this manager's team
    if (leaveRequest.reportingManager !== managerEmail) {
      console.log(`🚫 Security check failed: Manager ${managerEmail} trying to approve leave for ${leaveRequest.employeeEmail}, reported to ${leaveRequest.reportingManager}`);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this leave request'
      });
    }

    // Prevent self-approval
    if (leaveRequest.employeeEmail === managerEmail) {
      console.log(`🚫 Self-approval blocked: ${managerEmail} trying to approve own leave`);
      return res.status(403).json({
        success: false,
        message: 'You cannot approve your own leave request',
        code: 'SELF_APPROVAL_FORBIDDEN'
      });
    }

    // Update leave request
    leaveRequest.status = 'approved';
    leaveRequest.approvedBy = managerName;
    leaveRequest.approvedByEmail = managerEmail;
    leaveRequest.approvedOn = new Date();
    leaveRequest.approvalComments = comments || '';

    await leaveRequest.save();

    // Update approval workflow if exists
    if (leaveRequest.approvalInstanceId) {
      try {
        const approvalEngine = require('../services/approvalEngine');
        await approvalEngine.processApproval(
          leaveRequest.approvalInstanceId,
          managerEmail,
          'approved',
          comments,
          tenantConnection
        );
        console.log(`✅ Approval workflow updated: ${leaveRequest.approvalInstanceId}`);
      } catch (approvalError) {
        console.error('⚠️  Error updating approval workflow:', approvalError.message);
        // Don't fail the approval if workflow update fails
      }
    }

    // Update leave balance - deduct consumed days
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    const year = new Date(leaveRequest.startDate).getFullYear();
    
    const leaveBalance = await LeaveBalance.findOne({
      employeeEmail: leaveRequest.employeeEmail,
      year: year,
      leaveType: leaveRequest.leaveType
    });

    if (leaveBalance) {
      leaveBalance.consumed += leaveRequest.numberOfDays;
      // Let the pre-save middleware handle the available calculation
      await leaveBalance.save();
      console.log(`📊 Updated balance: ${leaveRequest.leaveType} - Consumed: ${leaveBalance.consumed}/${leaveBalance.total}`);
    }

    console.log(`✅ Leave approved: ${id} by ${managerEmail}`);

    res.status(200).json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject leave request
// @route   PUT /api/manager/leave/:id/reject
// @access  Private (Manager only)
exports.rejectLeave = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;
    const companyId = req.companyId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    // Find leave request
    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Verify it's for this manager's team
    if (leaveRequest.reportingManager !== managerEmail) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this leave request'
      });
    }

    // Update leave request
    leaveRequest.status = 'rejected';
    leaveRequest.rejectedBy = managerName;
    leaveRequest.rejectedByEmail = managerEmail;
    leaveRequest.rejectedOn = new Date();
    leaveRequest.rejectionReason = reason;

    await leaveRequest.save();

    console.log(`❌ Leave rejected: ${id} by ${managerEmail}`);

    res.status(200).json({
      success: true,
      message: 'Leave request rejected successfully',
      data: leaveRequest
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get manager's assigned projects
// @route   GET /api/manager/projects
// @access  Private (Manager only)
exports.getManagerProjects = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const managerId = req.user._id || req.user.id;
    const managerEmail = req.user.email;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    console.log(`📊 Fetching projects for manager: ${managerEmail}, company: ${companyId}`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const Project = getTenantModel(tenantConnection, 'Project');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    const Client = getTenantModel(tenantConnection, 'Client');

    // Find projects where manager is projectManager or team member
    const projects = await Project.find({
      $or: [
        { projectManager: managerId },
        { 'teamMembers.employee': managerId, 'teamMembers.isActive': true }
      ],
      isActive: true
    })
    .populate('client', 'name clientCode')
    .populate('projectManager', 'firstName lastName email')
    .populate('submittedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .populate('teamMembers.employee', 'firstName lastName email employeeCode designation')
    .sort({ createdAt: -1 })
    .lean();

    // Enrich project data with manager's role and current project status
    const enrichedProjects = projects.map(project => {
      const isProjectManager = project.projectManager?._id?.toString() === managerId.toString();
      const teamMemberInfo = project.teamMembers?.find(
        tm => tm.employee?._id?.toString() === managerId.toString() && tm.isActive
      );

      return {
        ...project,
        managerRole: isProjectManager ? 'Project Manager' : teamMemberInfo?.role || 'Team Member',
        isCurrentProject: project.status === 'active' && project.approvalStatus === 'approved',
        approvalStatus: project.approvalStatus,
        canEdit: isProjectManager && project.approvalStatus === 'pending',
        myStartDate: teamMemberInfo?.startDate,
        myEndDate: teamMemberInfo?.endDate,
        teamSize: project.teamMembers?.filter(tm => tm.isActive).length || 0,
        submittedAt: project.submittedAt,
        approvedAt: project.approvedAt,
        rejectionReason: project.rejectionReason
      };
    });

    // Separate projects by status
    const currentProjects = enrichedProjects.filter(p => p.isCurrentProject);
    const pendingProjects = enrichedProjects.filter(p => p.approvalStatus === 'pending');
    const rejectedProjects = enrichedProjects.filter(p => p.approvalStatus === 'rejected');
    const pastProjects = enrichedProjects.filter(p => !p.isCurrentProject && p.approvalStatus !== 'pending' && p.approvalStatus !== 'rejected');

    res.status(200).json({
      success: true,
      count: enrichedProjects.length,
      data: {
        current: currentProjects,
        pending: pendingProjects,
        rejected: rejectedProjects,
        past: pastProjects,
        all: enrichedProjects
      }
    });
  } catch (error) {
    console.error('Error fetching manager projects:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get detailed project information for manager's project
// @route   GET /api/manager/projects/:id
// @access  Private (Manager only)
exports.getManagerProjectDetails = async (req, res) => {
  let tenantConnection = null;

  try {
    const { id } = req.params;
    const managerId = req.user._id || req.user.id;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Project = getTenantModel(tenantConnection, 'Project');
    const Client = getTenantModel(tenantConnection, 'Client');
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const project = await Project.findById(id).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Hydrate related data
    let client = null;
    if (project.client) {
      client = await Client.findById(project.client).select('name clientCode email phone').lean();
    }

    let projectManager = null;
    if (project.projectManager) {
      projectManager = await TenantUser.findById(project.projectManager)
        .select('firstName lastName email phone designation employeeCode')
        .lean();
    }

    const teamMembers = [];
    if (Array.isArray(project.teamMembers) && project.teamMembers.length) {
      const memberIds = project.teamMembers
        .filter(member => member.employee)
        .map(member => member.employee);

      const memberDocs = await TenantUser.find({ _id: { $in: memberIds } })
        .select('firstName lastName email employeeCode designation phone')
        .lean();

      const memberDocMap = memberDocs.reduce((acc, doc) => {
        acc[doc._id.toString()] = doc;
        return acc;
      }, {});

      for (const member of project.teamMembers) {
        const employeeDoc = member.employee ? memberDocMap[member.employee.toString()] : null;
        teamMembers.push({
          ...member,
          employee: employeeDoc || null
        });
      }
    }

    const isProjectManager = project.projectManager?.toString() === managerId.toString();
    const teamMemberInfo = teamMembers.find(
      tm => tm.employee?._id?.toString() === managerId.toString() && tm.isActive
    );

    if (!isProjectManager && !teamMemberInfo) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this project'
      });
    }

    const detailedProject = {
      ...project,
      client,
      projectManager,
      teamMembers,
      managerRole: isProjectManager ? 'Project Manager' : teamMemberInfo?.role || 'Team Member',
      teamSize: project.teamMembers?.filter(tm => tm.isActive).length || 0,
      myStartDate: teamMemberInfo?.startDate,
      myEndDate: teamMemberInfo?.endDate
    };

    return res.status(200).json({
      success: true,
      data: detailedProject
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
