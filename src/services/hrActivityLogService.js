/**
 * HR Activity Logging Service
 * Centralized service for logging HR activities
 */

const { getTenantModel } = require('../middlewares/tenantMiddleware');
const HRActivityHistorySchema = require('../models/tenant/HRActivityHistory');

/**
 * Log HR activity
 * @param {Object} tenantConnection - Tenant database connection
 * @param {Object} activityData - Activity data to log
 * @param {Object} req - Express request object (optional, for IP and user agent)
 */
// #region agent log - hypothesis A: Database/Model issue
const logHRActivity = async (tenantConnection, activityData, req = null) => {
  fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hrActivityLogService.js:logHRActivity:entry',
      message: 'logHRActivity function called',
      data: { action: activityData.action, hrName: activityData.hrName, tenantConnection: !!tenantConnection },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'hypothesis-check',
      hypothesisId: 'A'
    })
  }).catch(() => {});

  try {
    const HRActivityHistory = getTenantModel(tenantConnection, 'HRActivityHistory', HRActivityHistorySchema);

    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:logHRActivity:model',
        message: 'HRActivityHistory model obtained',
        data: { modelName: 'HRActivityHistory', hasModel: !!HRActivityHistory, tenantConnectionName: tenantConnection.name },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'A'
      })
    }).catch(() => {});

    // Extract IP and user agent from request if available
    const ipAddress = req?.ip || req?.connection?.remoteAddress || req?.headers?.['x-forwarded-for']?.split(',')[0] || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    const logData = {
      ...activityData,
      ipAddress,
      userAgent
    };

    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:logHRActivity:before-save',
        message: 'About to call logActivity method',
        data: { logData: JSON.stringify(logData) },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'A'
      })
    }).catch(() => {});

    await HRActivityHistory.logActivity(logData);

    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:logHRActivity:success',
        message: 'HR activity logged successfully',
        data: { action: activityData.action, hrName: activityData.hrName },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'A'
      })
    }).catch(() => {});

    console.log(`✅ Logged HR activity: ${activityData.action} by ${activityData.hrName}`);
  } catch (error) {
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:logHRActivity:error',
        message: 'Error logging HR activity',
        data: { error: error.message, stack: error.stack, action: activityData.action },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'A'
      })
    }).catch(() => {});

    console.error(`❌ Error logging HR activity:`, error);
    // Don't throw error - logging should not break the main flow
  }
};
// #endregion

/**
 * Helper function to get HR user details from request
 */
// #region agent log - hypothesis B: Authentication issue
const getHRUserDetails = (req) => {
  fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hrActivityLogService.js:getHRUserDetails:entry',
      message: 'getHRUserDetails called',
      data: { hasReq: !!req, hasUser: !!req?.user, userKeys: req?.user ? Object.keys(req.user) : null },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'hypothesis-check',
      hypothesisId: 'B'
    })
  }).catch(() => {});

  if (!req || !req.user) {
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:getHRUserDetails:no-user',
        message: 'No request or user found',
        data: { hasReq: !!req, hasUser: !!req?.user },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'B'
      })
    }).catch(() => {});

    console.warn('⚠️ getHRUserDetails: No req or req.user found');
    return null;
  }

  const userId = req.user._id || req.user.id;
  const firstName = req.user.firstName || '';
  const lastName = req.user.lastName || '';
  const email = req.user.email;

  fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hrActivityLogService.js:getHRUserDetails:user-details',
      message: 'User details extracted',
      data: { userId: !!userId, email: !!email, firstName, lastName, fullUser: req.user },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'hypothesis-check',
      hypothesisId: 'B'
    })
  }).catch(() => {});

  if (!userId || !email) {
    fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hrActivityLogService.js:getHRUserDetails:missing-data',
        message: 'Missing userId or email',
        data: { userId, email },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'hypothesis-check',
        hypothesisId: 'B'
      })
    }).catch(() => {});

    console.warn('⚠️ getHRUserDetails: Missing userId or email', { userId, email });
    return null;
  }

  const hrName = `${firstName} ${lastName}`.trim() || email;

  fetch('http://127.0.0.1:7243/ingest/691fb4e9-ae1d-4385-9f99-b10fde5f9ecf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hrActivityLogService.js:getHRUserDetails:success',
      message: 'HR user details prepared',
      data: { hrUserId: userId, hrName, hrEmail: email },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'hypothesis-check',
      hypothesisId: 'B'
    })
  }).catch(() => {});

  return {
    hrUserId: userId,
    hrName: hrName,
    hrEmail: email
  };
};
// #endregion

