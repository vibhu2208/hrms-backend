const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
// Simple logging function for billing actions
const logBillingAction = async (subscriptionId, clientId, action, description, performedBy, performedByRole, metadata = {}) => {
  try {
    console.log(`Billing Action: ${action} - ${description}`, { subscriptionId, clientId, performedBy });
    // Could be enhanced to use SubscriptionLog or SuperAdminAuditLog if needed
  } catch (error) {
    console.error('Error logging billing action:', error);
  }
};
// const { BILLING_ACTIONS, RESOURCE_TYPES } = require('../config/auditConfig'); // Temporarily disabled
const { generatePDFFromHTML, generateInvoiceHTML } = require('../utils/pdfGenerator');
const Client = require('../models/Client');
const Package = require('../models/Package');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const Subscription = require('../models/Subscription');
const SubscriptionLog = require('../models/SubscriptionLog');


// Get all invoices with filters and pagination
const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      clientId,
      subscriptionId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (clientId) filter.clientId = clientId;
    if (subscriptionId) filter.subscriptionId = subscriptionId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const invoices = await Invoice.find(filter)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode billingCycle')
      .populate('packageId', 'name type')
      .populate('generatedBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const total = await Invoice.countDocuments(filter);

    // Add calculated fields
    const invoicesWithCalcs = invoices.map(invoice => ({
      ...invoice,
      isOverdue: invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date() > new Date(invoice.dueDate),
      daysOverdue: invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date() > new Date(invoice.dueDate) 
        ? Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)) : 0,
      remainingAmount: Math.max(0, invoice.amount.total - invoice.paidAmount),
      paymentPercentage: invoice.amount.total === 0 ? 100 : Math.round((invoice.paidAmount / invoice.amount.total) * 100)
    }));

    res.status(200).json({
      success: true,
      data: {
        invoices: invoicesWithCalcs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
};

// Get single invoice by ID
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate('clientId')
      .populate('subscriptionId')
      .populate('packageId')
      .populate('generatedBy', 'name email')
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Get related payments
    const payments = await Payment.find({ invoiceId: id })
      .sort({ paymentDate: -1 });

    // Add calculated fields
    const invoiceWithCalcs = {
      ...invoice,
      isOverdue: invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date() > new Date(invoice.dueDate),
      daysOverdue: invoice.status !== 'paid' && invoice.status !== 'cancelled' && new Date() > new Date(invoice.dueDate) 
        ? Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)) : 0,
      remainingAmount: Math.max(0, invoice.amount.total - invoice.paidAmount),
      paymentPercentage: invoice.amount.total === 0 ? 100 : Math.round((invoice.paidAmount / invoice.amount.total) * 100),
      payments
    };

    res.status(200).json({
      success: true,
      data: invoiceWithCalcs
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
};

// Generate invoice for subscription
const generateInvoice = async (req, res) => {
  try {
    const {
      subscriptionId,
      billingPeriodStart,
      billingPeriodEnd,
      dueDate,
      itemDetails,
      notes,
      sendEmail = false
    } = req.body;

    // Get subscription details
    const subscription = await Subscription.findById(subscriptionId)
      .populate('clientId')
      .populate('packageId');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Calculate amounts
    const subtotal = subscription.basePrice;
    const discountAmount = calculateDiscountAmount(subtotal, subscription.discount);
    const taxAmount = calculateTaxAmount(subtotal - discountAmount, subscription.tax);
    const total = subtotal - discountAmount + taxAmount;

    // Create invoice
    const invoiceData = {
      subscriptionId: subscription._id,
      clientId: subscription.clientId._id,
      packageId: subscription.packageId._id,
      billingPeriod: {
        startDate: billingPeriodStart || subscription.startDate,
        endDate: billingPeriodEnd || subscription.endDate
      },
      amount: {
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total
      },
      currency: subscription.currency,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      itemDetails: itemDetails || [{
        description: `${subscription.packageId.name} - ${subscription.billingCycle} subscription`,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }],
      discountDetails: {
        percentage: subscription.discount?.percentage || 0,
        amount: discountAmount,
        reason: subscription.discount?.reason
      },
      taxDetails: {
        percentage: subscription.tax?.percentage || 0,
        amount: taxAmount,
        taxType: subscription.tax?.type || 'VAT'
      },
      billingAddress: {
        companyName: subscription.clientId.companyName,
        addressLine1: subscription.clientId.address?.street,
        city: subscription.clientId.address?.city,
        state: subscription.clientId.address?.state,
        postalCode: subscription.clientId.address?.postalCode,
        country: subscription.clientId.address?.country
      },
      notes,
      generatedBy: req.user.id
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Update subscription's last billing date
    subscription.lastBillingDate = new Date();
    await subscription.save();

    // Log the action
    await logBillingAction(
      subscriptionId,
      subscription.clientId._id,
      'invoice_generated',
      `Invoice ${invoice.invoiceNumber} generated for subscription ${subscription.subscriptionCode}`,
      req.user.id,
      req.user.role,
      { invoiceId: invoice._id, amount: total }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'CREATE',
      resourceType: 'Invoice',
      resourceId: invoice._id,
      details: `Generated invoice ${invoice.invoiceNumber} for ${subscription.clientId.companyName}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // TODO: Send email if requested
    if (sendEmail) {
      // Implement email sending logic here
      invoice.emailSent = true;
      invoice.emailSentDate = new Date();
      await invoice.save();
    }

    // Populate the response
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode')
      .populate('packageId', 'name type');

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: populatedInvoice
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice',
      error: error.message
    });
  }
};

// Update invoice
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Store previous values for logging
    const previousValues = {
      status: invoice.status,
      amount: invoice.amount,
      dueDate: invoice.dueDate
    };

    // Update invoice
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== '_id' && key !== 'invoiceNumber') {
        invoice[key] = updateData[key];
      }
    });

    await invoice.save();

    // Log the action
    await logBillingAction(
      invoice.subscriptionId,
      invoice.clientId,
      'invoice_updated',
      `Invoice ${invoice.invoiceNumber} updated`,
      req.user.id,
      req.user.role,
      { invoiceId: invoice._id, previousValues, newValues: updateData }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Invoice',
      resourceId: invoice._id,
      details: `Updated invoice ${invoice.invoiceNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Populate the response
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode')
      .populate('packageId', 'name type');

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: populatedInvoice
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice',
      error: error.message
    });
  }
};

// Mark invoice as paid
const markInvoiceAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, transactionId, paymentReference, notes } = req.body;

    const invoice = await Invoice.findById(id)
      .populate('subscriptionId')
      .populate('clientId', 'name companyName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Mark invoice as paid
    await invoice.markAsPaid(amount, paymentMethod, transactionId, paymentReference);

    // Create payment record
    const payment = new Payment({
      invoiceId: invoice._id,
      subscriptionId: invoice.subscriptionId._id,
      clientId: invoice.clientId._id,
      amount: amount || invoice.amount.total,
      currency: invoice.currency,
      paymentMethod: paymentMethod || 'offline',
      status: 'completed',
      transactionId,
      paymentReference,
      notes,
      processedBy: req.user.id
    });

    await payment.save();

    // Update subscription revenue
    const subscription = await Subscription.findById(invoice.subscriptionId._id);
    subscription.totalRevenue += payment.amount;
    await subscription.save();

    // Log the action
    await logBillingAction(
      invoice.subscriptionId._id,
      invoice.clientId._id,
      'payment_received',
      `Payment received for invoice ${invoice.invoiceNumber}`,
      req.user.id,
      req.user.role,
      { invoiceId: invoice._id, paymentId: payment._id, amount: payment.amount }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Invoice',
      resourceId: invoice._id,
      details: `Marked invoice ${invoice.invoiceNumber} as paid. Amount: ${payment.amount}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Invoice marked as paid successfully',
      data: {
        invoice,
        payment
      }
    });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking invoice as paid',
      error: error.message
    });
  }
};

// Send invoice reminder
const sendInvoiceReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const invoice = await Invoice.findById(id)
      .populate('clientId', 'name companyName email')
      .populate('subscriptionId', 'subscriptionCode');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Send reminder
    await invoice.sendReminder();

    // TODO: Implement actual email sending logic here
    // For now, just update the reminder count

    // Log the action
    await logBillingAction(
      invoice.subscriptionId._id,
      invoice.clientId._id,
      'reminder_sent',
      `Reminder sent for invoice ${invoice.invoiceNumber}`,
      req.user.id,
      req.user.role,
      { invoiceId: invoice._id, reminderCount: invoice.remindersSent }
    );

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'Invoice',
      resourceId: invoice._id,
      details: `Sent reminder for invoice ${invoice.invoiceNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Invoice reminder sent successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error sending invoice reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invoice reminder',
      error: error.message
    });
  }
};

