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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Client.countDocuments(query);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        clients,
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
  let tenantConnection = null;
  let companyCreated = null;
  
  try {
    // Extract and normalize data from request body
    const { 
      companyName, 
      name, // Frontend might send 'name' instead of 'companyName'
      email, 
      phone, 
      address, 
      subscription, 
      enabledModules,
      contactPerson,
      industry,
      website,
      notes
    } = req.body;

    // Use companyName or name (whichever is provided)
    const finalCompanyName = companyName || name;

    // Validate required fields
    if (!finalCompanyName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, and phone are required'
      });
    }

    console.log(`🚀 Starting company creation process for: ${finalCompanyName}`);

    // Step 1: Check if company already exists
    const existingCompany = await Company.findOne({ 
      $or: [{ email }, { companyName: finalCompanyName }] 
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name or email already exists'
      });
    }

    // Step 2: Generate admin password
    const adminPassword = generateAdminPassword();
    console.log(`🔐 Generated admin password for ${email}`);

    // Step 3: Normalize address data (handle both string and object formats)
    let normalizedAddress = {};
    if (typeof address === 'string') {
      normalizedAddress = { street: address };
    } else if (typeof address === 'object' && address !== null) {
      normalizedAddress = address;
    }

    // Step 4: Create company record in global database
    companyCreated = await Company.create({
      companyName: finalCompanyName,
      email,
      phone,
      address: normalizedAddress,
      subscription: subscription || {
        plan: subscription?.plan || 'trial',
        status: 'active',
        maxEmployees: subscription?.maxUsers || subscription?.maxEmployees || 50,
        maxAdmins: 2
      },
      enabledModules: enabledModules || ['hr', 'attendance', 'recruitment'],
      status: 'active',
      isActive: true,
      createdBy: req.user._id,
      databaseStatus: 'provisioning',
      industry: industry || '',
      website: website || '',
      notes: notes || ''
    });

    console.log(`✅ Company record created: ${companyCreated.companyCode}`);

    // Step 5: Create tenant-specific database
    const dbResult = await createTenantDatabase(companyCreated.databaseName);
    tenantConnection = dbResult.connection;
    
    console.log(`✅ Tenant database created: ${companyCreated.databaseName}`);

    // Step 6: Create admin user in tenant database
    const adminUserResult = await createTenantAdminUser(tenantConnection, {
      email: email,
      password: adminPassword
    });

    console.log(`✅ Admin user created in tenant database: ${email}`);

    // Step 7: Initialize tenant database with default data
    await initializeTenantDatabase(tenantConnection, {
      companyName: companyCreated.companyName
    });

    console.log(`✅ Tenant database initialized with default data`);

    // Step 8: Update company record with admin user info
    companyCreated.adminUser = {
      email: email,
      userId: adminUserResult.userId,
      createdAt: new Date()
    };
    companyCreated.databaseStatus = 'active';
    await companyCreated.save();

    // Step 9: Send credentials email to company admin
    try {
      await sendCompanyAdminCredentials({
        companyName: companyCreated.companyName,
        adminEmail: email,
        adminPassword: adminPassword,
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
      });
      console.log(`✅ Credentials email sent to: ${email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send credentials email:', emailError.message);
      // Don't fail the entire process if email fails
    }

    // Step 10: Close tenant connection
    if (tenantConnection) {
      await tenantConnection.close();
    }

    // Step 11: Log the action
    await logAction(req.user._id, null, 'CREATE_COMPANY', 'Company', companyCreated._id, {
      companyName: companyCreated.companyName,
      companyCode: companyCreated.companyCode,
      databaseName: companyCreated.databaseName
    }, req);

    console.log(`🎉 Company creation completed successfully: ${companyCreated.companyName}`);

    // Return success response (without password for security)
    res.status(201).json({
      success: true,
      message: 'Company created successfully. Admin credentials have been sent via email.',
      data: {
        company: {
          id: companyCreated._id,
          companyCode: companyCreated.companyCode,
          companyName: companyCreated.companyName,
          email: companyCreated.email,
          phone: companyCreated.phone,
          databaseName: companyCreated.databaseName,
          databaseStatus: companyCreated.databaseStatus,
          status: companyCreated.status,
          subscription: companyCreated.subscription,
          enabledModules: companyCreated.enabledModules,
          adminUser: {
            email: companyCreated.adminUser.email,
            createdAt: companyCreated.adminUser.createdAt
          },
          createdAt: companyCreated.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating company:', error);

    // Cleanup on error
    if (tenantConnection) {
      try {
        await tenantConnection.close();
      } catch (closeError) {
        console.error('Error closing tenant connection:', closeError);
      }
    }

    // If company was created but process failed, mark it as failed
    if (companyCreated) {
      try {
        companyCreated.databaseStatus = 'suspended';
        companyCreated.status = 'inactive';
        companyCreated.notes = `Creation failed: ${error.message}`;
        await companyCreated.save();
      } catch (updateError) {
        console.error('Error updating company status:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
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
