// Multi-tenant compatible work schedule controller
const { getTenantConnection } = require('../config/database.config');
const ShiftTemplateSchema = require('../models/tenant/ShiftTemplate');
const WorkScheduleSchema = require('../models/tenant/WorkSchedule');
const RosterAssignmentSchema = require('../models/tenant/RosterAssignment');
const RosterChangeRequestSchema = require('../models/tenant/RosterChangeRequest');
const TenantUserSchema = require('../models/tenant/TenantUser');
const DepartmentModel = require('../models/Department');
const XLSX = require('xlsx');

const DepartmentSchema = DepartmentModel?.schema;

const getTenantModel = (connection, name, schemaOrModel) => {
  if (connection.models[name]) {
    return connection.models[name];
  }

  const schema = schemaOrModel?.schema || schemaOrModel;
  if (!schema) {
    throw new Error(`Schema not provided for tenant model ${name}`);
  }

  return connection.model(name, schema);
};

const registerTenantModels = (connection) => {
  const ShiftTemplate = getTenantModel(connection, 'ShiftTemplate', ShiftTemplateSchema);
  const WorkSchedule = getTenantModel(connection, 'WorkSchedule', WorkScheduleSchema);
  const RosterAssignment = getTenantModel(connection, 'RosterAssignment', RosterAssignmentSchema);
  const RosterChangeRequest = getTenantModel(connection, 'RosterChangeRequest', RosterChangeRequestSchema);
  const TenantUser = getTenantModel(connection, 'User', TenantUserSchema);
  const Department = DepartmentSchema ? getTenantModel(connection, 'Department', DepartmentSchema) : null;

  return {
    ShiftTemplate,
    WorkSchedule,
    RosterAssignment,
    RosterChangeRequest,
    TenantUser,
    Department
  };
};

/**
 * Work Schedule Controller
 * Handles shift templates, work schedules, roster assignments, and change requests
 * @module controllers/workScheduleController
 */

// ==================== SHIFT TEMPLATE OPERATIONS ====================

/**
 * Get all shift templates
 */
exports.getShiftTemplates = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { isActive, location, department } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { ShiftTemplate, Department } = registerTenantModels(tenantConnection);

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (location) query.location = location;
    if (department) query.department = department;

    const templates = await ShiftTemplate.find(query)
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching shift templates:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single shift template
 */
exports.getShiftTemplate = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { ShiftTemplate } = registerTenantModels(tenantConnection);

    const template = await ShiftTemplate.findById(id)
      .populate('department', 'name')
      .populate('createdBy', 'firstName lastName email');

    if (!template) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Shift template not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching shift template:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create shift template
 */
exports.createShiftTemplate = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const {
      name,
      code,
      startTime,
      endTime,
      breakDuration,
      breakStartTime,
      isNightShift,
      applicableDays,
      location,
      department,
      description
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!name || !code || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Name, code, start time, and end time are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { ShiftTemplate } = registerTenantModels(tenantConnection);

    // Check if code already exists
    const existing = await ShiftTemplate.findOne({ code: code.toUpperCase() });
    if (existing) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Shift code already exists'
      });
    }

    const template = new ShiftTemplate({
      name,
      code: code.toUpperCase(),
      startTime,
      endTime,
      breakDuration: breakDuration || 60,
      breakStartTime,
      isNightShift: isNightShift || false,
      applicableDays: applicableDays || [1, 2, 3, 4, 5], // Default: Monday to Friday
      location,
      department,
      description,
      createdBy: user._id
    });

    await template.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Shift template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating shift template:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update shift template
 */
