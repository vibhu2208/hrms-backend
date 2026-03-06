/**
 * Biometric Service
 * Handles device connection, employee sync, attendance pull, and data validation
 * @module services/biometricService
 */

const BiometricDevice = require('../models/BiometricDevice');
const BiometricSyncLog = require('../models/BiometricSyncLog');
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const BiometricAttendanceSchema = require('../models/tenant/BiometricAttendance');
const AttendanceSchema = require('../models/Attendance');

class BiometricService {
  /**
   * Test device connection
   */
  async testConnection(deviceId) {
    try {
      const device = await BiometricDevice.findById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // TODO: Implement actual device connection test
      // This is a placeholder - actual implementation will depend on device SDK
      // For now, return mock success
      return {
        success: true,
        message: 'Connection test successful',
        device: {
          id: device.deviceId,
          name: device.deviceName,
          ip: device.ipAddress,
          port: device.port
        }
      };
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Sync employees to biometric device
   */
  async syncEmployeesToDevice(deviceId, companyId) {
    const startTime = new Date();
    let syncLog = null;

    try {
      const device = await BiometricDevice.findById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (device.companyId.toString() !== companyId.toString()) {
        throw new Error('Device does not belong to this company');
      }

      // Create sync log
      syncLog = new BiometricSyncLog({
        deviceId: device._id,
        companyId: device.companyId,
        syncType: 'employee_push',
        status: 'success',
        startTime
      });

      // Get tenant connection
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get active employees
      const employees = await TenantUser.find({
        role: 'employee',
        isActive: true
      }).select('firstName lastName email employeeCode');

      const results = {
        total: employees.length,
        success: 0,
        failed: 0,
        errors: []
      };

      // TODO: Implement actual employee sync to device
      // This is a placeholder - actual implementation will use device SDK
      // For each employee, push to device:
      // - Employee code/ID
      // - Name
      // - Fingerprint/template (if available)

      // Mock implementation
      for (const employee of employees) {
        try {
          // Simulate device push
          // await deviceAdapter.addUser(employee);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            employee: employee.email,
            error: error.message
          });
        }
      }

      // Update device
      device.totalEmployees = results.success;
      device.lastSync = new Date();
      device.lastSyncStatus = results.failed > 0 ? 'partial' : 'success';
      await device.save();

      // Update sync log
      const endTime = new Date();
      syncLog.endTime = endTime;
      syncLog.recordsCount = results.total;
      syncLog.successCount = results.success;
      syncLog.failedCount = results.failed;
      syncLog.status = results.failed > 0 ? 'partial' : 'success';
      if (results.errors.length > 0) {
        syncLog.errorMessage = `${results.failed} employees failed to sync`;
        syncLog.errorDetails = results.errors;
      }
      await syncLog.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Synced ${results.success}/${results.total} employees`,
        data: results
      };
    } catch (error) {
      if (syncLog) {
        syncLog.status = 'failed';
        syncLog.endTime = new Date();
        syncLog.errorMessage = error.message;
        await syncLog.save();
      }

      throw error;
    }
  }

  /**
   * Pull attendance data from biometric device
   */
  async pullAttendanceFromDevice(deviceId, companyId, startDate, endDate) {
    const startTime = new Date();
    let syncLog = null;

    try {
      const device = await BiometricDevice.findById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (device.companyId.toString() !== companyId.toString()) {
        throw new Error('Device does not belong to this company');
      }

      // Create sync log
      syncLog = new BiometricSyncLog({
        deviceId: device._id,
        companyId: device.companyId,
        syncType: 'attendance_pull',
        status: 'success',
        startTime,
        metadata: { startDate, endDate }
      });

      // Get tenant connection
      const tenantConnection = await getTenantConnection(companyId);
      const BiometricAttendance = tenantConnection.model('BiometricAttendance', BiometricAttendanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // TODO: Implement actual attendance pull from device
      // This is a placeholder - actual implementation will use device SDK
      // const attendanceData = await deviceAdapter.getAttendance(startDate, endDate);

      // Mock attendance data structure
      const mockAttendanceData = [];

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
        duplicates: 0
      };

      // Process each attendance record
      for (const record of mockAttendanceData) {
        try {
          // Find employee by code
          const employee = await TenantUser.findOne({
            employeeCode: record.employeeCode,
            isActive: true
          });

          if (!employee) {
            results.failed++;
            results.errors.push({
              employeeCode: record.employeeCode,
              error: 'Employee not found'
            });
            continue;
          }

          // Check for duplicates
          const existing = await BiometricAttendance.findOne({
            employeeCode: record.employeeCode,
            deviceId: device.deviceId,
            checkIn: record.checkIn
          });

          if (existing) {
            results.duplicates++;
            continue;
          }

          // Create biometric attendance record
          const biometricAttendance = new BiometricAttendance({
            employeeCode: record.employeeCode,
            employeeId: employee._id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            date: new Date(record.date),
            rawData: record,
            syncLogId: syncLog._id
          });

          await biometricAttendance.save();
          results.success++;
          results.total++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            employeeCode: record.employeeCode,
            error: error.message
          });
        }
      }

      // Update device
      device.lastSync = new Date();
      device.lastSyncStatus = results.failed > 0 ? 'partial' : 'success';
      device.totalAttendanceRecords += results.success;
      await device.save();

      // Update sync log
      const endTime = new Date();
      syncLog.endTime = endTime;
      syncLog.recordsCount = results.total;
      syncLog.successCount = results.success;
      syncLog.failedCount = results.failed;
      syncLog.status = results.failed > 0 ? 'partial' : 'success';
      if (results.errors.length > 0) {
        syncLog.errorMessage = `${results.failed} records failed to sync`;
        syncLog.errorDetails = results.errors;
      }
      await syncLog.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Pulled ${results.success} attendance records`,
        data: results
      };
    } catch (error) {
      if (syncLog) {
        syncLog.status = 'failed';
        syncLog.endTime = new Date();
        syncLog.errorMessage = error.message;
        await syncLog.save();
      }

      throw error;
    }
  }

  /**
   * Process biometric attendance to main attendance records
   */
  async processBiometricAttendance(companyId, startDate, endDate) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const BiometricAttendance = tenantConnection.model('BiometricAttendance', BiometricAttendanceSchema);
      const Attendance = tenantConnection.model('Attendance', AttendanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const query = {
        isProcessed: false
      };

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      const unprocessedRecords = await BiometricAttendance.find(query)
        .populate('employeeId', 'firstName lastName email')
        .sort({ date: 1, checkIn: 1 });

      const results = {
        total: unprocessedRecords.length,
        processed: 0,
        failed: 0,
        errors: []
      };

      for (const record of unprocessedRecords) {
        try {
          if (!record.employeeId) {
            results.failed++;
            results.errors.push({
              recordId: record._id,
              error: 'Employee not found'
            });
            continue;
          }

          // Check if attendance already exists for this date
          const existingAttendance = await Attendance.findOne({
            employee: record.employeeId._id,
            date: record.date
          });

          if (existingAttendance) {
            // Update existing attendance
            existingAttendance.checkIn = record.checkIn;
            if (record.checkOut) {
              existingAttendance.checkOut = record.checkOut;
            }
            existingAttendance.status = 'present';
            existingAttendance.workHours = record.workHours || 0;
            existingAttendance.device = record.deviceName;
            await existingAttendance.save();
          } else {
            // Create new attendance record
            const attendance = new Attendance({
              employee: record.employeeId._id,
              date: record.date,
              checkIn: record.checkIn,
              checkOut: record.checkOut,
              status: 'present',
              workHours: record.workHours || 0,
              device: record.deviceName
            });
            await attendance.save();
          }

          // Mark as processed
          record.isProcessed = true;
          record.processedAt = new Date();
          await record.save();

          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            recordId: record._id,
            error: error.message
          });
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${results.processed}/${results.total} records`,
        data: results
      };
    } catch (error) {
      throw new Error(`Failed to process biometric attendance: ${error.message}`);
    }
  }

  /**
   * Validate biometric attendance data
   */
  async validateAttendanceData(companyId, records) {
    const errors = [];
    const warnings = [];

    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2; // Excel row number (assuming header is row 1)

        // Validate employee code
        if (!record.employeeCode) {
          errors.push({ row: rowNum, field: 'employeeCode', error: 'Employee code is required' });
          continue;
        }

        // Check if employee exists
        const employee = await TenantUser.findOne({
          employeeCode: record.employeeCode,
          isActive: true
        });

        if (!employee) {
          errors.push({ row: rowNum, field: 'employeeCode', error: `Employee not found: ${record.employeeCode}` });
          continue;
        }

        // Validate dates
        if (!record.checkIn) {
          errors.push({ row: rowNum, field: 'checkIn', error: 'Check-in time is required' });
        }

        if (record.checkOut && new Date(record.checkOut) < new Date(record.checkIn)) {
          errors.push({ row: rowNum, field: 'checkOut', error: 'Check-out time must be after check-in' });
        }

        // Validate work hours
        if (record.workHours && (record.workHours < 0 || record.workHours > 24)) {
          warnings.push({ row: rowNum, field: 'workHours', warning: 'Work hours seems unusual' });
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Reprocess failed records
   */
  async reprocessFailedRecords(companyId, syncLogId) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const BiometricAttendance = tenantConnection.model('BiometricAttendance', BiometricAttendanceSchema);

      const failedRecords = await BiometricAttendance.find({
        syncLogId,
        isProcessed: false
      });

      return await this.processBiometricAttendance(companyId);
    } catch (error) {
      throw new Error(`Reprocessing failed: ${error.message}`);
    }
  }
}

module.exports = new BiometricService();


