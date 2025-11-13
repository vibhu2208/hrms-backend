const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const SubscriptionLog = require('../models/SubscriptionLog');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');

// Helper function to log payment actions
const logPaymentAction = async (subscriptionId, clientId, action, description, performedBy, performedByRole, metadata = {}) => {
  try {
    await SubscriptionLog.logAction({
      subscriptionId,
      clientId,
      action,
      description,
      metadata,
      performedBy,
      performedByRole,
      category: 'payment'
    });
  } catch (error) {
    console.error('Error logging payment action:', error);
  }
};

// Get all payments with filters and pagination
const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      clientId,
      subscriptionId,
      invoiceId,
      search,
      sortBy = 'paymentDate',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (clientId) filter.clientId = clientId;
    if (subscriptionId) filter.subscriptionId = subscriptionId;
    if (invoiceId) filter.invoiceId = invoiceId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const payments = await Payment.find(filter)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode billingCycle')
      .populate('invoiceId', 'invoiceNumber amount.total')
      .populate('processedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const total = await Payment.countDocuments(filter);

    // Add calculated fields
    const paymentsWithCalcs = payments.map(payment => ({
      ...payment,
      netAmount: payment.amount - (payment.fees?.total || 0),
      refundableAmount: payment.amount - (payment.refund?.refundAmount || 0),
      isSuccessful: payment.status === 'completed',
      isPending: ['pending', 'processing'].includes(payment.status),
      isFailed: ['failed', 'cancelled'].includes(payment.status)
    }));

    res.status(200).json({
      success: true,
      data: {
        payments: paymentsWithCalcs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// Get single payment by ID
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('clientId')
      .populate('subscriptionId')
      .populate('invoiceId')
      .populate('processedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('reconciledBy', 'name email')
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Add calculated fields
    const paymentWithCalcs = {
      ...payment,
      netAmount: payment.amount - (payment.fees?.total || 0),
      refundableAmount: payment.amount - (payment.refund?.refundAmount || 0),
      isSuccessful: payment.status === 'completed',
      isPending: ['pending', 'processing'].includes(payment.status),
      isFailed: ['failed', 'cancelled'].includes(payment.status)
    };

    res.status(200).json({
      success: true,
      data: paymentWithCalcs
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// Create new payment record
const createPayment = async (req, res) => {
  try {
    const {
      invoiceId,
      subscriptionId,
      clientId,
      amount,
      currency,
      paymentMethod,
      paymentGateway,
      transactionId,
      gatewayTransactionId,
      paymentReference,
      billingDetails,
      paymentDetails,
      notes
    } = req.body;

    // Validate invoice exists
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Create payment
    const paymentData = {
      invoiceId,
      subscriptionId: subscriptionId || invoice.subscriptionId,
      clientId: clientId || invoice.clientId,
      amount,
      currency: currency || invoice.currency,
      paymentMethod,
      paymentGateway,
      transactionId,
      gatewayTransactionId,
      paymentReference,
      billingDetails,
      paymentDetails,
      notes,
      processedBy: req.user.id
    };

    const payment = new Payment(paymentData);
    await payment.save();

    // Log the action
    await logPaymentAction(
      payment.subscriptionId,
      payment.clientId,
      'payment_created',
      `Payment record created for invoice ${invoice.invoiceNumber}`,
      req.user.id,
      req.user.role,
      { paymentId: payment._id, amount: payment.amount, method: paymentMethod }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'CREATE',
      resourceType: 'Payment',
      resourceId: payment._id,
      details: `Created payment record ${payment.paymentId} for invoice ${invoice.invoiceNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Populate the response
    const populatedPayment = await Payment.findById(payment._id)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode')
      .populate('invoiceId', 'invoiceNumber amount.total');

    res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: populatedPayment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment',
      error: error.message
    });
  }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, gatewayResponse, failureReason, notes } = req.body;

    const payment = await Payment.findById(id)
      .populate('invoiceId', 'invoiceNumber')
      .populate('clientId', 'name companyName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const previousStatus = payment.status;

    // Update payment based on status
    if (status === 'completed') {
      await payment.markAsCompleted(transactionId, gatewayResponse);
      
      // Update invoice status
      const invoice = await Invoice.findById(payment.invoiceId._id);
      if (invoice) {
        invoice.paidAmount += payment.amount;
        if (invoice.paidAmount >= invoice.amount.total) {
          invoice.status = 'paid';
          invoice.paymentStatus = 'paid';
          invoice.paidDate = new Date();
        } else {
          invoice.paymentStatus = 'partial';
        }
        await invoice.save();
      }

      // Update subscription revenue
      const subscription = await Subscription.findById(payment.subscriptionId);
      if (subscription) {
        subscription.totalRevenue += payment.amount;
        await subscription.save();
      }

    } else if (status === 'failed') {
      await payment.markAsFailed(failureReason, gatewayResponse);
    } else {
      payment.status = status;
      if (transactionId) payment.transactionId = transactionId;
      if (gatewayResponse) payment.gatewayResponse = gatewayResponse;
      if (failureReason) payment.failureReason = failureReason;
      if (notes) payment.notes = notes;
      await payment.save();
    }

    // Log the action
    await logPaymentAction(
      payment.subscriptionId,
      payment.clientId._id,
      status === 'completed' ? 'payment_completed' : status === 'failed' ? 'payment_failed' : 'payment_updated',
      `Payment ${payment.paymentId} status changed from ${previousStatus} to ${status}`,
      req.user.id,
      req.user.role,
      { paymentId: payment._id, previousStatus, newStatus: status, amount: payment.amount }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Payment',
      resourceId: payment._id,
      details: `Updated payment ${payment.paymentId} status to ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
};

// Process refund
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason, refundTransactionId } = req.body;

    const payment = await Payment.findById(id)
      .populate('invoiceId', 'invoiceNumber')
      .populate('clientId', 'name companyName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed payments'
      });
    }

    const refundAmount = amount || payment.amount;
    const availableRefund = payment.amount - (payment.refund?.refundAmount || 0);

    if (refundAmount > availableRefund) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount exceeds available refundable amount'
      });
    }

    // Process refund
    await payment.processRefund(refundAmount, reason, refundTransactionId);

    // Update invoice if fully refunded
    if (payment.status === 'refunded') {
      const invoice = await Invoice.findById(payment.invoiceId._id);
      if (invoice) {
        invoice.paidAmount -= refundAmount;
        if (invoice.paidAmount <= 0) {
          invoice.paymentStatus = 'pending';
          invoice.status = 'sent';
        } else {
          invoice.paymentStatus = 'partial';
        }
        await invoice.save();
      }

      // Update subscription revenue
      const subscription = await Subscription.findById(payment.subscriptionId);
      if (subscription) {
        subscription.totalRevenue -= refundAmount;
        await subscription.save();
      }
    }

    // Log the action
    await logPaymentAction(
      payment.subscriptionId,
      payment.clientId._id,
      'payment_refunded',
      `Payment ${payment.paymentId} refunded. Amount: ${refundAmount}`,
      req.user.id,
      req.user.role,
      { paymentId: payment._id, refundAmount, reason }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Payment',
      resourceId: payment._id,
      details: `Processed refund for payment ${payment.paymentId}. Amount: ${refundAmount}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// Verify payment
const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.verify(req.user.id);
    if (notes) {
      payment.internalNotes = notes;
      await payment.save();
    }

    // Log the action
    await logPaymentAction(
      payment.subscriptionId,
      payment.clientId,
      'payment_verified',
      `Payment ${payment.paymentId} verified`,
      req.user.id,
      req.user.role,
      { paymentId: payment._id }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Payment',
      resourceId: payment._id,
      details: `Verified payment ${payment.paymentId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// Reconcile payment
const reconcilePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.reconcile(req.user.id);
    if (notes) {
      payment.internalNotes = notes;
      await payment.save();
    }

    // Log the action
    await logPaymentAction(
      payment.subscriptionId,
      payment.clientId,
      'payment_reconciled',
      `Payment ${payment.paymentId} reconciled`,
      req.user.id,
      req.user.role,
      { paymentId: payment._id }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Payment',
      resourceId: payment._id,
      details: `Reconciled payment ${payment.paymentId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Payment reconciled successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error reconciling payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error reconciling payment',
      error: error.message
    });
  }
};

// Get payment statistics
const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const paymentStats = await Payment.getPaymentStats(start, end);
    const paymentMethodStats = await Payment.getPaymentMethodStats(start, end);
    const dailyPaymentSummary = await Payment.getDailyPaymentSummary(30);

    res.status(200).json({
      success: true,
      data: {
        statusBreakdown: paymentStats,
        methodBreakdown: paymentMethodStats,
        dailySummary: dailyPaymentSummary
      }
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
  try {
    const pendingPayments = await Payment.findPending();

    res.status(200).json({
      success: true,
      data: pendingPayments,
      count: pendingPayments.length
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending payments',
      error: error.message
    });
  }
};

// Get failed payments
const getFailedPayments = async (req, res) => {
  try {
    const failedPayments = await Payment.findFailed();

    res.status(200).json({
      success: true,
      data: failedPayments,
      count: failedPayments.length
    });
  } catch (error) {
    console.error('Error fetching failed payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching failed payments',
      error: error.message
    });
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePaymentStatus,
  processRefund,
  verifyPayment,
  reconcilePayment,
  getPaymentStats,
  getPendingPayments,
  getFailedPayments
};
