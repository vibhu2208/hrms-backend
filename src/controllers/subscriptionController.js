const Subscription = require('../models/Subscription');
const ClientPackage = require('../models/ClientPackage');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const SubscriptionLog = require('../models/SubscriptionLog');
const Client = require('../models/Client');
const Package = require('../models/Package');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');

// Helper function to log subscription actions
const logSubscriptionAction = async (subscriptionId, clientId, action, description, performedBy, performedByRole, previousValues = null, newValues = null, metadata = {}) => {
  try {
    await SubscriptionLog.logAction({
      subscriptionId,
      clientId,
      action,
      description,
      previousValues,
      newValues,
      metadata,
      performedBy,
      performedByRole,
      category: 'subscription'
    });
  } catch (error) {
    console.error('Error logging subscription action:', error);
  }
};

// Get all subscriptions with filters and pagination
const getAllSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      clientId,
      packageId,
      billingCycle,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (packageId) filter.packageId = packageId;
    if (billingCycle) filter.billingCycle = billingCycle;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population including ClientPackage
    const subscriptions = await Subscription.find(filter)
      .populate('clientId', 'companyName email contactPerson')
      .populate('packageId', 'name type pricing')
      .populate('clientPackageId', 'status billingCycle autoRenew discount usage')
      .populate('assignedBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const total = await Subscription.countDocuments(filter);

    // Add calculated fields
    const subscriptionsWithCalcs = subscriptions.map(sub => ({
      ...sub,
      daysRemaining: sub.status === 'active' ? Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
      isExpiringSoon: sub.status === 'active' && Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24)) <= 10,
      effectivePrice: calculateEffectivePrice(sub)
    }));

    res.status(200).json({
      success: true,
      data: {
        subscriptions: subscriptionsWithCalcs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message
    });
  }
};

// Get single subscription by ID
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id)
      .populate('clientId')
      .populate('packageId')
      .populate('assignedBy', 'name email')
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Get related invoices and payments
    const invoices = await Invoice.find({ subscriptionId: id })
      .sort({ createdAt: -1 })
      .limit(10);

    const payments = await Payment.find({ subscriptionId: id })
      .sort({ paymentDate: -1 })
      .limit(10);

    // Get subscription timeline
    const timeline = await SubscriptionLog.getSubscriptionTimeline(id);

    // Add calculated fields
    const subscriptionWithCalcs = {
      ...subscription,
      daysRemaining: subscription.status === 'active' ? Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
      isExpiringSoon: subscription.status === 'active' && Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) <= 10,
      effectivePrice: calculateEffectivePrice(subscription),
      invoices,
      payments,
      timeline: timeline.slice(0, 20) // Limit timeline to recent 20 entries
    };

    res.status(200).json({
      success: true,
      data: subscriptionWithCalcs
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message
    });
  }
};

// Create new subscription
const createSubscription = async (req, res) => {
  try {
    const {
      clientId,
      packageId,
      billingCycle,
      startDate,
      endDate,
      customPrice,
      discount,
      tax,
      autoRenew,
      trialDays,
      notes
    } = req.body;

    // Validate client and package exist
    const client = await Client.findById(clientId);
    const package = await Package.findById(packageId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Calculate base price based on billing cycle
    let basePrice = customPrice;
    if (!basePrice) {
      switch (billingCycle) {
        case 'monthly':
          basePrice = package.pricing.monthly;
          break;
        case 'quarterly':
          basePrice = package.pricing.quarterly || (package.pricing.monthly * 3);
          break;
        case 'yearly':
          basePrice = package.pricing.yearly || (package.pricing.monthly * 12);
          break;
        default:
          basePrice = package.pricing.monthly;
      }
    }

    // Create subscription
    const subscriptionData = {
      clientId,
      packageId,
      billingCycle,
      startDate: startDate || new Date(),
      basePrice,
      currency: package.pricing.currency || 'USD',
      discount: discount || {},
      tax: tax || {},
      autoRenew: autoRenew || false,
      trialDays: trialDays || 0,
      notes,
      assignedBy: req.user.id
    };

    // Calculate end date if not provided
    if (!endDate) {
      const start = new Date(subscriptionData.startDate);
      let end = new Date(start);
      
      switch (billingCycle) {
        case 'monthly':
          end.setMonth(end.getMonth() + 1);
          break;
        case 'quarterly':
          end.setMonth(end.getMonth() + 3);
          break;
        case 'yearly':
          end.setFullYear(end.getFullYear() + 1);
          break;
      }
      
      subscriptionData.endDate = end;
    } else {
      subscriptionData.endDate = new Date(endDate);
    }

    const subscription = new Subscription(subscriptionData);
    await subscription.save();

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      clientId,
      'created',
      `Subscription created for ${client.companyName} with ${package.name} package`,
      req.user.id,
      req.user.role,
      null,
      subscription.toObject(),
      { packageName: package.name, billingCycle, basePrice }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'CREATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Created subscription ${subscription.subscriptionCode} for client ${client.companyName}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Populate the response
    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('clientId', 'name companyName email')
      .populate('packageId', 'name type pricing')
      .populate('assignedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: populatedSubscription
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message
    });
  }
};

