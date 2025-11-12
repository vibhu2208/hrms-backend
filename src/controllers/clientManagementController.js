const Client = require('../models/Client');
const User = require('../models/User');
const Package = require('../models/Package');
const ClientPackage = require('../models/ClientPackage');
const Subscription = require('../models/Subscription');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { logAction } = require('../middlewares/auditLog');
const bcrypt = require('bcryptjs');

// Get all clients with pagination and filters
const getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      subscriptionStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { clientCode: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    // Handle subscription status filtering with new system
    let subscriptionClientIds = [];
    if (subscriptionStatus) {
      // Get client IDs that match the subscription status from new system
      const matchingSubscriptions = await Subscription.find({ 
        status: subscriptionStatus,
        isActive: true 
      }).distinct('clientId');
      
      // Also check old embedded subscription system for backward compatibility
      const matchingClients = await Client.find({ 
        'subscription.status': subscriptionStatus 
      }).distinct('_id');
      
      // Combine both sets of client IDs
      subscriptionClientIds = [...new Set([...matchingSubscriptions, ...matchingClients])];
      
      if (subscriptionClientIds.length > 0) {
        query._id = { $in: subscriptionClientIds };
      } else {
        // No matching clients found, return empty result
        query._id = { $in: [] };
      }
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const clients = await Client.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Client.countDocuments(query);

    // Enhance clients with ClientPackage and Subscription data
    const enhancedClients = await Promise.all(clients.map(async (client) => {
      // Get the client's current package assignment
      const clientPackage = await ClientPackage.findOne({ 
        clientId: client._id,
        isActive: true 
      }).populate('packageId', 'name type pricing');

      // Get the client's current subscription
      const subscription = await Subscription.findOne({ 
        clientId: client._id,
        isActive: true 
      }).populate('packageId', 'name type pricing');

      // Create enhanced client object
      const clientObj = client.toObject();
      
      if (clientPackage && subscription) {
        // Use new system data
        const daysRemaining = ['active', 'trial'].includes(subscription.status) ? 
          Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        
        clientObj.subscription = {
          packageId: clientPackage.packageId,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          effectivePrice: subscription.effectivePrice,
          autoRenew: subscription.autoRenew,
          daysRemaining: Math.max(0, daysRemaining)
        };
      } else if (client.subscription && client.subscription.packageId) {
        // Use old embedded subscription data with enhanced calculations
        const daysRemaining = ['active', 'trial'].includes(client.subscription.status) && client.subscription.endDate ? 
          Math.ceil((new Date(client.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        
        clientObj.subscription = {
          ...client.subscription,
          daysRemaining: Math.max(0, daysRemaining)
        };
      } else {
        // No subscription data - set as trial without package
        clientObj.subscription = {
          status: 'trial',
          packageId: null,
          daysRemaining: 0,
          startDate: client.createdAt,
          endDate: null,
          billingCycle: 'monthly',
          autoRenew: false
        };
      }

      return clientObj;
    }));

    res.json({
      success: true,
      data: {
        clients: enhancedClients,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
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

// Get single client details
const getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get the client's current package assignment and subscription
    const clientPackage = await ClientPackage.findOne({ 
      clientId: client._id,
      isActive: true 
    }).populate('packageId', 'name type pricing features');

    const subscription = await Subscription.findOne({ 
      clientId: client._id,
      isActive: true 
    }).populate('packageId', 'name type pricing features');

    // Get client's users count
    const userCount = await User.countDocuments({ clientId: client._id });
    const adminCount = await User.countDocuments({ 
      clientId: client._id, 
      role: { $in: ['admin', 'hr'] } 
    });

    // Enhance client with subscription data
    const clientObj = client.toObject();
    if (clientPackage && subscription) {
      // Use new system data
      const daysRemaining = ['active', 'trial'].includes(subscription.status) ? 
        Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      
      clientObj.subscription = {
        packageId: clientPackage.packageId,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        effectivePrice: subscription.effectivePrice,
        autoRenew: subscription.autoRenew,
        daysRemaining: Math.max(0, daysRemaining)
      };
    } else if (client.subscription && client.subscription.packageId) {
      // Use old embedded subscription data
      const daysRemaining = ['active', 'trial'].includes(client.subscription.status) && client.subscription.endDate ? 
        Math.ceil((new Date(client.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      
      clientObj.subscription = {
        ...client.subscription,
        daysRemaining: Math.max(0, daysRemaining)
      };
    } else {
      // No subscription data - set as trial without package
      clientObj.subscription = {
        status: 'trial',
        packageId: null,
        daysRemaining: 0,
        startDate: client.createdAt,
        endDate: null,
        billingCycle: 'monthly',
        autoRenew: false
      };
    }

    res.json({
      success: true,
      data: {
        client: clientObj,
        stats: {
          totalUsers: userCount,
          totalAdmins: adminCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message
    });
  }
};

// Create new client
const createClient = async (req, res) => {
  try {
    const {
      name,
      companyName,
      email,
      phone,
      address,
      contactPerson,
      packageId,
      enabledModules,
      settings,
      adminUser
    } = req.body;

    // Generate unique client code
    const clientCount = await Client.countDocuments();
    const clientCode = `CL${String(clientCount + 1).padStart(3, '0')}`;

    // Create client
    const client = new Client({
      clientCode,
      name,
      companyName,
      email,
      phone,
      address,
      contactPerson,
      enabledModules: enabledModules || ['hr'],
      settings: settings || {},
      subscription: {
        packageId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        status: 'trial'
      }
    });

    await client.save();

    // If a package is selected, create ClientPackage and Subscription records
    if (packageId) {
      const package = await Package.findById(packageId);
      if (package) {
        // Create ClientPackage assignment
        const clientPackage = new ClientPackage({
          clientId: client._id,
          packageId: packageId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
          status: 'trial',
          billingCycle: 'monthly',
          assignedBy: req.user._id,
          isActive: true
        });
        await clientPackage.save();

        // Create Subscription record
        const subscriptionCode = `SUB${String(await Subscription.countDocuments() + 1).padStart(4, '0')}`;
        const subscription = new Subscription({
          subscriptionCode,
          clientId: client._id,
          packageId: packageId,
          clientPackageId: clientPackage._id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'trial',
          billingCycle: 'monthly',
          basePrice: package.pricing?.monthly || 0,
          effectivePrice: package.pricing?.monthly || 0,
          autoRenew: false,
          assignedBy: req.user._id,
          isActive: true
        });
        await subscription.save();
      }
    }

    // Create admin user for the client
    if (adminUser) {
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);
      
      const user = new User({
        email: adminUser.email,
        password: hashedPassword,
        role: 'admin',
        clientId: client._id,
        isFirstLogin: true,
        mustChangePassword: true
      });

      await user.save();
    }

    // Log action
    await logAction(
      req.user._id,
      null,
      'create',
      'client',
      client._id,
      { clientName: client.name, companyName: client.companyName },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: { client }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating client',
      error: error.message
    });
  }
};

// Update client
const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('subscription.packageId');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Log action
    await logAction(
      req.user._id,
      client._id,
      'update',
      'client',
      client._id,
      { updatedFields: Object.keys(req.body) },
      req
    );

    res.json({
      success: true,
      message: 'Client updated successfully',
      data: { client }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating client',
      error: error.message
    });
  }
};

// Update client status
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

    // If suspending, also deactivate all users
    if (status === 'suspended') {
      await User.updateMany(
        { clientId: client._id },
        { isActive: false }
      );
    } else if (status === 'active') {
      await User.updateMany(
        { clientId: client._id },
        { isActive: true }
      );
    }

    // Log action
    await logAction(
      req.user._id,
      client._id,
      'status_change',
      'client',
      client._id,
      { oldStatus: client.status, newStatus: status },
      req
    );

    res.json({
      success: true,
      message: `Client ${status} successfully`,
      data: { client }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating client status',
      error: error.message
    });
  }
};

// Update client subscription
const updateSubscription = async (req, res) => {
  try {
    const { packageId, billingCycle, autoRenew } = req.body;
    
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Calculate end date based on billing cycle
    let endDate = new Date();
    switch (billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    client.subscription = {
      ...client.subscription,
      packageId,
      billingCycle,
      autoRenew,
      endDate,
      status: 'active'
    };

    client.enabledModules = package.includedModules;
    await client.save();

    // Log action
    await logAction(
      req.user._id,
      client._id,
      'subscription_update',
      'subscription',
      client._id,
      { packageName: package.name, billingCycle, endDate },
      req
    );

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: { client }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating subscription',
      error: error.message
    });
  }
};

// Delete client (soft delete)
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: false,
        status: 'inactive'
      },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Deactivate all client users
    await User.updateMany(
      { clientId: client._id },
      { isActive: false }
    );

    // Log action
    await logAction(
      req.user._id,
      client._id,
      'delete',
      'client',
      client._id,
      { clientName: client.name },
      req
    );

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
  getClients,
  getClient,
  createClient,
  updateClient,
  updateClientStatus,
  updateSubscription,
  deleteClient
};