exports.updateShiftTemplate = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const updateData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { ShiftTemplate } = registerTenantModels(tenantConnection);

    // If code is being updated, check for duplicates
    if (updateData.code) {
      const existing = await ShiftTemplate.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existing) {
        if (tenantConnection) await tenantConnection.close();
        return res.status(400).json({
          success: false,
          message: 'Shift code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    const template = await ShiftTemplate.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('department', 'name');

    if (!template) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Shift template not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Shift template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating shift template:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete shift template
 */
exports.deleteShiftTemplate = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { ShiftTemplate, RosterAssignment } = registerTenantModels(tenantConnection);

    // Check if template is being used
    const inUse = await RosterAssignment.findOne({ shiftTemplateId: id, status: 'active' });
    if (inUse) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete shift template that is in use'
      });
    }

    const template = await ShiftTemplate.findByIdAndDelete(id);
    if (!template) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Shift template not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Shift template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shift template:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== WORK SCHEDULE OPERATIONS ====================

/**
 * Get work schedules
 */
exports.getWorkSchedules = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { startDate, endDate, location, department } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { WorkSchedule } = registerTenantModels(tenantConnection);

    const query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (location) query.location = location;
    if (department) query.department = department;

    const schedules = await WorkSchedule.find(query)
      .populate('shiftTemplate')
      .populate('department', 'name')
      .sort({ date: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Error fetching work schedules:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create work schedule
 */
exports.createWorkSchedule = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const { date, shiftTemplate, location, department, isHoliday, holidayName, notes } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!date || !shiftTemplate || !location) {
      return res.status(400).json({
        success: false,
        message: 'Date, shift template, and location are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { WorkSchedule } = registerTenantModels(tenantConnection);

    const scheduleDate = new Date(date);
    const dayOfWeek = scheduleDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const schedule = new WorkSchedule({
      date: scheduleDate,
      shiftTemplate,
      location,
      department,
      isHoliday: isHoliday || false,
      holidayName,
      isWeekend,
      notes,
      createdBy: user._id
    });

    await schedule.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Work schedule created successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Error creating work schedule:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ROSTER ASSIGNMENT OPERATIONS ====================

/**
 * Get roster assignments
 */
exports.getRosterAssignments = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { employeeId, startDate, endDate, status, location } = req.query;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterAssignment } = registerTenantModels(tenantConnection);

    const query = {};
    
    // If employee, only show their assignments
    if (user.role === 'employee') {
      query.employeeId = user._id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (status) query.status = status;
    if (location) query.location = location;
    
    if (startDate || endDate) {
      query.$or = [
        {
          effectiveDate: { $lte: endDate ? new Date(endDate) : new Date() },
          $or: [
            { endDate: { $gte: startDate ? new Date(startDate) : new Date() } },
            { endDate: null }
          ]
        }
      ];
    }

    const assignments = await RosterAssignment.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('workScheduleId')
      .populate('shiftTemplateId')
      .populate('department', 'name')
      .sort({ effectiveDate: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching roster assignments:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create roster assignment
 */
exports.createRosterAssignment = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const {
      employeeId,
      employeeEmail,
      workScheduleId,
      shiftTemplateId,
      effectiveDate,
      endDate,
      location,
      department,
      notes
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!employeeId || !workScheduleId || !shiftTemplateId || !effectiveDate || !location) {
      return res.status(400).json({
        success: false,
        message: 'Employee, work schedule, shift template, effective date, and location are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterAssignment, TenantUser, WorkSchedule, ShiftTemplate } = registerTenantModels(tenantConnection);

    // Get employee details
    const employee = await TenantUser.findById(employeeId);
    if (!employee) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check for overlapping assignments
    const overlapping = await RosterAssignment.findOne({
      employeeId,
      status: 'active',
      effectiveDate: { $lte: endDate || new Date('2099-12-31') },
      $or: [
        { endDate: { $gte: new Date(effectiveDate) } },
        { endDate: null }
      ]
    });

    if (overlapping) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Overlapping roster assignment exists'
      });
    }

    const assignment = new RosterAssignment({
      employeeId,
      employeeEmail: employeeEmail || employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      workScheduleId,
      shiftTemplateId,
      effectiveDate: new Date(effectiveDate),
      endDate: endDate ? new Date(endDate) : null,
      location,
      department,
      notes,
      assignedBy: user._id
    });

    await assignment.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Roster assignment created successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error creating roster assignment:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Bulk upload roster assignments
 */
exports.bulkUploadRoster = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterAssignment, TenantUser, ShiftTemplate, WorkSchedule } = registerTenantModels(tenantConnection);

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row['Employee Email'] || !row['Shift Code'] || !row['Effective Date'] || !row['Location']) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required fields'
          });
          continue;
        }

        // Find employee
        const employee = await TenantUser.findOne({ email: row['Employee Email'].toLowerCase() });
        if (!employee) {
          results.errors.push({
            row: i + 2,
            error: `Employee not found: ${row['Employee Email']}`
          });
          continue;
        }

        // Find shift template
        const shiftTemplate = await ShiftTemplate.findOne({ code: row['Shift Code'].toUpperCase() });
        if (!shiftTemplate) {
          results.errors.push({
            row: i + 2,
            error: `Shift template not found: ${row['Shift Code']}`
          });
          continue;
        }

        // Find or create work schedule
        const scheduleDate = new Date(row['Effective Date']);
        let workSchedule = await WorkSchedule.findOne({
          date: scheduleDate,
          location: row['Location']
        });

        if (!workSchedule) {
          workSchedule = new WorkSchedule({
            date: scheduleDate,
            shiftTemplate: shiftTemplate._id,
            location: row['Location'],
            createdBy: user._id
          });
          await workSchedule.save();
        }

        // Create assignment
        const assignment = new RosterAssignment({
          employeeId: employee._id,
          employeeEmail: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          workScheduleId: workSchedule._id,
          shiftTemplateId: shiftTemplate._id,
          effectiveDate: scheduleDate,
          endDate: row['End Date'] ? new Date(row['End Date']) : null,
          location: row['Location'],
          assignedBy: user._id
        });

        await assignment.save();
        results.success.push({
          row: i + 2,
          employee: employee.email,
          shift: shiftTemplate.code
        });
      } catch (error) {
        results.errors.push({
          row: i + 2,
          error: error.message
        });
      }
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: `Processed ${data.length} rows. ${results.success.length} successful, ${results.errors.length} errors`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ROSTER CHANGE REQUEST OPERATIONS ====================

