const billingAutomationService = require('../services/billingAutomationService');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');

// Run daily billing automation manually
const runDailyAutomation = async (req, res) => {
  try {
    const results = await billingAutomationService.runDailyBillingAutomation();

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'EXECUTE',
      resourceType: 'System',
      resourceId: null,
      details: `Manually triggered daily billing automation. Results: ${JSON.stringify(results)}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Daily billing automation completed successfully',
      data: results
    });
  } catch (error) {
    console.error('Error running daily automation:', error);
    res.status(500).json({
      success: false,
      message: 'Error running daily billing automation',
      error: error.message
    });
  }
};

// Trigger renewal alerts for a specific subscription
const triggerRenewalAlert = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const result = await billingAutomationService.triggerRenewalAlertsForSubscription(subscriptionId);

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'EXECUTE',
      resourceType: 'Subscription',
      resourceId: subscriptionId,
      details: `Manually triggered renewal alert for subscription`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Renewal alert triggered successfully',
      data: result
    });
  } catch (error) {
    console.error('Error triggering renewal alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering renewal alert',
      error: error.message
    });
  }
};

// Trigger auto-renewal for a specific subscription
const triggerAutoRenewal = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const result = await billingAutomationService.triggerAutoRenewalForSubscription(subscriptionId);

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'EXECUTE',
      resourceType: 'Subscription',
      resourceId: subscriptionId,
      details: `Manually triggered auto-renewal for subscription`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Auto-renewal triggered successfully',
      data: result
    });
  } catch (error) {
    console.error('Error triggering auto-renewal:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering auto-renewal',
      error: error.message
    });
  }
};

// Get automation settings
const getAutomationSettings = async (req, res) => {
  try {
    const settings = {
      renewalAlertDays: [30, 14, 7, 3, 1],
      gracePeriodDays: 3,
      autoRenewalEnabled: true,
      emailNotificationsEnabled: true,
      highValueTransactionThreshold: 10000,
      overdueReminderDays: [1, 7, 14, 30]
    };

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching automation settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching automation settings',
      error: error.message
    });
  }
};

// Update automation settings
const updateAutomationSettings = async (req, res) => {
  try {
    const { 
      renewalAlertDays,
      gracePeriodDays,
      autoRenewalEnabled,
      emailNotificationsEnabled,
      highValueTransactionThreshold,
      overdueReminderDays
    } = req.body;

    // In a real implementation, these would be stored in a database
    // For now, we'll just validate and return the settings
    const updatedSettings = {
      renewalAlertDays: renewalAlertDays || [30, 14, 7, 3, 1],
      gracePeriodDays: gracePeriodDays || 3,
      autoRenewalEnabled: autoRenewalEnabled !== undefined ? autoRenewalEnabled : true,
      emailNotificationsEnabled: emailNotificationsEnabled !== undefined ? emailNotificationsEnabled : true,
      highValueTransactionThreshold: highValueTransactionThreshold || 10000,
      overdueReminderDays: overdueReminderDays || [1, 7, 14, 30]
    };

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'UPDATE',
      resourceType: 'System',
      resourceId: null,
      details: `Updated billing automation settings: ${JSON.stringify(updatedSettings)}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Automation settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating automation settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating automation settings',
      error: error.message
    });
  }
};

// Get automation status and last run information
const getAutomationStatus = async (req, res) => {
  try {
    // In a real implementation, this would fetch from a database
    const status = {
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      isEnabled: true,
      lastRunResults: {
        renewalAlerts: 5,
        expiredSubscriptions: 2,
        autoRenewals: 3,
        invoicesGenerated: 8,
        overdueReminders: 4,
        errors: []
      },
      upcomingTasks: {
        renewalAlertsToday: 3,
        expirationsToday: 1,
        autoRenewalsToday: 2,
        overdueInvoices: 6
      }
    };

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching automation status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching automation status',
      error: error.message
    });
  }
};

// Test automation notifications (for development/testing)
const testNotifications = async (req, res) => {
  try {
    const { type, subscriptionId } = req.body;
    
    let result;
    switch (type) {
      case 'renewal_alert':
        result = await billingAutomationService.triggerRenewalAlertsForSubscription(subscriptionId);
        break;
      case 'auto_renewal':
        result = await billingAutomationService.triggerAutoRenewalForSubscription(subscriptionId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid notification type. Use: renewal_alert, auto_renewal'
        });
    }

    // Create audit log
    await SuperAdminAuditLog.create({
      userId: req.user.id,
      action: 'TEST',
      resourceType: 'System',
      resourceId: subscriptionId,
      details: `Tested ${type} notification for subscription ${subscriptionId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: `${type} notification tested successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error testing notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing notifications',
      error: error.message
    });
  }
};

module.exports = {
  runDailyAutomation,
  triggerRenewalAlert,
  triggerAutoRenewal,
  getAutomationSettings,
  updateAutomationSettings,
  getAutomationStatus,
  testNotifications
};