// Update subscription
const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Store previous values for logging
    const previousValues = subscription.toObject();

    // Update subscription
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== '_id' && key !== 'subscriptionCode') {
        subscription[key] = updateData[key];
      }
    });

    await subscription.save();

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      subscription.clientId,
      'updated',
      `Subscription ${subscription.subscriptionCode} updated`,
      req.user.id,
      req.user.role,
      previousValues,
      subscription.toObject()
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Updated subscription ${subscription.subscriptionCode}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Populate the response
    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('clientId', 'name companyName email')
      .populate('packageId', 'name type pricing')
      .populate('assignedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: populatedSubscription
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subscription',
      error: error.message
    });
  }
};

// Renew subscription
const renewSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { billingCycle, customPrice, discount, notes } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('clientId', 'name companyName')
      .populate('packageId', 'name pricing');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Store previous values
    const previousValues = {
      endDate: subscription.endDate,
      status: subscription.status,
      renewalCount: subscription.renewalCount
    };

    // Update billing cycle if provided
    if (billingCycle) {
      subscription.billingCycle = billingCycle;
    }

    // Update price if provided
    if (customPrice) {
      subscription.basePrice = customPrice;
    }

    // Update discount if provided
    if (discount) {
      subscription.discount = { ...subscription.discount, ...discount };
    }

    // Renew the subscription
    await subscription.renew();

    // Add notes if provided
    if (notes) {
      subscription.notes = notes;
      await subscription.save();
    }

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      subscription.clientId,
      'renewed',
      `Subscription ${subscription.subscriptionCode} renewed for ${subscription.clientId.companyName}`,
      req.user.id,
      req.user.role,
      previousValues,
      {
        endDate: subscription.endDate,
        status: subscription.status,
        renewalCount: subscription.renewalCount
      },
      { billingCycle: subscription.billingCycle, automaticAction: false }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Renewed subscription ${subscription.subscriptionCode}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Subscription renewed successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error renewing subscription',
      error: error.message
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('clientId', 'name companyName');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const previousStatus = subscription.status;
    subscription.status = 'cancelled';
    subscription.notes = notes || subscription.notes;
    await subscription.save();

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      subscription.clientId,
      'cancelled',
      `Subscription ${subscription.subscriptionCode} cancelled for ${subscription.clientId.companyName}`,
      req.user.id,
      req.user.role,
      { status: previousStatus },
      { status: 'cancelled' },
      { reason, notes }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Cancelled subscription ${subscription.subscriptionCode}. Reason: ${reason}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling subscription',
      error: error.message
    });
  }
};

// Suspend subscription
const suspendSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('clientId', 'name companyName');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const previousStatus = subscription.status;
    subscription.status = 'suspended';
    subscription.notes = notes || subscription.notes;
    await subscription.save();

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      subscription.clientId,
      'suspended',
      `Subscription ${subscription.subscriptionCode} suspended for ${subscription.clientId.companyName}`,
      req.user.id,
      req.user.role,
      { status: previousStatus },
      { status: 'suspended' },
      { reason, notes }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Suspended subscription ${subscription.subscriptionCode}. Reason: ${reason}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Subscription suspended successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error suspending subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error suspending subscription',
      error: error.message
    });
  }
};

// Reactivate subscription
const reactivateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('clientId', 'name companyName');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const previousStatus = subscription.status;
    subscription.status = 'active';
    subscription.notes = notes || subscription.notes;
    await subscription.save();

    // Log the action
    await logSubscriptionAction(
      subscription._id,
      subscription.clientId,
      'reactivated',
      `Subscription ${subscription.subscriptionCode} reactivated for ${subscription.clientId.companyName}`,
      req.user.id,
      req.user.role,
      { status: previousStatus },
      { status: 'active' },
      { notes }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id,
      details: `Reactivated subscription ${subscription.subscriptionCode}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error reactivating subscription',
      error: error.message
    });
  }
};

// Get expiring subscriptions
const getExpiringSubscriptions = async (req, res) => {
  try {
    const { days = 10 } = req.query;

    const expiringSubscriptions = await Subscription.findExpiring(parseInt(days));

    res.status(200).json({
      success: true,
      data: expiringSubscriptions,
      count: expiringSubscriptions.length
    });
  } catch (error) {
    console.error('Error fetching expiring subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expiring subscriptions',
      error: error.message
    });
  }
};

// Get expired subscriptions
const getExpiredSubscriptions = async (req, res) => {
  try {
    const expiredSubscriptions = await Subscription.findExpired();

    res.status(200).json({
      success: true,
      data: expiredSubscriptions,
      count: expiredSubscriptions.length
    });
  } catch (error) {
    console.error('Error fetching expired subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expired subscriptions',
      error: error.message
    });
  }
};

// Helper function to calculate effective price
const calculateEffectivePrice = (subscription) => {
  let price = subscription.basePrice;
  
  // Apply discount
  if (subscription.discount?.percentage > 0) {
    price = price * (1 - subscription.discount.percentage / 100);
  }
  if (subscription.discount?.amount > 0) {
    price = Math.max(0, price - subscription.discount.amount);
  }
  
  // Apply tax
  if (subscription.tax?.percentage > 0) {
    price = price * (1 + subscription.tax.percentage / 100);
  }
  if (subscription.tax?.amount > 0) {
    price = price + subscription.tax.amount;
  }
  
  return Math.round(price * 100) / 100;
};

module.exports = {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  renewSubscription,
  cancelSubscription,
  suspendSubscription,
  reactivateSubscription,
  getExpiringSubscriptions,
  getExpiredSubscriptions
};
