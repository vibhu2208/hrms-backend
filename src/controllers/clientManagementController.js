const Client = require('../models/Client');
const User = require('../models/User');
const Package = require('../models/Package');
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

    if (subscriptionStatus) {
      query['subscription.status'] = subscriptionStatus;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const clients = await Client.find(query)
      .populate('subscription.packageId', 'name type')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Client.countDocuments(query);

    res.json({
      success: true,
      data: {
        clients,
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
    const client = await Client.findById(req.params.id)
      .populate('subscription.packageId');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's users count
    const userCount = await User.countDocuments({ clientId: client._id });
    const adminCount = await User.countDocuments({ 
      clientId: client._id, 
      role: { $in: ['admin', 'hr'] } 
    });

    res.json({
      success: true,
      data: {
        client,
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

    // Create client
    const client = new Client({
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
