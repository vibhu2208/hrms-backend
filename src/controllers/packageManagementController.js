const Package = require('../models/Package');
const Client = require('../models/Client');
const ClientPackage = require('../models/ClientPackage');
const ClientModuleOverride = require('../models/ClientModuleOverride');
const Module = require('../models/Module');
const { logAction } = require('../middlewares/auditLog');
const mongoose = require('mongoose');

// Get all packages
const getPackages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const packages = await Package.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Package.countDocuments(query);

    // Get usage count for each package
    const packagesWithUsage = await Promise.all(
      packages.map(async (pkg) => {
        const usageCount = await Client.countDocuments({
          'subscription.packageId': pkg._id
        });
        return {
          ...pkg.toObject(),
          usageCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        packages: packagesWithUsage,
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
      message: 'Error fetching packages',
      error: error.message
    });
  }
};

// Get single package
const getPackage = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Get clients using this package
    const clients = await Client.find({
      'subscription.packageId': package._id
    }).select('name companyName subscription.status');

    res.json({
      success: true,
      data: {
        package,
        clients
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching package',
      error: error.message
    });
  }
};

// Create new package
const createPackage = async (req, res) => {
  try {
    const package = new Package(req.body);
    await package.save();

    // Log action
    await logAction(
      req.user._id,
      null,
      'create',
      'package',
      package._id,
      { packageName: package.name, type: package.type },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating package',
      error: error.message
    });
  }
};

// Update package
const updatePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Log action
    await logAction(
      req.user._id,
      null,
      'update',
      'package',
      package._id,
      { packageName: package.name, updatedFields: Object.keys(req.body) },
      req
    );

    res.json({
      success: true,
      message: 'Package updated successfully',
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating package',
      error: error.message
    });
  }
};

// Delete package
const deletePackage = async (req, res) => {
  try {
    // Check if package is being used by any clients
    const clientsUsingPackage = await Client.countDocuments({
      'subscription.packageId': req.params.id
    });

    if (clientsUsingPackage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete package. It is currently being used by ${clientsUsingPackage} client(s)`
      });
    }

    const package = await Package.findByIdAndDelete(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Log action
    await logAction(
      req.user._id,
      null,
      'delete',
      'package',
      package._id,
      { packageName: package.name },
      req
    );

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting package',
      error: error.message
    });
  }
};

// Toggle package status
const togglePackageStatus = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    package.isActive = !package.isActive;
    await package.save();

    // Log action
    await logAction(
      req.user._id,
      null,
      'update',
      'package',
      package._id,
      { 
        packageName: package.name, 
        action: package.isActive ? 'activated' : 'deactivated' 
      },
      req
    );

    res.json({
      success: true,
      message: `Package ${package.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling package status',
      error: error.message
    });
  }
};

// Get all available modules
const getModules = async (req, res) => {
  try {
    const { category, status = 'active' } = req.query;
    
    const query = { status };
    if (category) {
      query.category = category;
    }
    
    const modules = await Module.find(query).sort({ name: 1 });
    
    res.json({
      success: true,
      data: { modules }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching modules',
      error: error.message
    });
  }
};

