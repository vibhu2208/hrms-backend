/**
 * Base Adapter for Biometric Devices
 * All device-specific adapters should extend this class
 * @module services/biometric/BaseAdapter
 */

class BaseAdapter {
  constructor(deviceConfig) {
    this.deviceId = deviceConfig.deviceId;
    this.ipAddress = deviceConfig.ipAddress;
    this.port = deviceConfig.port;
    this.username = deviceConfig.username || 'admin';
    this.password = deviceConfig.password;
    this.connected = false;
  }

  /**
   * Connect to device
   * Must be implemented by subclasses
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from device
   * Must be implemented by subclasses
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.connect();
      await this.disconnect();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Add user to device
   * Must be implemented by subclasses
   */
  async addUser(userData) {
    throw new Error('addUser() must be implemented by subclass');
  }

  /**
   * Remove user from device
   * Must be implemented by subclasses
   */
  async removeUser(employeeCode) {
    throw new Error('removeUser() must be implemented by subclass');
  }

  /**
   * Get attendance data from device
   * Must be implemented by subclasses
   */
  async getAttendance(startDate, endDate) {
    throw new Error('getAttendance() must be implemented by subclass');
  }

  /**
   * Clear attendance data from device
   * Must be implemented by subclasses
   */
  async clearAttendance() {
    throw new Error('clearAttendance() must be implemented by subclass');
  }

  /**
   * Get device information
   * Must be implemented by subclasses
   */
  async getDeviceInfo() {
    throw new Error('getDeviceInfo() must be implemented by subclass');
  }
}

module.exports = BaseAdapter;