/**
 * Log employee creation activity
 */
const logEmployeeCreated = async (tenantConnection, employee, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'employee_created',
    description: `Created employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    entityType: 'employee',
    entityId: employee._id,
    entityName: `${employee.firstName} ${employee.lastName}`,
    metadata: {
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      department: employee.department
    }
  }, req);
};

/**
 * Log employee update activity
 */
const logEmployeeUpdated = async (tenantConnection, employee, previousData, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'employee_updated',
    description: `Updated employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    entityType: 'employee',
    entityId: employee._id,
    entityName: `${employee.firstName} ${employee.lastName}`,
    previousValue: previousData,
    newValue: employee,
    metadata: {
      employeeCode: employee.employeeCode
    }
  }, req);
};

/**
 * Log send to onboarding activity
 */
const logSendToOnboarding = async (tenantConnection, candidate, onboarding, req) => {
  try {
    const hrDetails = getHRUserDetails(req);
    if (!hrDetails) {
      console.warn('⚠️ Cannot log HR activity: HR user details not found in request');
      console.warn('Request user:', req?.user);
      return;
    }

    console.log(`📝 Logging send to onboarding activity for HR: ${hrDetails.hrEmail}`);

    await logHRActivity(tenantConnection, {
      ...hrDetails,
      action: 'send_to_onboarding',
      description: `Sent candidate ${candidate.firstName} ${candidate.lastName} to onboarding`,
      entityType: 'onboarding',
      entityId: onboarding._id,
      entityName: `${candidate.firstName} ${candidate.lastName}`,
      metadata: {
        candidateEmail: candidate.email,
        position: onboarding.position,
        onboardingId: onboarding.onboardingId
      }
    }, req);
  } catch (error) {
    console.error('❌ Error in logSendToOnboarding:', error);
    // Don't throw - logging should not break the main flow
  }
};

/**
 * Log onboarding completion activity
 */
const logOnboardingCompleted = async (tenantConnection, onboarding, employee, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'onboarding_completed',
    description: `Completed onboarding for ${onboarding.candidateName} and created employee ${employee.employeeCode}`,
    entityType: 'onboarding',
    entityId: onboarding._id,
    entityName: onboarding.candidateName,
    metadata: {
      employeeId: employee._id,
      employeeCode: employee.employeeCode,
      onboardingId: onboarding.onboardingId
    }
  }, req);
};

/**
 * Log onboarding status change
 */
const logOnboardingStatusChanged = async (tenantConnection, onboarding, previousStatus, newStatus, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'onboarding_status_changed',
    description: `Changed onboarding status for ${onboarding.candidateName} from ${previousStatus} to ${newStatus}`,
    entityType: 'onboarding',
    entityId: onboarding._id,
    entityName: onboarding.candidateName,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
    metadata: {
      onboardingId: onboarding.onboardingId
    }
  }, req);
};

/**
 * Log document verification
 */
const logDocumentVerified = async (tenantConnection, onboarding, documentType, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'document_verified',
    description: `Verified ${documentType} document for ${onboarding.candidateName}`,
    entityType: 'onboarding',
    entityId: onboarding._id,
    entityName: onboarding.candidateName,
    metadata: {
      documentType,
      onboardingId: onboarding.onboardingId
    }
  }, req);
};

/**
 * Log offer sent
 */
const logOfferSent = async (tenantConnection, onboarding, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'offer_sent',
    description: `Sent offer letter to ${onboarding.candidateName}`,
    entityType: 'onboarding',
    entityId: onboarding._id,
    entityName: onboarding.candidateName,
    metadata: {
      onboardingId: onboarding.onboardingId,
      position: onboarding.position
    }
  }, req);
};

