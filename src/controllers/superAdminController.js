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
  try {
    const { adminEmail, ...clientData } = req.body;
    
    console.log('🎯 Creating client with data:', clientData);
    console.log('👤 Admin email provided:', adminEmail);
    
    // Create the client
    const client = new Client(clientData);
    await client.save();
    console.log('✅ Client created:', client.companyName);

    // Create admin user if adminEmail is provided
    if (adminEmail) {
      try {
        const User = require('../models/User');
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
          console.log('⚠️ Admin user already exists:', adminEmail);
        } else {
          // Create admin user
          const adminUser = new User({
            email: adminEmail,
            password: 'password123', // Default password
            authProvider: 'local',
            role: 'admin',
            clientId: client._id,
            isActive: true
          });
          
          await adminUser.save();
          console.log('✅ Admin user created:', adminEmail);
        }
      } catch (userError) {
        console.error('❌ Error creating admin user:', userError);
        // Don't fail the client creation if user creation fails
      }
    }

    // Log the action
    await logAction(req.user._id, null, 'CREATE_CLIENT', 'Client', client._id, {
      companyName: client.companyName,
      clientCode: client.clientCode,
      adminEmail: adminEmail
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
      message: adminEmail ? 'Client and admin user created successfully' : 'Client created successfully',
      data: client,
      adminCreated: !!adminEmail
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Error creating client:', error);
    res.status(400).json({
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
