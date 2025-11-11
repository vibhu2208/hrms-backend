// Audit Log Controller for Super Admin
// Phase 7: Comprehensive audit trail management

const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { MODULES, SUPER_ADMIN_ROLES } = require('../config/superAdminRoles');

// Get audit logs with filtering and pagination
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      module = '',
      action = '',
      userRole = '',
      severity = '',
      result = '',
      startDate = '',
      endDate = '',
      userId = ''
    } = req.query;

    const query = {};

    // Search filter (searches in action, details, and user email)
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { 'details.email': { $regex: search, $options: 'i' } },
        { 'details.companyName': { $regex: search, $options: 'i' } }
      ];
    }

    // Module filter
    if (module && Object.values(MODULES).includes(module)) {
      query.module = module;
    }

    // Action filter
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    // User role filter
    if (userRole && Object.values(SUPER_ADMIN_ROLES).includes(userRole)) {
      query.userInternalRole = userRole;
    }

    // Severity filter
    if (severity) {
      query.severity = severity;
    }

    // Result filter
    if (result) {
      query.result = result;
    }

    // User ID filter
    if (userId) {
      query.userId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const auditLogs = await SuperAdminAuditLog.find(query)
      .populate('userId', 'email internalRole')
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SuperAdminAuditLog.countDocuments(query);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          hasNext: page < pages,
          hasPrev: page > 1
        },
        filters: {
          modules: Object.values(MODULES),
          roles: Object.values(SUPER_ADMIN_ROLES),
          severities: ['low', 'medium', 'high', 'critical'],
          results: ['success', 'failure', 'partial', 'unauthorized']
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit logs',
      error: error.message
    });
  }
};

// Get audit log statistics
const getAuditStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total logs count
    const totalLogs = await SuperAdminAuditLog.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Logs by severity
    const logsBySeverity = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Logs by module
    const logsByModule = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$module',
          count: { $sum: 1 }
        }
      }
    ]);

    // Logs by user role
    const logsByRole = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$userInternalRole',
          count: { $sum: 1 }
        }
      }
    ]);

    // Logs by result
    const logsByResult = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily activity trend
    const dailyActivity = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Most active users
    const mostActiveUsers = await SuperAdminAuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          email: '$user.email',
          internalRole: '$user.internalRole',
          count: 1,
          lastActivity: 1
        }
      }
    ]);

    // Security events count
    const securityEvents = await SuperAdminAuditLog.countDocuments({
      createdAt: { $gte: startDate },
      $or: [
        { action: { $regex: 'UNAUTHORIZED' } },
        { action: { $regex: 'FAILED' } },
        { severity: 'critical' }
      ]
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalLogs,
          securityEvents,
          period: `${days} days`
        },
        distribution: {
          severity: logsBySeverity,
          module: logsByModule,
          role: logsByRole,
          result: logsByResult
        },
        trends: {
          dailyActivity
        },
        users: {
          mostActive: mostActiveUsers
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit statistics',
      error: error.message
    });
  }
};

// Get security events
const getSecurityEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = {
      $or: [
        { action: { $regex: 'UNAUTHORIZED' } },
        { action: { $regex: 'FAILED' } },
        { severity: { $in: ['high', 'critical'] } }
      ]
    };

    const skip = (page - 1) * limit;
    const securityEvents = await SuperAdminAuditLog.find(query)
      .populate('userId', 'email internalRole')
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SuperAdminAuditLog.countDocuments(query);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        securityEvents,
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
      message: 'Error fetching security events',
      error: error.message
    });
  }
};

// Get compliance-relevant logs
const getComplianceLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      startDate,
      endDate 
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required for compliance logs'
      });
    }

    const query = {
      'compliance.gdprRelevant': true,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    const skip = (page - 1) * limit;
    const complianceLogs = await SuperAdminAuditLog.find(query)
      .populate('userId', 'email internalRole')
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SuperAdminAuditLog.countDocuments(query);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        complianceLogs,
        pagination: {
          current: parseInt(page),
          pages,
          total,
          hasNext: page < pages,
          hasPrev: page > 1
        },
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching compliance logs',
      error: error.message
    });
  }
};

// Export audit logs
const exportAuditLogs = async (req, res) => {
  try {
    const {
      format = 'json',
      module = '',
      startDate = '',
      endDate = '',
      severity = ''
    } = req.query;

    const query = {};

    // Apply filters
    if (module && Object.values(MODULES).includes(module)) {
      query.module = module;
    }

    if (severity) {
      query.severity = severity;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const auditLogs = await SuperAdminAuditLog.find(query)
      .populate('userId', 'email internalRole')
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent memory issues

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Timestamp', 'User Email', 'User Role', 'Action', 'Module', 
        'Resource Type', 'Client', 'Result', 'Severity', 'IP Address'
      ];

      const csvRows = auditLogs.map(log => [
        log.createdAt.toISOString(),
        log.userId?.email || 'Unknown',
        log.userInternalRole || 'Unknown',
        log.action,
        log.module,
        log.resourceType,
        log.clientId?.name || 'N/A',
        log.result,
        log.severity,
        log.requestMetadata?.ip || 'Unknown'
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.json"');
      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        totalRecords: auditLogs.length,
        filters: query,
        data: auditLogs
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting audit logs',
      error: error.message
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditStats,
  getSecurityEvents,
  getComplianceLogs,
  exportAuditLogs
};
