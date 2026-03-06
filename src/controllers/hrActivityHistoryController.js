const { getTenantModel } = require('../middlewares/tenantMiddleware');
const HRActivityHistorySchema = require('../models/tenant/HRActivityHistory');

/**
 * @desc    Get HR Activity History Timeline
 * @route   GET /api/hr-activity-history
 * @access  Private (Admin, Company Admin)
 */
exports.getHRActivityHistory = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const HRActivityHistory = getTenantModel(tenantConnection, 'HRActivityHistory', HRActivityHistorySchema);

    const {
      hrUserId,
      action,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filters = {
      hrUserId,
      action,
      entityType,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip
    };

    console.log(`🔍 Applying filters:`, filters);

    const activities = await HRActivityHistory.getHRTimeline(filters);
    console.log(`✅ Found ${activities.length} HR activity records`);

    const total = await HRActivityHistory.countDocuments(
      (() => {
        const query = {};
        if (hrUserId) query.hrUserId = hrUserId;
        if (action) query.action = action;
        if (entityType) query.entityType = entityType;
        if (startDate || endDate) {
          query.timestamp = {};
          try {
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
          } catch (dateError) {
            console.warn('Invalid date format in query:', { startDate, endDate });
          }
        }
        return query;
      })()
    );

    console.log(`📊 Total HR activity records in DB: ${total}`);

    // Get statistics
    const stats = await HRActivityHistory.getActivityStats({
      startDate,
      endDate
    });

    // Get unique HR users
    const hrUsers = await HRActivityHistory.distinct('hrUserId',
      (() => {
        const query = {};
        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate);
          if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        return query;
      })()
    );

    console.log(`👥 Found ${hrUsers.length} unique HR users with activity`);

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        },
        stats,
        totalHRUsers: hrUsers.length
      }
    });
  } catch (error) {
    console.error('Error fetching HR activity history:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR activity history',
      error: error.message
    });
  }
};

/**
 * @desc    Get HR Activity History for specific HR user
 * @route   GET /api/hr-activity-history/hr/:hrUserId
 * @access  Private (Admin, Company Admin)
 */
exports.getHRUserActivity = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const HRActivityHistory = getTenantModel(tenantConnection, 'HRActivityHistory', HRActivityHistorySchema);

    const { hrUserId } = req.params;
    const {
      action,
      entityType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filters = {
      hrUserId,
      action,
      entityType,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip
    };

    const activities = await HRActivityHistory.getHRTimeline(filters);
    const total = await HRActivityHistory.countDocuments(
      (() => {
        const query = { hrUserId };
        if (action) query.action = action;
        if (entityType) query.entityType = entityType;
        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate);
          if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        return query;
      })()
    );

    // Get statistics for this HR user
    const stats = await HRActivityHistory.getActivityStats({
      hrUserId,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        },
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching HR user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR user activity',
      error: error.message
    });
  }
};

/**
 * @desc    Get HR Activity Statistics
 * @route   GET /api/hr-activity-history/stats
 * @access  Private (Admin, Company Admin)
 */
exports.getHRActivityStats = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const HRActivityHistory = getTenantModel(tenantConnection, 'HRActivityHistory', HRActivityHistorySchema);

    const { startDate, endDate } = req.query;

    const stats = await HRActivityHistory.getActivityStats({
      startDate,
      endDate
    });

    // Get total activities count
    const totalActivities = await HRActivityHistory.countDocuments(
      (() => {
        const query = {};
        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate);
          if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        return query;
      })()
    );

    // Get unique HR users count
    const hrUsers = await HRActivityHistory.distinct('hrUserId',
      (() => {
        const query = {};
        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = new Date(startDate);
          if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        return query;
      })()
    );

    // Get activities by HR user
    const activitiesByHR = await HRActivityHistory.aggregate([
      (() => {
        const match = {};
        if (startDate || endDate) {
          match.timestamp = {};
          if (startDate) match.timestamp.$gte = new Date(startDate);
          if (endDate) match.timestamp.$lte = new Date(endDate);
        }
        return { $match: match };
      })(),
      {
        $group: {
          _id: '$hrUserId',
          hrName: { $first: '$hrName' },
          hrEmail: { $first: '$hrEmail' },
          activityCount: { $sum: 1 }
        }
      },
      { $sort: { activityCount: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalActivities,
        totalHRUsers: hrUsers.length,
        activitiesByAction: stats,
        topActiveHR: activitiesByHR
      }
    });
  } catch (error) {
    console.error('Error fetching HR activity statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR activity statistics',
      error: error.message
    });
  }
};