/**
 * Log offer extended (used for various offer sending scenarios)
 */
const logOfferExtended = async (tenantConnection, data, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  const entityType = data.onboardingId ? 'onboarding' : 'candidate';

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'offer_sent',
    description: `Sent offer letter to ${data.candidateName}`,
    entityType,
    entityId: data._id,
    entityName: data.candidateName,
    metadata: {
      candidateEmail: data.candidateEmail,
      position: data.position,
      onboardingId: data.onboardingId
    }
  }, req);
};

/**
 * Log candidate shortlisted
 */
const logCandidateShortlisted = async (tenantConnection, candidate, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'candidate_shortlisted',
    description: `Shortlisted candidate: ${candidate.firstName} ${candidate.lastName}`,
    entityType: 'candidate',
    entityId: candidate._id,
    entityName: `${candidate.firstName} ${candidate.lastName}`,
    metadata: {
      candidateEmail: candidate.email,
      jobTitle: candidate.appliedFor?.title
    }
  }, req);
};

/**
 * Log job posting created
 */
const logJobPostingCreated = async (tenantConnection, jobPosting, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'job_posting_created',
    description: `Created job posting: ${jobPosting.title}`,
    entityType: 'job_posting',
    entityId: jobPosting._id,
    entityName: jobPosting.title,
    metadata: {
      department: jobPosting.department,
      location: jobPosting.location
    }
  }, req);
};

/**
 * Log bulk upload
 */
const logBulkUpload = async (tenantConnection, uploadType, recordCount, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'bulk_upload',
    description: `Performed bulk upload: ${uploadType} (${recordCount} records)`,
    entityType: 'other',
    metadata: {
      uploadType,
      recordCount
    }
  }, req);
};

/**
 * Log employee deletion
 */
const logEmployeeDeleted = async (tenantConnection, employee, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'employee_deleted',
    description: `Deleted employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    entityType: 'employee',
    entityId: employee._id,
    entityName: `${employee.firstName} ${employee.lastName}`,
    metadata: {
      employeeCode: employee.employeeCode
    }
  }, req);
};

/**
 * Log candidate creation
 */
const logCandidateCreated = async (tenantConnection, candidate, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'candidate_created',
    description: `Created candidate: ${candidate.firstName} ${candidate.lastName}`,
    entityType: 'candidate',
    entityId: candidate._id,
    entityName: `${candidate.firstName} ${candidate.lastName}`,
    metadata: {
      candidateCode: candidate.candidateCode,
      source: candidate.source
    }
  }, req);
};

/**
 * Log candidate stage change
 */
const logCandidateStageChanged = async (tenantConnection, candidate, previousStage, newStage, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'candidate_stage_changed',
    description: `Changed candidate stage from ${previousStage} to ${newStage}: ${candidate.firstName} ${candidate.lastName}`,
    entityType: 'candidate',
    entityId: candidate._id,
    entityName: `${candidate.firstName} ${candidate.lastName}`,
    previousValue: { stage: previousStage },
    newValue: { stage: newStage },
    metadata: {
      candidateCode: candidate.candidateCode
    }
  }, req);
};

/**
 * Log user creation
 */
const logUserCreated = async (tenantConnection, user, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'user_created',
    description: `Created user: ${user.firstName} ${user.lastName} (${user.email})`,
    entityType: 'user',
    entityId: user._id,
    entityName: `${user.firstName} ${user.lastName}`,
    metadata: {
      userEmail: user.email,
      userRole: user.role
    }
  }, req);
};

/**
 * Log user status change
 */
const logUserStatusChanged = async (tenantConnection, user, previousStatus, newStatus, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'user_status_changed',
    description: `${newStatus ? 'Activated' : 'Deactivated'} user: ${user.firstName} ${user.lastName} (${user.email})`,
    entityType: 'user',
    entityId: user._id,
    entityName: `${user.firstName} ${user.lastName}`,
    previousValue: { isActive: previousStatus },
    newValue: { isActive: newStatus },
    metadata: {
      userEmail: user.email,
      userRole: user.role
    }
  }, req);
};

/**
 * Log user deletion
 */
const logUserDeleted = async (tenantConnection, user, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'user_deleted',
    description: `Deleted user: ${user.firstName} ${user.lastName} (${user.email})`,
    entityType: 'user',
    entityId: user._id,
    entityName: `${user.firstName} ${user.lastName}`,
    metadata: {
      userEmail: user.email,
      userRole: user.role
    }
  }, req);
};

/**
 * Log offboarding creation
 */
const logOffboardingCreated = async (tenantConnection, offboarding, employee, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'offboarding_created',
    description: `Initiated offboarding for employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    entityType: 'offboarding',
    entityId: offboarding._id,
    entityName: `${employee.firstName} ${employee.lastName}`,
    metadata: {
      employeeCode: employee.employeeCode,
      resignationDate: offboarding.resignationDate,
      lastWorkingDate: offboarding.lastWorkingDate
    }
  }, req);
};