// Get overdue invoices
const getOverdueInvoices = async (req, res) => {
  try {
    const overdueInvoices = await Invoice.findOverdue();

    res.status(200).json({
      success: true,
      data: overdueInvoices,
      count: overdueInvoices.length
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue invoices',
      error: error.message
    });
  }
};

// Get invoices due soon
const getInvoicesDueSoon = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const invoicesDueSoon = await Invoice.findDueSoon(parseInt(days));

    res.status(200).json({
      success: true,
      data: invoicesDueSoon,
      count: invoicesDueSoon.length
    });
  } catch (error) {
    console.error('Error fetching invoices due soon:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices due soon',
      error: error.message
    });
  }
};

// Get revenue statistics
const getRevenueStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const revenueStats = await Invoice.getRevenueStats(start, end);
    const monthlyRevenue = await Invoice.getMonthlyRevenue(start.getFullYear());

    res.status(200).json({
      success: true,
      data: {
        overall: revenueStats[0] || { totalRevenue: 0, totalInvoices: 0, averageInvoiceValue: 0 },
        monthly: monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue statistics',
      error: error.message
    });
  }
};

// Helper functions
const calculateDiscountAmount = (subtotal, discount) => {
  if (!discount) return 0;
  
  let discountAmount = 0;
  if (discount.percentage > 0) {
    discountAmount += subtotal * (discount.percentage / 100);
  }
  if (discount.amount > 0) {
    discountAmount += discount.amount;
  }
  
  return Math.min(discountAmount, subtotal); // Discount cannot exceed subtotal
};

