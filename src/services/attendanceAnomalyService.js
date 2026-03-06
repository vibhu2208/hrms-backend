/**
 * Attendance Anomaly Detection Service
 * Detects unusual patterns and potential fraud in attendance records
 */

class AttendanceAnomalyService {
  /**
   * Detect multiple check-ins on same day
   */
  async detectMultipleCheckIns(employeeId, date, tenantConnection) {
    const Attendance = tenantConnection.model('Attendance');
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const attendances = await Attendance.find({
      employeeId,
      checkIn: { $gte: startOfDay, $lte: endOfDay }
    });

    if (attendances.length > 1) {
      return {
        detected: true,
        type: 'MULTIPLE_CHECK_INS',
        severity: 'high',
        description: `${attendances.length} check-ins detected on ${date.toDateString()}`,
        data: attendances
      };
    }

    return { detected: false };
  }

  /**
   * Detect missing check-out
   */
  async detectMissingCheckOut(employeeId, date, tenantConnection) {
    const Attendance = tenantConnection.model('Attendance');
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      employeeId,
      checkIn: { $gte: startOfDay, $lte: endOfDay },
      checkOut: null
    });

    if (attendance) {
      const hoursSinceCheckIn = (new Date() - attendance.checkIn) / (1000 * 60 * 60);
      
      if (hoursSinceCheckIn > 24) {
        return {
          detected: true,
          type: 'MISSING_CHECK_OUT',
          severity: 'medium',
          description: `Check-out missing for ${Math.floor(hoursSinceCheckIn)} hours`,
          data: attendance
        };
      }
    }

    return { detected: false };
  }

  /**
   * Detect unusual working hours
   */
  detectUnusualHours(checkIn, checkOut, shift) {
    if (!checkOut) return { detected: false };

    const workingHours = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60);
    const shiftHours = shift?.duration || 9;

    const anomalies = [];

    // Working hours > 16 hours
    if (workingHours > 16) {
      anomalies.push({
        detected: true,
        type: 'EXCESSIVE_HOURS',
        severity: 'high',
        description: `Working hours (${workingHours.toFixed(2)}h) exceed 16 hours`,
        workingHours
      });
    }

    // Working hours < 2 hours (but marked present)
    if (workingHours < 2) {
      anomalies.push({
        detected: true,
        type: 'INSUFFICIENT_HOURS',
        severity: 'medium',
        description: `Working hours (${workingHours.toFixed(2)}h) less than 2 hours`,
        workingHours
      });
    }

    // Overtime > 4 hours
    const overtime = Math.max(0, workingHours - shiftHours);
    if (overtime > 4) {
      anomalies.push({
        detected: true,
        type: 'EXCESSIVE_OVERTIME',
        severity: 'medium',
        description: `Overtime (${overtime.toFixed(2)}h) exceeds 4 hours`,
        overtime
      });
    }

    return anomalies.length > 0 ? anomalies[0] : { detected: false };
  }

  /**
   * Detect attendance on holiday/weekend
   */
  async detectHolidayAttendance(employeeId, date, tenantConnection) {
    const dayOfWeek = new Date(date).getDay();
    
    // Check if weekend (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        detected: true,
        type: 'WEEKEND_ATTENDANCE',
        severity: 'low',
        description: `Attendance marked on ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}`,
        requiresApproval: true
      };
    }

    // Check if public holiday
    const Holiday = tenantConnection.model('Holiday');
    const holiday = await Holiday.findOne({
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      }
    });

    if (holiday) {
      return {
        detected: true,
        type: 'HOLIDAY_ATTENDANCE',
        severity: 'low',
        description: `Attendance marked on holiday: ${holiday.name}`,
        requiresApproval: true,
        holiday
      };
    }

    return { detected: false };
  }

  /**
   * Detect geolocation anomalies
   */
  detectLocationAnomaly(attendance, officeLocations) {
    if (!attendance.geolocation || !officeLocations || officeLocations.length === 0) {
      return { detected: false };
    }

    const { latitude, longitude } = attendance.geolocation;

    // Check if within geofence of any office location
    for (const office of officeLocations) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        office.latitude,
        office.longitude
      );

      // Within 500 meters
      if (distance <= 0.5) {
        return { detected: false };
      }
    }

    return {
      detected: true,
      type: 'LOCATION_ANOMALY',
      severity: 'high',
      description: 'Attendance marked from unauthorized location',
      location: { latitude, longitude }
    };
  }

  /**
   * Calculate distance between two coordinates (in km)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Flag attendance for review
   */
  async flagForReview(anomalyType, attendanceId, details, tenantConnection) {
    const Attendance = tenantConnection.model('Attendance');
    
    await Attendance.findByIdAndUpdate(attendanceId, {
      $set: {
        flaggedForReview: true,
        anomalyType,
        anomalyDetails: details,
        flaggedAt: new Date()
      }
    });

    // Create notification for HR/Manager
    // TODO: Implement notification service
    console.log(`Attendance ${attendanceId} flagged for review: ${anomalyType}`);
  }

  /**
   * Comprehensive anomaly check
   */
  async checkAllAnomalies(attendance, tenantConnection) {
    const anomalies = [];

    // Check multiple check-ins
    const multipleCheckIns = await this.detectMultipleCheckIns(
      attendance.employeeId,
      attendance.checkIn,
      tenantConnection
    );
    if (multipleCheckIns.detected) anomalies.push(multipleCheckIns);

    // Check missing check-out
    const missingCheckOut = await this.detectMissingCheckOut(
      attendance.employeeId,
      attendance.checkIn,
      tenantConnection
    );
    if (missingCheckOut.detected) anomalies.push(missingCheckOut);

    // Check unusual hours
    if (attendance.checkOut) {
      const unusualHours = this.detectUnusualHours(
        attendance.checkIn,
        attendance.checkOut,
        attendance.shift
      );
      if (unusualHours.detected) anomalies.push(unusualHours);
    }

    // Check holiday attendance
    const holidayAttendance = await this.detectHolidayAttendance(
      attendance.employeeId,
      attendance.checkIn,
      tenantConnection
    );
    if (holidayAttendance.detected) anomalies.push(holidayAttendance);

    return anomalies;
  }
}

module.exports = new AttendanceAnomalyService();