// Assign package to client
const assignPackageToClient = async (req, res) => {
  try {
    console.log('🎯 assignPackageToClient called with:', req.body);
    const { clientId, packageId, billingCycle, customPrice, startDate, endDate, autoRenew, trialDays } = req.body;
    
    // Check if client exists
    console.log('🔍 Checking client:', clientId);
    const client = await Client.findById(clientId);
    if (!client) {
      console.log('❌ Client not found:', clientId);
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    console.log('✅ Client found:', client.companyName);
    
    // Check if package exists
    console.log('🔍 Checking package:', packageId);
    const package = await Package.findById(packageId);
    if (!package) {
      console.log('❌ Package not found:', packageId);
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    console.log('✅ Package found:', package.name);
    
    // Check if client already has an active package
    const existingPackage = await ClientPackage.findOne({
      clientId,
      status: { $in: ['active', 'trial'] }
    }).populate('packageId', 'name type');
    
    if (existingPackage) {
      console.log('⚠️ Client already has active package:', existingPackage.packageId?.name);
      return res.status(400).json({
        success: false,
        message: `Client already has an active package: "${existingPackage.packageId?.name || 'Unknown Package'}" (${existingPackage.status}). Please cancel or expire the current package first.`,
        existingPackage: {
          name: existingPackage.packageId?.name,
          status: existingPackage.status,
          endDate: existingPackage.endDate
        }
      });
    }
    
    // Calculate end date based on billing cycle or use provided endDate
    const packageStartDate = new Date(startDate || new Date());
    const packageBillingCycle = billingCycle || 'monthly';
    let packageEndDate;
    
    if (endDate) {
      // Use provided end date
      packageEndDate = new Date(endDate);
      console.log('✅ Using provided end date:', packageEndDate);
    } else {
      // Calculate end date based on billing cycle
      packageEndDate = new Date(packageStartDate);
      switch (packageBillingCycle) {
        case 'monthly':
          packageEndDate.setMonth(packageEndDate.getMonth() + 1);
          break;
        case 'quarterly':
          packageEndDate.setMonth(packageEndDate.getMonth() + 3);
          break;
        case 'yearly':
          packageEndDate.setFullYear(packageEndDate.getFullYear() + 1);
          break;
        default:
          packageEndDate.setMonth(packageEndDate.getMonth() + 1); // Default to monthly
      }
      console.log('📊 Calculated end date based on', packageBillingCycle, 'cycle:', packageEndDate);
    }
    
    // Create client package assignment
    console.log('📝 Creating ClientPackage with data:', {
      clientId,
      packageId,
      billingCycle: packageBillingCycle,
      customPrice,
      startDate: packageStartDate,
      endDate: packageEndDate,
      autoRenew: autoRenew || false,
      trialDays: trialDays || 0,
      assignedBy: req.user._id,
      status: trialDays > 0 ? 'trial' : 'active'
    });
    
    const clientPackage = new ClientPackage({
      clientId,
      packageId,
      billingCycle: packageBillingCycle,
      customPrice,
      startDate: packageStartDate,
      endDate: packageEndDate,
      autoRenew: autoRenew || false,
      trialDays: trialDays || 0,
      assignedBy: req.user._id,
      status: trialDays > 0 ? 'trial' : 'active'
    });
    
    console.log('💾 Saving ClientPackage...');
    try {
      await clientPackage.save();
      console.log('✅ ClientPackage saved successfully:', clientPackage._id);
    } catch (saveError) {
      console.error('❌ Error saving ClientPackage:', saveError);
      console.error('📋 Save error details:', saveError.message);
      console.error('📋 Validation errors:', saveError.errors);
      throw saveError; // Re-throw to be caught by outer try-catch
    }
    
    // Update client's subscription info
    await Client.findByIdAndUpdate(clientId, {
      'subscription.packageId': packageId,
      'subscription.startDate': clientPackage.startDate,
      'subscription.endDate': clientPackage.endDate,
      'subscription.status': clientPackage.status,
      'subscription.billingCycle': clientPackage.billingCycle,
      'subscription.autoRenew': clientPackage.autoRenew,
      enabledModules: package.includedModules
    });
    
    // Log action (temporarily disabled due to enum issue)
    try {
      await logAction(
        req.user._id,
        clientId,
        'ASSIGN_PACKAGE',
        'Package', // Using 'Package' instead of 'ClientPackage' to avoid enum error
        clientPackage._id,
        {
          clientName: client.companyName,
          packageName: package.name,
          billingCycle,
          customPrice
        },
        req
      );
    } catch (logError) {
      console.error('⚠️ Audit log error (non-critical):', logError.message);
    }
    
    const populatedPackage = await ClientPackage.findById(clientPackage._id)
      .populate('clientId', 'name companyName')
      .populate('packageId', 'name type pricing')
      .populate('assignedBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Package assigned to client successfully',
      data: { clientPackage: populatedPackage }
    });
  } catch (error) {
    console.error('🔥 MAIN ERROR in assignPackageToClient:', error);
    console.error('📋 Error message:', error.message);
    console.error('📋 Error stack:', error.stack);
    if (error.errors) {
      console.error('📋 Validation errors:', error.errors);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error assigning package to client',
      error: error.message,
      details: error.errors || null
    });
  }
};

