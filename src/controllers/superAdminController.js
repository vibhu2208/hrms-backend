const Client = require('../models/Client');
const Company = require('../models/Company');
const User = require('../models/User');
const Package = require('../models/Package');
const SystemConfig = require('../models/SystemConfig');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../middlewares/auditLog');
const { 
  createTenantDatabase, 
  createTenantAdminUser, 
  initializeTenantDatabase 
} = require('../utils/databaseProvisioning');
const { generateAdminPassword } = require('../utils/generatePassword');
const { sendCompanyAdminCredentials } = require('../services/emailService');

// Dashboard Overview
const getDashboardStats = async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const totalPackages = await Package.countDocuments({ isActive: true });

    // Recent activities
    const recentActivities = await AuditLog.find()
      .populate('userId', 'email role')
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .limit(10);

    // Client status distribution
    const clientStats = await Client.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Subscription status distribution
    const subscriptionStats = await Client.aggregate([
      {
        $group: {
          _id: '$subscription.status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalClients,
          activeClients,
          totalUsers,
          totalPackages
        },
        clientStats,
        subscriptionStats,
        recentActivities
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// System Health Check
const getSystemHealth = async (req, res) => {
  try {
    const dbStatus = 'connected'; // You can add actual DB health check
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Check for expiring subscriptions
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const expiringSubscriptions = await CompanyRegistry.find({
      'subscription.endDate': {
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      'subscription.status': 'active'
    }).select('companyName companyCode subscription.endDate');

    res.json({
      success: true,
      data: {
        database: dbStatus,
        uptime: Math.floor(uptime / 60), // in minutes
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) // MB
        },
        alerts: {
          expiringSubscriptions: expiringSubscriptions.length,
          details: expiringSubscriptions
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking system health',
      error: error.message
    });
  }
};

// Client Management
const getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      subscriptionStatus = ''
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { companyCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'companyAdmin.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Subscription status filter
    if (subscriptionStatus) {
      query['subscription.status'] = subscriptionStatus;
    }

    const skip = (page - 1) * limit;
    
    // Use CompanyRegistry from global database instead of Client model
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const clients = await CompanyRegistry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CompanyRegistry.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Get ClientPackage data for each client to show current active packages
    const ClientPackage = require('../models/ClientPackage');
    const clientsWithPackages = await Promise.all(
      clients.map(async (client) => {
        const clientObj = client.toObject();
        
        // Get active ClientPackages for this client
        const activePackages = await ClientPackage.find({
          clientId: client._id,
          status: { $in: ['active', 'trial'] }
        }).populate('packageId', 'name type pricing');
        
        clientObj.activePackages = activePackages;
        clientObj.hasActivePackage = activePackages.length > 0;
        
        // Map CompanyRegistry fields to match expected frontend structure
        clientObj.clientCode = clientObj.companyCode;
        clientObj.companyName = clientObj.companyName;
        clientObj.email = clientObj.email;
        clientObj.phone = clientObj.phone;
        clientObj.website = clientObj.website;
        clientObj.address = clientObj.address;
        clientObj.contactPerson = clientObj.companyAdmin;
        
        return clientObj;
      })
    );

    res.json({
      success: true,
      data: {
        clients: clientsWithPackages,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message
    });
  }
};

const getClient = async (req, res) => {
  try {
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const client = await CompanyRegistry.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message
    });
  }
};

const createClient = async (req, res) => {
  try {
    const { adminEmail, adminFirstName, adminLastName, adminPhone, ...clientData } = req.body;

    console.log('🎯 Creating client with data:', clientData);
    console.log('👤 Admin email provided:', adminEmail);

    if (!adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Admin email is required to create a new client'
      });
    }

    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();

    const existingCompany = await CompanyRegistry.findOne({
      $or: [
        { companyName: clientData.companyName },
        { email: clientData.email },
        { 'companyAdmin.email': adminEmail }
      ]
    }).select('companyId companyName companyCode tenantDatabaseName status databaseStatus');

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: 'Company already exists. Please use a different company name/email or deactivate the existing company first.',
        data: existingCompany
      });
    }

    const normalizeSubscriptionPlan = (plan) => {
      const normalized = String(plan || '').trim().toLowerCase();
      const planMap = {
        standard: 'professional',
        pro: 'professional',
        starter: 'basic'
      };

      const mapped = planMap[normalized] || normalized;
      const allowedPlans = new Set(['trial', 'basic', 'professional', 'enterprise', 'custom']);
      return allowedPlans.has(mapped) ? mapped : 'trial';
    };

    const splitName = (fullName) => {
      const name = String(fullName || '').trim();
      if (!name) return { firstName: 'Admin', lastName: 'User' };
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    };

    const derivedName = splitName(clientData.contactPerson?.name);
    const safeFirstName = String(adminFirstName || '').trim() || derivedName.firstName;
    const safeLastName = String(adminLastName || '').trim() || derivedName.lastName;

    const normalizedSubscription = clientData.subscription
      ? {
          ...clientData.subscription,
          plan: normalizeSubscriptionPlan(clientData.subscription.plan)
        }
      : undefined;

    console.log('🧾 Normalized subscription plan:', normalizedSubscription?.plan);

    const { provisionTenantDatabase } = require('../utils/tenantProvisioning');
    const adminPassword = generateAdminPassword();

    const provisioningResult = await provisionTenantDatabase(
      {
        companyName: clientData.companyName,
        email: clientData.email,
        phone: clientData.phone,
        website: clientData.website,
        address: clientData.address,
        subscription: normalizedSubscription,
        enabledModules: clientData.enabledModules
      },
      {
        email: adminEmail,
        password: adminPassword,
        firstName: safeFirstName,
        lastName: safeLastName,
        phone: adminPhone || clientData.phone
      },
      req.user
    );

    const client = new Client({
      ...clientData,
      companyId: provisioningResult.company.id,
      tenantDatabaseName: provisioningResult.company.databaseName,
      status: 'active'
    });
    await client.save();

    await logAction(req.user._id, null, 'client_create', 'Client', client._id, {
      companyName: client.companyName,
      clientCode: client.clientCode,
      adminEmail: adminEmail,
      tenantDatabaseName: provisioningResult.company.databaseName,
      companyId: provisioningResult.company.id
    }, req);

    try {
      const companySlug = client.companyName.toLowerCase().replace(/\s+/g, '-');
      await sendCompanyAdminCredentials({
        companyName: client.companyName,
        adminEmail: adminEmail,
        adminPassword: adminPassword,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login/${companySlug}`
      });
      console.log(`📧 Welcome email sent to: ${adminEmail}`);
    } catch (emailError) {
      console.error('❌ Error sending welcome email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Client and admin user created successfully',
      data: client,
      adminCreated: true,
      databaseCreated: true,
      companyRegistry: provisioningResult.company
    });
  } catch (error) {
    console.error('❌ Error creating client:', error);

    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate company/client detected. Please use different values (company name / emails / client code).',
        error: error.message
      });
    }

    res.status(400).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
};

const updateClient = async (req, res) => {
  try {
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'client_update', 'Client', client._id, {
      companyName: client.companyName,
      changes: req.body
    }, req);

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client',
      error: error.message
    });
  }
};

const updateClientStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'client_update', 'Client', client._id, {
      companyName: client.companyName,
      oldStatus: client.status,
      newStatus: status
    }, req);

    res.json({
      success: true,
      message: 'Client status updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client status',
      error: error.message
    });
  }
};

const updateClientSubscription = async (req, res) => {
  try {
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      { subscription: req.body },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'client_update', 'Client', client._id, {
      companyName: client.companyName,
      subscriptionChanges: req.body
    }, req);

    res.json({
      success: true,
      message: 'Client subscription updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating client subscription',
      error: error.message
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { getCompanyRegistry } = require('../models/global');
    const CompanyRegistry = await getCompanyRegistry();
    
    const client = await CompanyRegistry.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Also delete from Client collection if it exists
    try {
      await Client.findByIdAndDelete(req.params.id);
    } catch (error) {
      console.log('Client not found in Client collection, continuing...');
    }

    await CompanyRegistry.findByIdAndDelete(req.params.id);

    // Log the action
    await logAction(req.user._id, null, 'DELETE_CLIENT', 'Client', client._id, {
      companyName: client.companyName,
      clientCode: client.clientCode
    }, req);

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting client',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getSystemHealth,
  getClients,
  getClient,
  createClient,
  updateClient,
  updateClientStatus,
  updateClientSubscription,
  deleteClient
};