/**
 * Log offboarding status change
 */
const logOffboardingStatusChanged = async (tenantConnection, offboarding, previousStatus, newStatus, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'offboarding_status_changed',
    description: `Changed offboarding status from ${previousStatus} to ${newStatus} for ${offboarding.employeeName}`,
    entityType: 'offboarding',
    entityId: offboarding._id,
    entityName: offboarding.employeeName,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
    metadata: {
      employeeCode: offboarding.employeeCode
    }
  }, req);
};

/**
 * Log department creation
 */
const logDepartmentCreated = async (tenantConnection, department, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'department_created',
    description: `Created department: ${department.name}`,
    entityType: 'department',
    entityId: department._id,
    entityName: department.name,
    metadata: {
      departmentCode: department.code,
      headCount: department.headCount || 0
    }
  }, req);
};

/**
 * Log department update
 */
const logDepartmentUpdated = async (tenantConnection, department, previousData, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'department_updated',
    description: `Updated department: ${department.name}`,
    entityType: 'department',
    entityId: department._id,
    entityName: department.name,
    previousValue: previousData,
    newValue: department,
    metadata: {
      departmentCode: department.code
    }
  }, req);
};

/**
 * Log leave approval/rejection
 */
const logLeaveAction = async (tenantConnection, leave, action, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  const actionText = action === 'approved' ? 'Approved' : 'Rejected';

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: `leave_${action}`,
    description: `${actionText} leave request for ${leave.employeeName} (${leave.leaveType})`,
    entityType: 'leave',
    entityId: leave._id,
    entityName: leave.employeeName,
    metadata: {
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.totalDays
    }
  }, req);
};

/**
 * Log attendance modification
 */
const logAttendanceModified = async (tenantConnection, attendance, action, req) => {
  const hrDetails = getHRUserDetails(req);
  if (!hrDetails) return;

  await logHRActivity(tenantConnection, {
    ...hrDetails,
    action: 'attendance_modified',
    description: `${action} attendance for ${attendance.employeeName} on ${attendance.date}`,
    entityType: 'attendance',
    entityId: attendance._id,
    entityName: attendance.employeeName,
    metadata: {
      date: attendance.date,
      action: action,
      employeeCode: attendance.employeeCode
    }
  }, req);
};

module.exports = {
  logHRActivity,
  getHRUserDetails,
  logEmployeeCreated,
  logEmployeeUpdated,
  logEmployeeDeleted,
  logSendToOnboarding,
  logOnboardingCompleted,
  logOnboardingStatusChanged,
  logDocumentVerified,
  logOfferSent,
  logOfferExtended,
  logCandidateCreated,
  logCandidateStageChanged,
  logCandidateShortlisted,
  logUserCreated,
  logUserStatusChanged,
  logUserDeleted,
  logOffboardingCreated,
  logOffboardingStatusChanged,
  logDepartmentCreated,
  logDepartmentUpdated,
  logLeaveAction,
  logAttendanceModified,
  logJobPostingCreated,
  logBulkUpload
};