/**
 * Get roster change requests
 */
exports.getRosterChangeRequests = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { status, employeeId } = req.query;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterChangeRequest } = registerTenantModels(tenantConnection);

    const query = {};
    
    // If employee, only show their requests
    if (user.role === 'employee') {
      query.employeeId = user._id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    // If manager, show requests for their team
    if (user.role === 'manager') {
      query.reportingManager = user.email.toLowerCase();
    }

    if (status) query.status = status;

    const requests = await RosterChangeRequest.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('currentShiftTemplateId')
      .populate('requestedShiftTemplateId')
      .sort({ appliedOn: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching roster change requests:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create roster change request
 */
exports.createRosterChangeRequest = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const {
      requestedShiftTemplateId,
      requestedDate,
      reason
    } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    if (!requestedShiftTemplateId || !requestedDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Requested shift template, date, and reason are required'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterChangeRequest, RosterAssignment, TenantUser, ShiftTemplate } = registerTenantModels(tenantConnection);

    // Get employee details
    const employee = await TenantUser.findById(user._id);
    if (!employee) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Find current assignment
    const currentAssignment = await RosterAssignment.findOne({
      employeeId: user._id,
      status: 'active',
      effectiveDate: { $lte: new Date(requestedDate) },
      $or: [
        { endDate: { $gte: new Date(requestedDate) } },
        { endDate: null }
      ]
    });

    const request = new RosterChangeRequest({
      employeeId: user._id,
      employeeEmail: employee.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      currentScheduleId: currentAssignment?._id,
      currentShiftTemplateId: currentAssignment?.shiftTemplateId,
      requestedShiftTemplateId,
      requestedDate: new Date(requestedDate),
      reason,
      reportingManager: employee.reportingManager || null
    });

    await request.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Roster change request created successfully',
      data: request
    });
  } catch (error) {
    console.error('Error creating roster change request:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Approve roster change request
 */
exports.approveRosterChangeRequest = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { comments } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterChangeRequest, RosterAssignment, WorkSchedule, ShiftTemplate } = registerTenantModels(tenantConnection);

    const request = await RosterChangeRequest.findById(id);
    if (!request) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Roster change request not found'
      });
    }

    // Verify authorization
    if (request.reportingManager !== managerEmail.toLowerCase()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this request'
      });
    }

    if (request.status !== 'pending') {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Request is not pending'
      });
    }

    // Update request status
    request.status = 'approved';
    request.approvedBy = managerName;
    request.approvedByEmail = managerEmail;
    request.approvedOn = new Date();

    // Create new roster assignment
    const scheduleDate = new Date(request.requestedDate);
    let workSchedule = await WorkSchedule.findOne({
      date: scheduleDate,
      shiftTemplate: request.requestedShiftTemplateId
    });

    if (!workSchedule) {
      workSchedule = new WorkSchedule({
        date: scheduleDate,
        shiftTemplate: request.requestedShiftTemplateId,
        location: 'Office', // Default, should be configurable
        createdBy: req.user._id
      });
      await workSchedule.save();
    }

    // End current assignment if exists
    if (request.currentScheduleId) {
      await RosterAssignment.findByIdAndUpdate(request.currentScheduleId, {
        endDate: new Date(request.requestedDate),
        status: 'inactive'
      });
    }

    // Create new assignment
    const assignment = new RosterAssignment({
      employeeId: request.employeeId,
      employeeEmail: request.employeeEmail,
      employeeName: request.employeeName,
      workScheduleId: workSchedule._id,
      shiftTemplateId: request.requestedShiftTemplateId,
      effectiveDate: new Date(request.requestedDate),
      location: 'Office', // Default
      assignedBy: req.user._id
    });

    await assignment.save();
    await request.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Roster change request approved successfully',
      data: request
    });
  } catch (error) {
    console.error('Error approving roster change request:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Reject roster change request
 */
exports.rejectRosterChangeRequest = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const managerEmail = req.user.email;
    const managerName = `${req.user.firstName} ${req.user.lastName}`;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterChangeRequest } = registerTenantModels(tenantConnection);

    const request = await RosterChangeRequest.findById(id);
    if (!request) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Roster change request not found'
      });
    }

    if (request.reportingManager !== managerEmail.toLowerCase()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this request'
      });
    }

    request.status = 'rejected';
    request.rejectedBy = managerName;
    request.rejectedByEmail = managerEmail;
    request.rejectedOn = new Date();
    request.rejectionReason = rejectionReason || '';

    await request.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Roster change request rejected',
      data: request
    });
  } catch (error) {
    console.error('Error rejecting roster change request:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== CALENDAR VIEW ====================

/**
 * Get roster calendar view
 */
exports.getRosterCalendar = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { startDate, endDate, employeeId, location, department } = req.query;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const { RosterAssignment } = registerTenantModels(tenantConnection);

    const query = { status: 'active' };
    
    if (user.role === 'employee') {
      query.employeeId = user._id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (location) query.location = location;
    if (department) query.department = department;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: next 30 days

    query.effectiveDate = { $lte: end };
    query.$or = [
      { endDate: { $gte: start } },
      { endDate: null }
    ];

    const assignments = await RosterAssignment.find(query)
      .populate('employeeId', 'firstName lastName email employeeCode')
      .populate('shiftTemplateId', 'name code startTime endTime')
      .populate('workScheduleId')
      .populate('department', 'name')
      .sort({ effectiveDate: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching roster calendar:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


