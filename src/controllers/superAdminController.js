const mongoose = require('mongoose');
const { connectGlobalDB } = require('../config/database.config');
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
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const totalClients = await CompanyRegistry.countDocuments();
    const activeClients = await CompanyRegistry.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const totalPackages = await Package.countDocuments({ isActive: true });

    // Recent activities
    const recentActivities = await AuditLog.find()
      .populate('userId', 'email role')
      .sort({ createdAt: -1 })
      .limit(10);

    // Client status distribution
    const clientStats = await CompanyRegistry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Subscription status distribution
    const subscriptionStats = await CompanyRegistry.aggregate([
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

    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    // Check for expiring subscriptions
    const expiringSubscriptions = await CompanyRegistry.find({
      'subscription.endDate': {
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      'subscription.status': 'active'
    }).select('companyName subscription.endDate');

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
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

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
        { email: { $regex: search, $options: 'i' } }
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
    const clients = await CompanyRegistry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CompanyRegistry.countDocuments(query);
    const pages = Math.ceil(total / limit);
    
    // Format clients for frontend (map companyCode to clientCode for compatibility)
    const clientsWithPackages = clients.map((client) => ({
      ...client,
      _id: client._id,
      clientCode: client.companyCode,
      name: client.companyName,
      activePackages: [],
      hasActivePackage: client.subscription?.status === 'active'
    }));

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
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const client = await CompanyRegistry.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
};

const createClient = async (req, res) => {
  let client = null;
  let adminUser = null;
  const defaultPassword = 'password123';
  
  try {
    // Connect to global database
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const { adminEmail, adminFirstName, contactPerson, ...clientData } = req.body;
    
    console.log('🎯 Creating company with data:', clientData);
    console.log('👤 Admin email provided:', adminEmail);
    
    // Generate unique IDs
    const companyObjectId = new mongoose.Types.ObjectId();
    const companyId = companyObjectId.toString();
    
    // Prepare company data for CompanyRegistry
    const companyRegistryData = {
      companyCode: clientData.clientCode || clientData.companyCode,
      companyName: clientData.companyName || clientData.name,
      companyId: companyId,
      tenantDatabaseName: `tenant_${companyId}`,
      email: clientData.email,
      phone: clientData.phone,
      website: clientData.website || '',
      address: typeof clientData.address === 'string' ? {
        street: clientData.address,
        city: '',
        state: '',
        zipCode: '',
        country: ''
      } : clientData.address,
      companyAdmin: {
        email: adminEmail || contactPerson?.email || clientData.email,
        createdAt: new Date()
      },
      subscription: {
        plan: clientData.subscription?.plan || 'trial',
        startDate: clientData.subscription?.startDate || new Date(),
        endDate: clientData.subscription?.endDate || null,
        status: clientData.subscription?.status || 'active',
        maxEmployees: clientData.subscription?.maxUsers || 50,
        maxAdmins: 2,
        billingCycle: 'monthly'
      },
      status: clientData.status || 'active',
      databaseStatus: 'active'
    };
    
    // Create the company in CompanyRegistry
    client = await CompanyRegistry.create(companyRegistryData);
    console.log('✅ Company created:', client.companyName);

    // Create admin user in tenant database
    const adminEmailToUse = adminEmail || contactPerson?.email || client.email;
    if (adminEmailToUse) {
      try {
        // Connect to the newly created tenant database
        const { getTenantConnection } = require('../config/database.config');
        const tenantConnection = await getTenantConnection(client.companyId);
        
        const TenantUserSchema = require('../models/tenant/TenantUser');
        const TenantUser = tenantConnection.model('User', TenantUserSchema);
        
        // Check if user already exists in tenant database
        const existingUser = await TenantUser.findOne({ email: adminEmailToUse });
        if (existingUser) {
          console.log('⚠️ Admin user already exists in tenant database:', adminEmailToUse);
          adminUser = existingUser;
        } else {
          // Create admin user in tenant database
          adminUser = await TenantUser.create({
            email: adminEmailToUse,
            password: defaultPassword, // Will be hashed by pre-save hook
            authProvider: 'local',
            firstName: adminFirstName || contactPerson?.name?.split(' ')[0] || 'Admin',
            lastName: contactPerson?.name?.split(' ').slice(1).join(' ') || 'User',
            role: 'company_admin',
            isActive: true,
            isFirstLogin: true,
            mustChangePassword: true
          });
          
          console.log('✅ Admin user created in tenant database:', adminEmailToUse);
          
          // Update CompanyRegistry with admin userId
          await CompanyRegistry.findByIdAndUpdate(client._id, {
            'companyAdmin.userId': adminUser._id.toString(),
            'companyAdmin.createdAt': new Date()
          });
          console.log('✅ CompanyRegistry updated with admin user ID');
        }
      } catch (userError) {
        console.error('❌ Error creating admin user in tenant database:', userError);
        // Don't fail the client creation if user creation fails
      }
    }

    // Log the action with correct enum value
    await logAction(req.user._id, null, 'client_create', 'client', client._id, {
      companyName: client.companyName,
      clientCode: client.clientCode,
      adminEmail: adminEmail
    }, req);

    console.log(`✅ Company creation completed successfully: ${client.companyName}`);

    // Send welcome email with credentials if admin was created
    if (adminUser && adminEmailToUse) {
      try {
        await sendCompanyAdminCredentials({
          email: adminEmailToUse,
          firstName: adminUser.firstName || adminFirstName || 'Admin',
          companyName: client.companyName,
          companyCode: client.companyCode,
          loginUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173'}/login`,
          password: defaultPassword,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@hrms.com'
        });
        console.log(`📧 Welcome email sent to: ${adminEmailToUse}`);
      } catch (emailError) {
        console.error('❌ Error sending welcome email:', emailError.message);
        // Don't fail the client creation if email fails
      }
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: adminUser ? 'Company and admin user created successfully' : 'Company created successfully',
      data: {
        company: client,
        adminCreated: !!adminUser,
        adminEmail: adminEmailToUse,
        emailSent: !!adminUser,
        loginUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173'}/login`,
        note: adminUser ? 'Welcome email sent with login credentials. Admin must change password on first login.' : null
      }
    });
  } catch (error) {
    console.error('❌ Error creating client:', error);
    
    // Only log action if client was created
    if (client && client._id) {
      try {
        await logAction(req.user?._id || null, null, 'client_create', 'client', client._id, {
          companyName: client.companyName,
          error: error.message
        }, req);
      } catch (logError) {
        console.error('❌ Error logging failed action:', logError);
      }
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
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'UPDATE_CLIENT', 'CompanyRegistry', client._id, {
      companyName: client.companyName,
      changes: req.body
    }, req);

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating company',
      error: error.message
    });
  }
};

const updateClientStatus = async (req, res) => {
  try {
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const { status } = req.body;
    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'UPDATE_CLIENT_STATUS', 'CompanyRegistry', client._id, {
      companyName: client.companyName,
      oldStatus: client.status,
      newStatus: status
    }, req);

    res.json({
      success: true,
      message: 'Company status updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating company status',
      error: error.message
    });
  }
};

const updateClientSubscription = async (req, res) => {
  try {
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const client = await CompanyRegistry.findByIdAndUpdate(
      req.params.id,
      { subscription: req.body },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Log the action
    await logAction(req.user._id, null, 'UPDATE_CLIENT_SUBSCRIPTION', 'CompanyRegistry', client._id, {
      companyName: client.companyName,
      subscriptionChanges: req.body
    }, req);

    res.json({
      success: true,
      message: 'Company subscription updated successfully',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating company subscription',
      error: error.message
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const globalConnection = await connectGlobalDB();
    const companyRegistrySchema = require('../models/global/CompanyRegistry');
    const CompanyRegistry = globalConnection.model('CompanyRegistry', companyRegistrySchema);

    const client = await CompanyRegistry.findById(req.params.id);
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