// Get client packages
const getClientPackages = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { clientId };
    if (status) {
      query.status = status;
    }
    
    const clientPackages = await ClientPackage.find(query)
      .populate('packageId', 'name type pricing features')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await ClientPackage.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        clientPackages,
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
      message: 'Error fetching client packages',
      error: error.message
    });
  }
};

// Customize package modules for client
const customizeClientModules = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { moduleOverrides } = req.body;
    
    // Get client's active package
    const clientPackage = await ClientPackage.findOne({
      clientId,
      status: { $in: ['active', 'trial'] }
    }).populate('packageId');
    
    if (!clientPackage) {
      return res.status(404).json({
        success: false,
        message: 'No active package found for client'
      });
    }
    
    // Process module overrides
    const overrideResults = [];
    
    for (const override of moduleOverrides) {
      const { moduleId, enabled, customSettings, overrideReason } = override;
      
      // Check if override already exists
      let existingOverride = await ClientModuleOverride.findOne({
        clientId,
        moduleId,
        isActive: true
      });
      
      if (existingOverride) {
        // Update existing override
        existingOverride.enabled = enabled;
        if (customSettings) {
          existingOverride.customSettings = { ...existingOverride.customSettings, ...customSettings };
        }
        existingOverride.overrideReason = overrideReason;
        existingOverride.overriddenBy = req.user._id;
        
        await existingOverride.save();
        overrideResults.push(existingOverride);
      } else {
        // Create new override
        const newOverride = new ClientModuleOverride({
          clientId,
          clientPackageId: clientPackage._id,
          moduleId,
          enabled,
          customSettings,
          overrideReason,
          overriddenBy: req.user._id
        });
        
        await newOverride.save();
        overrideResults.push(newOverride);
      }
    }
    
    // Update client's enabled modules based on overrides
    const activeOverrides = await ClientModuleOverride.find({
      clientId,
      isActive: true,
      enabled: true
    });
    
    const baseModules = clientPackage.packageId.includedModules;
    const overriddenModules = activeOverrides.map(o => o.moduleId);
    const disabledModules = await ClientModuleOverride.find({
      clientId,
      isActive: true,
      enabled: false
    }).distinct('moduleId');
    
    const enabledModules = [...new Set([
      ...baseModules.filter(m => !disabledModules.includes(m)),
      ...overriddenModules
    ])];
    
    await Client.findByIdAndUpdate(clientId, {
      enabledModules
    });
    
    // Log action
    await logAction(
      req.user._id,
      clientId,
      'CUSTOMIZE_MODULES',
      'ClientModuleOverride',
      null,
      {
        moduleOverrides: moduleOverrides.length,
        enabledModules: enabledModules.length
      },
      req
    );
    
    res.json({
      success: true,
      message: 'Module customization completed successfully',
      data: {
        overrides: overrideResults,
        enabledModules
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error customizing client modules',
      error: error.message
    });
  }
};

// Get client module overrides
const getClientModuleOverrides = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const overrides = await ClientModuleOverride.find({
      clientId,
      isActive: true
    })
      .populate('overriddenBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: { overrides }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching client module overrides',
      error: error.message
    });
  }
};

