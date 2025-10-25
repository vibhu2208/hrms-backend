const Project = require('../models/Project');
const Employee = require('../models/Employee');

exports.getProjects = async (req, res) => {
  try {
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

    const projects = await Project.find(query)
      .populate('client', 'name clientCode')
      .populate('projectManager', 'firstName lastName email')
      .populate('teamMembers.employee', 'firstName lastName employeeCode designation')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client')
      .populate('projectManager', 'firstName lastName email phone')
      .populate('teamMembers.employee', 'firstName lastName employeeCode designation email phone');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);
    res.status(201).json({ success: true, message: 'Project created successfully', data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.status(200).json({ success: true, message: 'Project updated successfully', data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignEmployee = async (req, res) => {
  try {
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

    // Update employee's current project
    await Employee.findByIdAndUpdate(employeeId, {
      currentProject: project._id,
      currentClient: project.client
    });

    res.status(200).json({ success: true, message: 'Employee assigned successfully', data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeEmployee = async (req, res) => {
  try {
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

    // Clear employee's current project
    await Employee.findByIdAndUpdate(employeeId, {
      currentProject: null,
      currentClient: null
    });

    res.status(200).json({ success: true, message: 'Employee removed successfully', data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
