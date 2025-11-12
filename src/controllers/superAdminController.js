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
    const expiringSubscriptions = await Client.find({
      'subscription.endDate': {
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      'subscription.status': 'active'
    }).select('name companyName subscription.endDate');

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
        { clientCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } }
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
    const clients = await Client.find(query)
      .populate('subscription.packageId', 'name type pricing')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);
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
    const client = await Client.findById(req.params.id);
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
  let companyCreated = null;
  
  try {
    // Extract and normalize data from request body
    const { 
      companyName, 
      companyCode,
      industry,
      companySize,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      website,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminPhone,
      subscriptionPlan,
      subscriptionStartDate,
      subscriptionEndDate,
      ...rest
    } = req.body;

    console.log('🎯 Starting company creation process...');
    console.log('📝 Company details:', { companyName, companyCode, industry });
    console.log('👤 Admin details:', { adminEmail, adminFirstName, adminLastName });

    // Validate required fields
    if (!companyName || !companyCode || !industry) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Please provide company name, code, and industry.'
      });
    }

    // Check if company with same name or code already exists
    const existingCompany = await Company.findOne({
      $or: [{ companyName }, { companyCode }]
    });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: 'A company with this name or code already exists.',
        conflict: {
          field: existingCompany.companyName === companyName ? 'companyName' : 'companyCode',
          value: existingCompany.companyName === companyName ? companyName : companyCode
        }
      });
    }

    // Generate a unique database name
    const databaseName = `tenant_${companyCode.toLowerCase()}_${Date.now()}`;
    console.log(`🔄 Creating database: ${databaseName}`);

    // Step 1: Create the tenant database
    await createTenantDatabase(databaseName);
    console.log('✅ Database created successfully');

    // Step 2: Initialize the database with collections and indexes
    await initializeTenantDatabase(databaseName);
    console.log('✅ Database initialized with collections');

    // Step 3: Create the company record
    const companyData = {
      companyName,
      companyCode,
      industry,
      companySize,
      address,
      city,
      state,
      country,
      postalCode,
      phone,
      website,
      databaseName,
      status: 'active',
      subscription: {
        plan: subscriptionPlan || 'basic',
        startDate: subscriptionStartDate || new Date(),
        endDate: subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        status: 'active'
      },
      settings: {
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        ...(rest.settings || {})
      }
    };

    companyCreated = await Company.create(companyData);
    console.log(`🏢 Company created: ${companyCreated.companyName} (${companyCreated._id})`);

    // Step 4: Create admin user if email is provided
    let adminUser = null;
    if (adminEmail) {
      const password = generateAdminPassword();
      
      adminUser = await createTenantAdminUser(databaseName, {
        email: adminEmail,
        firstName: adminFirstName || 'Admin',
        lastName: adminLastName || 'User',
        phone: adminPhone,
        role: 'admin',
        password,
        company: companyCreated._id
      });
      
      console.log(`👤 Admin user created: ${adminUser.email}`);
    }

    // Step 5: Log the action
    await logAction({
      action: 'COMPANY_CREATED',
      entity: 'Company',
      entityId: companyCreated._id,
      userId: req.user ? req.user._id : null,
      description: `Created company ${companyCreated.companyName}`,
      metadata: {
        companyName: companyCreated.companyName,
        companyCode: companyCreated.companyCode,
        databaseName: companyCreated.databaseName,
        adminEmail: adminEmail
      }
    }, req);

    console.log(`✅ Company creation completed successfully: ${companyCreated.companyName}`);

    // Step 6: Send welcome email with credentials if admin was created
    if (adminUser) {
      await sendCompanyAdminCredentials({
        email: adminEmail,
        firstName: adminFirstName || 'Admin',
        companyName: companyCreated.companyName,
        loginUrl: `${process.env.CLIENT_URL || 'https://your-app-url.com'}/login`,
        email: adminEmail,
        password: password,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@yourcompany.com'
      });
      console.log(`📧 Welcome email sent to: ${adminEmail}`);
    }

    // Return success response (without password for security)
    const response = {
      success: true,
      message: adminEmail ? 'Company and admin user created successfully' : 'Company created successfully',
      data: {
        _id: companyCreated._id,
        companyName: companyCreated.companyName,
        companyCode: companyCreated.companyCode,
        industry: companyCreated.industry,
        status: companyCreated.status,
        subscription: companyCreated.subscription,
        databaseName: companyCreated.databaseName,
        createdAt: companyCreated.createdAt
      },
      adminCreated: !!adminEmail
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Error creating company:', error);

    // Cleanup on error
    if (companyCreated) {
      try {
        // Delete the company record if it was created
        await Company.findByIdAndDelete(companyCreated._id);
        console.log(`🧹 Cleaned up company record: ${companyCreated._id}`);
        
        // TODO: Add cleanup for the created database if needed
        // await deleteTenantDatabase(companyCreated.databaseName);
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });

    // Log the action
    await logAction(req.user._id, null, 'UPDATE_CLIENT_SUBSCRIPTION', 'Client', client._id, {
      companyName: client.companyName,
      subscriptionChanges: req.body
    }, req);
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
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
    await logAction(req.user._id, null, 'UPDATE_CLIENT', 'Client', client._id, {
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
    const client = await Client.findByIdAndUpdate(
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
    await logAction(req.user._id, null, 'UPDATE_CLIENT_STATUS', 'Client', client._id, {
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
    const client = await Client.findByIdAndUpdate(
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
    await logAction(req.user._id, null, 'UPDATE_CLIENT_SUBSCRIPTION', 'Client', client._id, {
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
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if client has active users
    const activeUsers = await User.countDocuments({ 
      clientId: req.params.id,
      isActive: true 
    });

    if (activeUsers > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with active users. Please deactivate all users first.'
      });
    }

    await Client.findByIdAndDelete(req.params.id);

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
