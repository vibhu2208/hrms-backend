// Multi-tenant compatible attendance controller

const { getTenantConnection } = require('../config/database.config');
const TenantAttendanceSchema = require('../models/tenant/Attendance');
const { verifyOfficeNetwork } = require('../utils/networkVerification');

/**
 * Employee Attendance Controller
 * Handles attendance tracking for employees
 * @module controllers/employeeAttendanceController
 */

/**
 * Get today's attendance
 */
exports.getTodayAttendance = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    tenantConnection = await getTenantConnection(companyId);
    const Attendance = tenantConnection.model('Attendance', TenantAttendanceSchema);

    const doc = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    return res.status(200).json({ success: true, data: doc || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

/**
 * Get attendance history
 */
exports.getAttendanceHistory = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    const user = req.user;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Attendance = tenantConnection.model('Attendance', TenantAttendanceSchema);

    const docs = await Attendance.find({ employeeId: user._id })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

/**
 * Check in
 */
exports.checkIn = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const verification = await verifyOfficeNetwork(req);
    if (!verification.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Attendance allowed only on office WiFi',
        ip: verification.ip
      });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const deviceInfo = req.body?.deviceInfo || req.headers['user-agent'] || '';
    const locationLat = req.body?.locationLat;
    const locationLong = req.body?.locationLong;
    const location = req.body?.location || 'office';

    tenantConnection = await getTenantConnection(companyId);
    const Attendance = tenantConnection.model('Attendance', TenantAttendanceSchema);

    const existing = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existing?.checkIn) {
      return res.status(400).json({ success: false, message: 'Already checked in for today' });
    }

    if (existing && !existing.checkIn) {
      existing.checkIn = now;
      existing.ipAddress = verification.ip;
      existing.networkName = verification.network;
      existing.deviceInfo = deviceInfo;
      existing.location = location;
      if (locationLat !== undefined) existing.locationLat = locationLat;
      if (locationLong !== undefined) existing.locationLong = locationLong;
      await existing.save();

      return res.status(200).json({
        success: true,
        message: 'Check-in successful',
        time: now.toISOString(),
        data: existing
      });
    }

    const doc = await Attendance.create({
      employeeId: user._id,
      employeeEmail: user.email,
      date: startOfDay,
      checkIn: now,
      status: 'present',
      location,
      ipAddress: verification.ip,
      networkName: verification.network,
      deviceInfo,
      locationLat,
      locationLong
    });

    return res.status(201).json({
      success: true,
      message: 'Check-in successful',
      time: now.toISOString(),
      data: doc
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

/**
 * Check out
 */
exports.checkOut = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const verification = await verifyOfficeNetwork(req);
    if (!verification.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Attendance allowed only on office WiFi',
        ip: verification.ip
      });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const deviceInfo = req.body?.deviceInfo || req.headers['user-agent'] || '';
    const locationLat = req.body?.locationLat;
    const locationLong = req.body?.locationLong;

    tenantConnection = await getTenantConnection(companyId);
    const Attendance = tenantConnection.model('Attendance', TenantAttendanceSchema);

    const doc = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!doc?.checkIn) {
      return res.status(400).json({ success: false, message: 'You have not checked in today' });
    }

    if (doc.checkOut) {
      return res.status(400).json({ success: false, message: 'Already checked out for today' });
    }

    doc.checkOut = now;
    doc.ipAddress = verification.ip;
    doc.networkName = verification.network;
    doc.deviceInfo = deviceInfo;
    if (locationLat !== undefined) doc.locationLat = locationLat;
    if (locationLong !== undefined) doc.locationLong = locationLong;
    await doc.save();

    return res.status(200).json({
      success: true,
      message: 'Check-out successful',
      time: now.toISOString(),
      data: doc
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

/**
 * Request regularization
 */
exports.requestRegularization = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Regularization feature coming soon'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
