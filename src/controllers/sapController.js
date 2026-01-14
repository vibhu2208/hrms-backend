const SAPConnection = require('../models/SAPConnection');
const SAPSyncLog = require('../models/SAPSyncLog');
const sapService = require('../services/sapService');

/**
 * SAP Controller
 * Handles SAP connection management and sync operations
 * @module controllers/sapController
 */

/**
 * Get all SAP connections
 */
exports.getConnections = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const query = { companyId };
    if (status) query.status = status;

    const connections = await SAPConnection.find(query)
      .populate('companyId', 'name')
      .select('-password -encryptedPassword')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: connections.length,
      data: connections
    });
  } catch (error) {
    console.error('Error fetching SAP connections:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single SAP connection
 */
exports.getConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const connection = await SAPConnection.findById(req.params.id)
      .populate('companyId', 'name')
      .select('-password -encryptedPassword');

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId._id.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: connection
    });
  } catch (error) {
    console.error('Error fetching SAP connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create SAP connection
 */
exports.createConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const user = req.user;
    const {
      systemId,
      systemName,
      host,
      client,
      username,
      password,
      systemNumber,
      language,
      syncSettings
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!systemId || !systemName || !host || !client || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'System ID, name, host, client, username, and password are required'
      });
    }

    // Check if system ID already exists
    const existing = await SAPConnection.findOne({ systemId: systemId.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'System ID already exists'
      });
    }

    const connection = new SAPConnection({
      systemId: systemId.toUpperCase(),
      systemName,
      companyId,
      host,
      client,
      username,
      password,
      systemNumber: systemNumber || '00',
      language: language || 'EN',
      syncSettings: syncSettings || {
        employeeMaster: { enabled: true, direction: 'bidirectional', frequency: 60 },
        leaveBalance: { enabled: true, direction: 'hrms_to_sap', frequency: 60 },
        attendance: { enabled: true, direction: 'hrms_to_sap', frequency: 60 }
      },
      createdBy: user._id
    });

    await connection.save();

    // Remove password from response
    const responseData = connection.toObject();
    delete responseData.password;
    delete responseData.encryptedPassword;

    res.status(201).json({
      success: true,
      message: 'SAP connection created successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error creating SAP connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update SAP connection
 */
exports.updateConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const connection = await SAPConnection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updateData = req.body;
    // Don't allow changing systemId or companyId
    delete updateData.systemId;
    delete updateData.companyId;

    Object.assign(connection, updateData);
    await connection.save();

    // Remove password from response
    const responseData = connection.toObject();
    delete responseData.password;
    delete responseData.encryptedPassword;

    res.status(200).json({
      success: true,
      message: 'SAP connection updated successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error updating SAP connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete SAP connection
 */
exports.deleteConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const connection = await SAPConnection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await connection.deleteOne();

    res.status(200).json({
      success: true,
      message: 'SAP connection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting SAP connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Test SAP connection
 */
exports.testConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const connection = await SAPConnection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await sapService.testConnection(req.params.id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Sync employee master data
 */
exports.syncEmployeeMaster = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId } = req.params;
    const { direction } = req.body;

    const connection = await SAPConnection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await sapService.syncEmployeeMaster(connectionId, companyId, direction || 'bidirectional');

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error syncing employee master:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Sync leave balance
 */
exports.syncLeaveBalance = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId } = req.params;
    const { year } = req.query;

    const connection = await SAPConnection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await sapService.syncLeaveBalance(connectionId, companyId, year);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error syncing leave balance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Sync attendance
 */
exports.syncAttendance = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId } = req.params;
    const { startDate, endDate } = req.query;

    const connection = await SAPConnection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'SAP connection not found'
      });
    }

    if (connection.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await sapService.syncAttendance(connectionId, companyId, startDate, endDate);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error syncing attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get sync logs
 */
exports.getSyncLogs = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId, syncType, status, limit = 50 } = req.query;

    const query = { companyId };
    if (connectionId) query.connectionId = connectionId;
    if (syncType) query.syncType = syncType;
    if (status) query.status = status;

    const logs = await SAPSyncLog.find(query)
      .populate('connectionId', 'systemId systemName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get conflicts
 */
exports.getConflicts = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId, resolution } = req.query;

    const query = {
      companyId,
      'conflicts.0': { $exists: true }
    };
    if (connectionId) query.connectionId = connectionId;

    const logs = await SAPSyncLog.find(query)
      .populate('connectionId', 'systemId systemName')
      .sort({ createdAt: -1 });

    let allConflicts = [];
    logs.forEach(log => {
      log.conflicts.forEach(conflict => {
        if (!resolution || conflict.resolution === resolution) {
          allConflicts.push({
            ...conflict.toObject(),
            syncLogId: log._id,
            connectionId: log.connectionId,
            syncDate: log.createdAt
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      count: allConflicts.length,
      data: allConflicts
    });
  } catch (error) {
    console.error('Error fetching conflicts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Resolve conflict
 */
exports.resolveConflict = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { connectionId, conflictId } = req.params;
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: 'Resolution is required'
      });
    }

    const result = await sapService.resolveConflict(connectionId, conflictId, resolution);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


