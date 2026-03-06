const { getTenantModel } = require('../utils/tenantModels');
const emailService = require('../config/email.config');

exports.getProjects = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const { status, client, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (client) query.client = client;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { projectCode: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query).sort({ createdAt: -1 }).lean();

    // Manually populate references
    for (let project of projects) {
      if (project.client) {
        const clientData = await Client.findById(project.client).select('name clientCode').lean();
        if (clientData) project.client = clientData;
      }
      if (project.projectManager) {
        const manager = await TenantUser.findById(project.projectManager).select('firstName lastName email').lean();
        if (manager) project.projectManager = manager;
      }
      if (project.teamMembers && project.teamMembers.length > 0) {
        for (let member of project.teamMembers) {
          if (member.employee) {
            const emp = await TenantUser.findById(member.employee).select('firstName lastName employeeCode designation').lean();
            if (emp) member.employee = emp;
          }
        }
      }
    }

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProject = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const project = await Project.findById(req.params.id).lean();
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Populate client
    if (project.client) {
      const clientData = await Client.findById(project.client).lean();
      if (clientData) project.client = clientData;
    }

    // Populate project manager
    if (project.projectManager) {
      const manager = await TenantUser.findById(project.projectManager).select('firstName lastName email phone').lean();
      if (manager) project.projectManager = manager;
    }

    // Populate team members
    if (project.teamMembers && project.teamMembers.length > 0) {
      for (let member of project.teamMembers) {
        if (member.employee) {
          const emp = await TenantUser.findById(member.employee).select('firstName lastName employeeCode designation email phone').lean();
          if (emp) member.employee = emp;
        }
      }
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    
    // Generate projectCode if not provided
    if (!req.body.projectCode) {
      const currentYear = new Date().getFullYear();
      const latestProject = await Project.findOne()
        .sort({ createdAt: -1 })
        .select('projectCode')
        .lean();
      
      let nextSequence = 1;
      if (latestProject && latestProject.projectCode) {
        // Extract sequence from projectCode format: PRJYYYY####
        const match = latestProject.projectCode.match(/PRJ(\d{4})(\d+)/);
        if (match && parseInt(match[1]) === currentYear) {
          nextSequence = parseInt(match[2]) + 1;
        }
      }
      req.body.projectCode = `PRJ${currentYear}${String(nextSequence).padStart(5, '0')}`;
    }
    
    // Set approval status and metadata for admin-created projects
    const adminId = req.user._id || req.user.id;
    req.body.approvalStatus = 'approved';
    req.body.approvedBy = adminId;
    req.body.approvedAt = new Date();
    req.body.submittedBy = adminId;
    req.body.submittedAt = new Date();
    
    const project = await Project.create(req.body);
    
    // If team members are assigned, update their current project
    if (project.teamMembers && project.teamMembers.length > 0) {
      try {
        const TenantUserSchema = require('../models/tenant/TenantUser');
        const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
        
        await TenantUser.updateMany(
          { _id: { $in: project.teamMembers.map(tm => tm.employee) } },
          {
            currentProject: project._id,
            currentClient: project.client
          }
        );
      } catch (err) {
        console.warn('Note: Unable to update tenant user current project fields', err.message);
      }
    }
    
    res.status(201).json({ success: true, message: 'Project created and approved successfully', data: project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.status(200).json({ success: true, message: 'Project updated successfully', data: project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignEmployee = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
    
    const { employeeId, role, startDate, endDate, billingRate, billingType } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check if employee already assigned
    const existing = project.teamMembers.find(
      tm => tm.employee.toString() === employeeId && tm.isActive
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'Employee already assigned to this project' });
    }

    project.teamMembers.push({
      employee: employeeId,
      role,
      startDate,
      endDate,
      billingRate,
      billingType,
      isActive: true
    });

    await project.save();

    // Update employee's current project (if field exists in TenantUser schema)
    try {
      await TenantUser.findByIdAndUpdate(employeeId, {
        currentProject: project._id,
        currentClient: project.client
      });
    } catch (err) {
      // Field might not exist, ignore
      console.log('Note: currentProject field may not exist in TenantUser schema');
    }

    res.status(200).json({ success: true, message: 'Employee assigned successfully', data: project });
  } catch (error) {
    console.error('Error assigning employee:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeEmployee = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
    
    const { employeeId } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const member = project.teamMembers.find(
      tm => tm.employee.toString() === employeeId && tm.isActive
    );

    if (!member) {
      return res.status(404).json({ success: false, message: 'Employee not found in project' });
    }

    member.isActive = false;
    member.endDate = new Date();
    await project.save();

    // Clear employee's current project (if field exists)
    try {
      await TenantUser.findByIdAndUpdate(employeeId, {
        currentProject: null,
        currentClient: null
      });
    } catch (err) {
      // Field might not exist, ignore
      console.log('Note: currentProject field may not exist in TenantUser schema');
    }

    res.status(200).json({ success: true, message: 'Employee removed successfully', data: project });
  } catch (error) {
    console.error('Error removing employee:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending projects for admin approval
// @route   GET /api/projects/pending
// @access  Private (Admin/HR only)
exports.getPendingProjects = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const projects = await Project.find({ 
      approvalStatus: 'pending' 
    }).sort({ submittedAt: -1 }).lean();

    // Manually populate references
    for (let project of projects) {
      if (project.client) {
        const clientData = await Client.findById(project.client).select('name clientCode').lean();
        if (clientData) project.client = clientData;
      }
      if (project.projectManager) {
        const manager = await TenantUser.findById(project.projectManager).select('firstName lastName email').lean();
        if (manager) project.projectManager = manager;
      }
      if (project.submittedBy) {
        const submitter = await TenantUser.findById(project.submittedBy).select('firstName lastName email').lean();
        if (submitter) project.submittedBy = submitter;
      }
      if (project.teamMembers && project.teamMembers.length > 0) {
        for (let member of project.teamMembers) {
          if (member.employee) {
            const emp = await TenantUser.findById(member.employee).select('firstName lastName employeeCode designation').lean();
            if (emp) member.employee = emp;
          }
        }
      }
    }

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    console.error('Error fetching pending projects:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a pending project
// @route   POST /api/projects/:id/approve
// @access  Private (Admin/HR only)
exports.approveProject = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Project is not pending approval' });
    }

    // Update project approval status
    project.approvalStatus = 'approved';
    project.approvedBy = req.user._id || req.user.id;
    project.approvedAt = new Date();
    project.status = 'active'; // Activate the project
    await project.save();

    // Update assigned employees' current project
    try {
      await TenantUser.updateMany(
        { _id: { $in: project.teamMembers.map(tm => tm.employee) } },
        {
          currentProject: project._id,
          currentClient: project.client
        }
      );
    } catch (err) {
      console.warn('Note: Unable to update tenant user current project fields', err.message);
    }

    // Populate response data
    const populatedProject = await Project.findById(project._id)
      .populate('client', 'name clientCode')
      .populate('projectManager', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('teamMembers.employee', 'firstName lastName email employeeCode designation')
      .lean();

    // Send approval notification to project manager
    try {
      if (project.projectManager && project.projectManager.email) {
        await emailService.sendProjectApprovalNotification(
          project.projectManager.email,
          populatedProject,
          req.tenant?.companyName || 'HRMS System'
        );
        console.log(`📧 Sent project approval notification to: ${project.projectManager.email}`);
      }
    } catch (emailError) {
      console.warn('Failed to send project approval notification:', emailError.message);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Project approved successfully', 
      data: populatedProject 
    });
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject a pending project
// @route   POST /api/projects/:id/reject
// @access  Private (Admin/HR only)
exports.rejectProject = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const Project = getTenantModel(req.tenant.connection, 'Project');

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Project is not pending approval' });
    }

    // Update project rejection status
    project.approvalStatus = 'rejected';
    project.approvedBy = req.user._id || req.user.id;
    project.approvedAt = new Date();
    project.rejectionReason = rejectionReason.trim();
    await project.save();

    // Populate response data
    const populatedProject = await Project.findById(project._id)
      .populate('client', 'name clientCode')
      .populate('projectManager', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('teamMembers.employee', 'firstName lastName email employeeCode designation')
      .lean();

    // Send rejection notification to project manager
    try {
      if (project.projectManager && project.projectManager.email) {
        await emailService.sendProjectRejectionNotification(
          project.projectManager.email,
          populatedProject,
          req.tenant?.companyName || 'HRMS System'
        );
        console.log(`📧 Sent project rejection notification to: ${project.projectManager.email}`);
      }
    } catch (emailError) {
      console.warn('Failed to send project rejection notification:', emailError.message);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Project rejected successfully', 
      data: populatedProject 
    });
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
