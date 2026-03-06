const BiometricDevice = require('../models/BiometricDevice');
const BiometricSyncLog = require('../models/BiometricSyncLog');
const biometricService = require('../services/biometricService');
const { getTenantConnection } = require('../config/database.config');
const BiometricAttendanceSchema = require('../models/tenant/BiometricAttendance');

/**
 * Biometric Controller
 * Handles device management and sync operations
 * @module controllers/biometricController
 */

/**
 * Get all biometric devices
 */
exports.getDevices = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { status, location } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const query = { companyId };
    if (status) query.status = status;
    if (location) query.location = location;

    const devices = await BiometricDevice.find(query)
      .populate('companyId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single device
 */
exports.getDevice = async (req, res) => {
  try {
    const companyId = req.companyId;
    const device = await BiometricDevice.findById(req.params.id)
      .populate('companyId', 'name');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId._id.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create biometric device
 */
exports.createDevice = async (req, res) => {
  try {
    const companyId = req.companyId;
    const user = req.user;
    const {
      deviceId,
      deviceName,
      deviceType,
      location,
      ipAddress,
      port,
      username,
      password,
      serialNumber
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!deviceId || !deviceName || !deviceType || !location || !ipAddress || !port || !password) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, name, type, location, IP address, port, and password are required'
      });
    }

    // Check if device ID already exists
    const existing = await BiometricDevice.findOne({ deviceId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Device ID already exists'
      });
    }

    const device = new BiometricDevice({
      deviceId,
      deviceName,
      deviceType,
      companyId,
      location,
      ipAddress,
      port,
      username: username || 'admin',
      password,
      serialNumber,
      createdBy: user._id
    });

    await device.save();

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: device
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update device
 */
exports.updateDevice = async (req, res) => {
  try {
    const companyId = req.companyId;
    const device = await BiometricDevice.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updateData = req.body;
    // Don't allow changing deviceId
    delete updateData.deviceId;
    delete updateData.companyId;

    Object.assign(device, updateData);
    await device.save();

    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      data: device
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete device
 */
exports.deleteDevice = async (req, res) => {
  try {
    const companyId = req.companyId;
    const device = await BiometricDevice.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await device.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Test device connection
 */
exports.testConnection = async (req, res) => {
  try {
    const companyId = req.companyId;
    const device = await BiometricDevice.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await biometricService.testConnection(req.params.id);

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
 * Sync employees to device
 */
exports.syncEmployees = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { deviceId } = req.params;

    const device = await BiometricDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await biometricService.syncEmployeesToDevice(deviceId, companyId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error syncing employees:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Pull attendance from device
 */
exports.pullAttendance = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;

    const device = await BiometricDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await biometricService.pullAttendanceFromDevice(
      deviceId,
      companyId,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error pulling attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process biometric attendance
 */
exports.processAttendance = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { startDate, endDate } = req.query;

    const result = await biometricService.processBiometricAttendance(companyId, startDate, endDate);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error processing attendance:', error);
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
    const { deviceId, syncType, status, limit = 50 } = req.query;

    const query = { companyId };
    if (deviceId) query.deviceId = deviceId;
    if (syncType) query.syncType = syncType;
    if (status) query.status = status;

    const logs = await BiometricSyncLog.find(query)
      .populate('deviceId', 'deviceName deviceId')
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
 * Reprocess failed records
 */
exports.reprocess = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { syncLogId } = req.params;

    const result = await biometricService.reprocessFailedRecords(companyId, syncLogId);

    res.status(200).json({
      success: true,
      message: 'Reprocessing completed',
      data: result
    });
  } catch (error) {
    console.error('Error reprocessing:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


