const mongoose = require('mongoose');
const { SPC_ROLES, PROJECT_PERMISSIONS, hasSPCPermission, getUserProjects, canAccessProject, canPerformProjectAction } = require('../config/spcProjectPermissions');
const { getTenantConnection } = require('../config/database.config');

/**
 * Resolve tenant from authenticated request (never hardcode a single company DB).
 */
function resolveCompanyId(req) {
  return req.companyId || req.user?.companyId || req.tenant?.companyId || null;
}

/**
 * SPC Project Controller - Fixed Version
 */

class SPCProjectController {
  /**
   * Get user's dashboard data based on their project assignments
   */
  static async getUserDashboard(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;
      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      const connection = await getTenantConnection(companyId);

      let userProjects;

      if (userRole === 'company_admin' || userRole === 'admin') {
        try {
          const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
          userProjects = await Project.find({}).sort({ createdAt: -1 });
        } catch (projectError) {
          console.error('❌ Error in admin project query:', projectError.message);
          userProjects = [];
        }
      } else {
        try {
          userProjects = await getUserProjects(userId, connection);
        } catch (assignedError) {
          console.error('❌ Error in assigned projects query:', assignedError.message);
          userProjects = [];
        }
      }

      if (!userProjects || userProjects.length === 0) {
        return res.json({
          success: true,
          data: {
            projects: [],
            teamMembers: [],
            stats: {
              totalProjects: 0,
              activeProjects: 0,
              teamMembers: 0
            }
          }
        });
      }

      const dashboardData = {
        projects: userProjects.map(project => ({
          id: project._id,
          name: project.name,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          endDate: project.endDate,
          description: project.description
        })),
        teamMembers: [],
        stats: {
          totalProjects: userProjects.length,
          activeProjects: userProjects.filter(p => p.status === 'active').length,
          teamMembers: 0
        }
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('❌ Error in getUserDashboard:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all projects for the current user
   */
  static async getProjects(req, res) {
    try {
      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      const connection = await getTenantConnection(companyId);
      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');

      let projects;

      if (userRole === SPC_ROLES.COMPANY_ADMIN) {
        projects = await Project.find({});
      } else {
        const userProjects = await getUserProjects(userId, connection);
        const userProjectIds = userProjects.map(p => p._id);
        projects = await Project.find({ _id: { $in: userProjectIds } });
      }

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error getting projects:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve projects',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Create a new project (Admin only)
   */
  static async createProject(req, res) {
    try {
      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      if (!hasSPCPermission(userRole, PROJECT_PERMISSIONS.PROJECT_CREATE)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to create projects'
        });
      }

      const projectData = req.body;
      const connection = await getTenantConnection(companyId);
      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
      const projectCode = `PROJ${Date.now()}`;

      const project = new Project({
        ...projectData,
        projectCode,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await project.save();

      if (projectData.assignedHRs && projectData.assignedHRs.length > 0) {
        const ProjectAssignment = connection.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');

        for (const hrId of projectData.assignedHRs) {
          const assignment = new ProjectAssignment({
            projectId: project._id,
            userId: hrId,
            role: 'hr',
            isActive: true,
            assignedAt: new Date(),
            assignedBy: userId
          });
          await assignment.save();
        }
      }

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } catch (error) {
      console.error('Error creating project:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to create project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get project details by ID
   */
  static async getProjectDetails(req, res) {
    try {
      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }
      const { projectId } = req.params;

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      const connection = await getTenantConnection(companyId);

      const canAccess = await canAccessProject(userId, projectId, userRole, connection);
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this project'
        });
      }

      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error getting project details:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve project details',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update project (Admin and assigned managers only)
   */
  static async updateProject(req, res) {
    try {
      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }
      const { projectId } = req.params;
      const updateData = req.body;

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      const connection = await getTenantConnection(companyId);

      const canPerform = await canPerformProjectAction(userId, userRole, PROJECT_PERMISSIONS.PROJECT_EDIT, projectId, 'project', connection);
      if (!canPerform) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this project'
        });
      }

      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');

      const project = await Project.findByIdAndUpdate(
        projectId,
        {
          ...updateData,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully'
      });
    } catch (error) {
      console.error('Error updating project:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to update project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Assign users to project (Admin only)
   */
  static async assignUsersToProject(req, res) {
    try {
      const user = req.user;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }
      const { projectId } = req.params;
      const { assignedManagers, assignedHRs } = req.body;

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      if (!hasSPCPermission(userRole, PROJECT_PERMISSIONS.USER_ASSIGN_PROJECT)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to assign users to projects'
        });
      }

      const connection = await getTenantConnection(companyId);
      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');

      const project = await Project.findByIdAndUpdate(
        projectId,
        {
          assignedManagers: assignedManagers || [],
          assignedHRs: assignedHRs || [],
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project,
        message: 'Users assigned to project successfully'
      });
    } catch (error) {
      console.error('Error assigning users to project:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to assign users to project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Create team assignments
   */
  static async createTeamAssignments(req, res) {
    try {
      const user = req.user;
      const userId = user._id || user.id;
      let userRole = user.role;

      if (userRole === 'admin') {
        userRole = 'company_admin';
      }
      const { projectId } = req.params;
      const { teamMembers } = req.body;

      const companyId = resolveCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company context required' });
      }

      const connection = await getTenantConnection(companyId);

      const canPerform = await canPerformProjectAction(userId, userRole, PROJECT_PERMISSIONS.TEAM_MANAGE, projectId, 'team', connection);
      if (!canPerform) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to manage team for this project'
        });
      }

      const Project = connection.model('Project', new mongoose.Schema({}, { strict: false }), 'projects');

      const project = await Project.findByIdAndUpdate(
        projectId,
        {
          teamMembers: teamMembers || [],
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        data: project,
        message: 'Team assignments created successfully'
      });
    } catch (error) {
      console.error('Error creating team assignments:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to create team assignments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = SPCProjectController;
