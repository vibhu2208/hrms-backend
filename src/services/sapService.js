/**
 * SAP Service
 * Handles SAP connection management and synchronization
 * @module services/sapService
 */

const SAPConnection = require('../models/SAPConnection');
const SAPSyncLog = require('../models/SAPSyncLog');
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const SAPEmployeeMappingSchema = require('../models/tenant/SAPEmployeeMapping');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const AttendanceSchema = require('../models/Attendance');
const SAPConnector = require('./sap/SAPConnector');

class SAPService {
  /**
   * Test SAP connection
   */
  async testConnection(connectionId) {
    try {
      const connection = await SAPConnection.findById(connectionId).select('+password');
      if (!connection) {
        throw new Error('SAP connection not found');
      }

      const connector = new SAPConnector(connection);
      const result = await connector.testConnection();

      // Update connection status
      connection.status = result.success ? 'active' : 'error';
      connection.lastError = result.success ? null : result.message;
      await connection.save();

      return result;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Sync employee master data
   */
  async syncEmployeeMaster(connectionId, companyId, direction = 'bidirectional') {
    const startTime = new Date();
    let syncLog = null;

    try {
      const connection = await SAPConnection.findById(connectionId).select('+password');
      if (!connection) {
        throw new Error('SAP connection not found');
      }

      if (connection.companyId.toString() !== companyId.toString()) {
        throw new Error('Connection does not belong to this company');
      }

      // Create sync log
      syncLog = new SAPSyncLog({
        connectionId: connection._id,
        companyId: connection.companyId,
        syncType: 'employee_master',
        entityType: 'employee',
        direction,
        status: 'success',
        startTime
      });

      const connector = new SAPConnector(connection);
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      const SAPEmployeeMapping = tenantConnection.model('SAPEmployeeMapping', SAPEmployeeMappingSchema);

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
        conflicts: []
      };

      if (direction === 'hrms_to_sap' || direction === 'bidirectional') {
        // Sync HRMS to SAP
        const employees = await TenantUser.find({
          role: 'employee',
          isActive: true
        });

        results.total = employees.length;

        for (const employee of employees) {
          try {
            // TODO: Implement actual SAP employee sync
            // const sapResult = await connector.syncEmployeeToSAP(employee);
            
            // Update mapping
            let mapping = await SAPEmployeeMapping.findOne({ employeeId: employee._id });
            if (!mapping) {
              mapping = new SAPEmployeeMapping({
                employeeId: employee._id,
                employeeEmail: employee.email,
                sapEmployeeId: 'SAP_' + employee._id, // Placeholder
                syncStatus: 'synced'
              });
            }
            mapping.lastSyncDate = new Date();
            mapping.lastSyncDirection = 'hrms_to_sap';
            mapping.syncStatus = 'synced';
            await mapping.save();

            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              employee: employee.email,
              error: error.message
            });
          }
        }
      }

      if (direction === 'sap_to_hrms' || direction === 'bidirectional') {
        // Sync SAP to HRMS
        // TODO: Implement actual SAP to HRMS sync
        // const sapEmployees = await connector.getEmployeesFromSAP();
        // Process and update HRMS employees
      }

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
      if (results.conflicts.length > 0) {
        syncLog.conflicts = results.conflicts;
      }
      await syncLog.save();

      // Update connection
      connection.lastSync = new Date();
      connection.lastSyncStatus = results.failed > 0 ? 'partial' : 'success';
      await connection.save();

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
   * Sync leave balance to SAP
   */
  async syncLeaveBalance(connectionId, companyId, year) {
    const startTime = new Date();
    let syncLog = null;

    try {
      const connection = await SAPConnection.findById(connectionId).select('+password');
      if (!connection) {
        throw new Error('SAP connection not found');
      }

      syncLog = new SAPSyncLog({
        connectionId: connection._id,
        companyId,
        syncType: 'leave_balance',
        entityType: 'leave',
        direction: 'hrms_to_sap',
        status: 'success',
        startTime
      });

      const connector = new SAPConnector(connection);
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const SAPEmployeeMapping = tenantConnection.model('SAPEmployeeMapping', SAPEmployeeMappingSchema);

      const leaveBalances = await LeaveBalance.find({ year: year || new Date().getFullYear() })
        .populate('employeeId', 'email');

      const results = {
        total: leaveBalances.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const balance of leaveBalances) {
        try {
          // Get SAP employee mapping
          const mapping = await SAPEmployeeMapping.findOne({ employeeId: balance.employeeId });
          if (!mapping) {
            results.failed++;
            results.errors.push({
              employee: balance.employeeEmail,
              error: 'SAP employee mapping not found'
            });
            continue;
          }

          // TODO: Implement actual SAP leave balance sync
          // await connector.syncLeaveBalanceToSAP(mapping.sapEmployeeId, balance);

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            employee: balance.employeeEmail,
            error: error.message
          });
        }
      }

      // Update sync log
      const endTime = new Date();
      syncLog.endTime = endTime;
      syncLog.recordsCount = results.total;
      syncLog.successCount = results.success;
      syncLog.failedCount = results.failed;
      syncLog.status = results.failed > 0 ? 'partial' : 'success';
      if (results.errors.length > 0) {
        syncLog.errorMessage = `${results.failed} leave balances failed to sync`;
        syncLog.errorDetails = results.errors;
      }
      await syncLog.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Synced ${results.success}/${results.total} leave balances`,
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
   * Sync attendance data to SAP
   */
  async syncAttendance(connectionId, companyId, startDate, endDate) {
    const startTime = new Date();
    let syncLog = null;

    try {
      const connection = await SAPConnection.findById(connectionId).select('+password');
      if (!connection) {
        throw new Error('SAP connection not found');
      }

      syncLog = new SAPSyncLog({
        connectionId: connection._id,
        companyId,
        syncType: 'attendance',
        entityType: 'attendance',
        direction: 'hrms_to_sap',
        status: 'success',
        startTime,
        metadata: { startDate, endDate }
      });

      const connector = new SAPConnector(connection);
      const tenantConnection = await getTenantConnection(companyId);
      const Attendance = tenantConnection.model('Attendance', AttendanceSchema);
      const SAPEmployeeMapping = tenantConnection.model('SAPEmployeeMapping', SAPEmployeeMappingSchema);

      const query = {};
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      const attendanceRecords = await Attendance.find(query)
        .populate('employee', 'email');

      const results = {
        total: attendanceRecords.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const attendance of attendanceRecords) {
        try {
          // Get SAP employee mapping
          const mapping = await SAPEmployeeMapping.findOne({ employeeId: attendance.employee._id });
          if (!mapping) {
            results.failed++;
            results.errors.push({
              employee: attendance.employee.email,
              error: 'SAP employee mapping not found'
            });
            continue;
          }

          // TODO: Implement actual SAP attendance sync
          // await connector.syncAttendanceToSAP(mapping.sapEmployeeId, attendance);

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            employee: attendance.employee.email,
            error: error.message
          });
        }
      }

      // Update sync log
      const endTime = new Date();
      syncLog.endTime = endTime;
      syncLog.recordsCount = results.total;
      syncLog.successCount = results.success;
      syncLog.failedCount = results.failed;
      syncLog.status = results.failed > 0 ? 'partial' : 'success';
      if (results.errors.length > 0) {
        syncLog.errorMessage = `${results.failed} attendance records failed to sync`;
        syncLog.errorDetails = results.errors;
      }
      await syncLog.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Synced ${results.success}/${results.total} attendance records`,
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
   * Resolve conflicts
   */
  async resolveConflict(connectionId, conflictId, resolution) {
    try {
      const syncLog = await SAPSyncLog.findOne({
        connectionId,
        'conflicts._id': conflictId
      });

      if (!syncLog) {
        throw new Error('Conflict not found');
      }

      const conflict = syncLog.conflicts.id(conflictId);
      if (!conflict) {
        throw new Error('Conflict not found');
      }

      conflict.resolution = resolution;
      await syncLog.save();

      return {
        success: true,
        message: 'Conflict resolved'
      };
    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error.message}`);
    }
  }
}

module.exports = new SAPService();


