const { getTenantModel } = require('../utils/tenantModels');

exports.getClients = async (req, res) => {
  try {
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const { status, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: clients.length, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const client = await Client.findById(req.params.id).lean();
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Get projects for this client
    const projects = await Project.find({ client: req.params.id }).lean();

    // Manually populate project manager and team members
    for (let project of projects) {
      if (project.projectManager) {
        const manager = await TenantUser.findById(project.projectManager).select('firstName lastName email').lean();
        if (manager) project.projectManager = manager;
      }
      if (project.teamMembers && project.teamMembers.length > 0) {
        for (let member of project.teamMembers) {
          if (member.employee) {
            const emp = await TenantUser.findById(member.employee).select('firstName lastName employeeCode').lean();
            if (emp) member.employee = emp;
          }
        }
      }
    }

    res.status(200).json({ success: true, data: { client, projects } });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const client = await Client.create(req.body);
    res.status(201).json({ success: true, message: 'Client created successfully', data: client });
  } catch (error) {
    console.error('Error creating client:', error);   
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, message: 'Client updated successfully', data: client });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const Client = getTenantModel(req.tenant.connection, 'Client');
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClientDeploymentSummary = async (req, res) => {
  try {
    const Project = getTenantModel(req.tenant.connection, 'Project');
    const Client = getTenantModel(req.tenant.connection, 'Client');
    
    // Get active projects with team members
    const projects = await Project.find({ status: 'active' }).lean();
    const clients = await Client.find().lean();
    
    const summary = [];
    const clientMap = {};
    
    // Create client map
    clients.forEach(client => {
      clientMap[client._id.toString()] = {
        clientName: client.name,
        clientCode: client.clientCode,
        totalEmployees: 0,
        projects: []
      };
    });
    
    // Count employees per client
    projects.forEach(project => {
      const clientId = project.client?.toString();
      if (clientMap[clientId]) {
        const activeMembers = project.teamMembers?.filter(tm => tm.isActive) || [];
        clientMap[clientId].totalEmployees += activeMembers.length;
        clientMap[clientId].projects.push(project.name);
      }
    });
    
    // Convert to array
    Object.values(clientMap).forEach(client => {
      if (client.totalEmployees > 0) {
        summary.push(client);
      }
    });
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching client deployment summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