const calculateTaxAmount = (taxableAmount, tax) => {
  if (!tax) return 0;
  
  let taxAmount = 0;
  if (tax.percentage > 0) {
    taxAmount += taxableAmount * (tax.percentage / 100);
  }
  if (tax.amount > 0) {
    taxAmount += tax.amount;
  }
  
  return taxAmount;
};

// Get invoice statistics
const getInvoiceStats = async (req, res) => {
  try {
    // Get all invoices for stats calculation
    const invoices = await Invoice.find({ isActive: true });
    
    // Calculate stats
    const stats = {
      total: invoices.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0
    };

    const today = new Date();
    
    invoices.forEach(invoice => {
      const amount = invoice.amount?.total || 0;
      stats.totalAmount += amount;
      
      switch (invoice.paymentStatus) {
        case 'paid':
          stats.paid += 1;
          stats.paidAmount += amount;
          break;
        case 'pending':
          stats.pending += 1;
          stats.pendingAmount += amount;
          break;
        default:
          // Check if overdue
          if (invoice.dueDate && new Date(invoice.dueDate) < today && invoice.paymentStatus !== 'paid') {
            stats.overdue += 1;
            stats.pendingAmount += amount;
          } else {
            stats.pending += 1;
            stats.pendingAmount += amount;
          }
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice statistics',
      error: error.message
    });
  }
};

// Generate invoice PDF
const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice with populated data
    const invoice = await Invoice.findById(id)
      .populate('clientId')
      .populate('packageId')
      .populate('subscriptionId');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Generate HTML template
    const html = generateInvoiceHTML(invoice, invoice.clientId, invoice.packageId);
    
    // Generate PDF
    const pdfBuffer = await generatePDFFromHTML(html);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF',
      error: error.message
    });
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  generateInvoice,
  updateInvoice,
  markInvoiceAsPaid,
  sendInvoiceReminder,
  getOverdueInvoices,
  getInvoicesDueSoon,
  getRevenueStats,
  getInvoiceStats,
  generateInvoicePDF
};