// Get package analytics
const getPackageAnalytics = async (req, res) => {
  try {
    // Package usage statistics
    const packageUsage = await ClientPackage.aggregate([
      {
        $group: {
          _id: '$packageId',
          totalClients: { $sum: 1 },
          activeClients: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          },
          trialClients: {
            $sum: {
              $cond: [{ $eq: ['$status', 'trial'] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$customPrice' },
          averagePrice: { $avg: '$customPrice' }
        }
      },
      {
        $lookup: {
          from: 'packages',
          localField: '_id',
          foreignField: '_id',
          as: 'package'
        }
      },
      {
        $unwind: '$package'
      },
      {
        $project: {
          packageName: '$package.name',
          packageType: '$package.type',
          totalClients: 1,
          activeClients: 1,
          trialClients: 1,
          totalRevenue: 1,
          averagePrice: 1
        }
      }
    ]);
    
    // Module popularity
    const modulePopularity = await ClientModuleOverride.aggregate([
      {
        $match: { enabled: true, isActive: true }
      },
      {
        $group: {
          _id: '$moduleId',
          usageCount: { $sum: 1 },
          totalUsers: { $sum: '$usage.activeUsers' },
          totalTransactions: { $sum: '$usage.transactionsThisMonth' }
        }
      },
      {
        $sort: { usageCount: -1 }
      }
    ]);
    
    // Revenue trends (last 12 months)
    const revenueData = await ClientPackage.aggregate([
      {
        $match: {
          'paymentHistory.status': 'completed',
          'paymentHistory.date': {
            $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
          }
        }
      },
      {
        $unwind: '$paymentHistory'
      },
      {
        $match: {
          'paymentHistory.status': 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentHistory.date' },
            month: { $month: '$paymentHistory.date' }
          },
          totalRevenue: { $sum: '$paymentHistory.amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    // Expiring packages (next 30 days)
    const expiringPackages = await ClientPackage.find({
      status: 'active',
      endDate: {
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
      .populate('clientId', 'name companyName')
      .populate('packageId', 'name type')
      .sort({ endDate: 1 });
    
    res.json({
      success: true,
      data: {
        packageUsage,
        modulePopularity,
        revenueData,
        expiringPackages: expiringPackages.length,
        expiringPackageDetails: expiringPackages.slice(0, 10) // Top 10 expiring soon
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching package analytics',
      error: error.message
    });
  }
};

// Update client package
const updateClientPackage = async (req, res) => {
  try {
    const { clientPackageId } = req.params;
    const updates = req.body;
    
    const clientPackage = await ClientPackage.findByIdAndUpdate(
      clientPackageId,
      updates,
      { new: true, runValidators: true }
    )
      .populate('clientId', 'name companyName')
      .populate('packageId', 'name type')
      .populate('assignedBy', 'name email');
    
    if (!clientPackage) {
      return res.status(404).json({
        success: false,
        message: 'Client package not found'
      });
    }
    
    // Log action
    await logAction(
      req.user._id,
      clientPackage.clientId._id,
      'UPDATE_CLIENT_PACKAGE',
      'ClientPackage',
      clientPackage._id,
      {
        clientName: clientPackage.clientId.companyName,
        packageName: clientPackage.packageId.name,
        updatedFields: Object.keys(updates)
      },
      req
    );
    
    res.json({
      success: true,
      message: 'Client package updated successfully',
      data: { clientPackage }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating client package',
      error: error.message
    });
  }
};

// Cancel client package
const cancelClientPackage = async (req, res) => {
  try {
    const { clientPackageId } = req.params;
    const { reason } = req.body;
    
    const clientPackage = await ClientPackage.findById(clientPackageId)
      .populate('clientId', 'name companyName')
      .populate('packageId', 'name type');
    
    if (!clientPackage) {
      return res.status(404).json({
        success: false,
        message: 'Client package not found'
      });
    }
    
    clientPackage.status = 'cancelled';
    clientPackage.notes = reason;
    await clientPackage.save();
    
    // Update client subscription status
    await Client.findByIdAndUpdate(clientPackage.clientId._id, {
      'subscription.status': 'cancelled'
    });
    
    // Disable all module overrides for this client
    await ClientModuleOverride.updateMany(
      { clientId: clientPackage.clientId._id, isActive: true },
      { isActive: false }
    );
    
    // Log action
    await logAction(
      req.user._id,
      clientPackage.clientId._id,
      'CANCEL_PACKAGE',
      'ClientPackage',
      clientPackage._id,
      {
        clientName: clientPackage.clientId.companyName,
        packageName: clientPackage.packageId.name,
        reason
      },
      req
    );
    
    res.json({
      success: true,
      message: 'Client package cancelled successfully',
      data: { clientPackage }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling client package',
      error: error.message
    });
  }
};

module.exports = {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  getModules,
  assignPackageToClient,
  getClientPackages,
  customizeClientModules,
  getClientModuleOverrides,
  getPackageAnalytics,
  updateClientPackage,
  cancelClientPackage
};
