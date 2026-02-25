const TenantEmployeeSchema = require('../models/tenant/TenantEmployee');
const TenantUserSchema = require('../models/tenant/TenantUser');
const Department = require('../models/Department');
const { getTenantModel } = require('../middlewares/tenantMiddleware');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
exports.getEmployeesForOffboarding = async (req, res) => {
  try {
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
    const Offboarding = getTenantModel(tenantConnection, 'Offboarding', require('../models/Offboarding'));

    const { status, department, search } = req.query;
    
    // Get all employees who are active and not ex-employees
    let employeeQuery = {
      isActive: true,
      status: { $ne: 'terminated' }, // Exclude terminated employees
      $or: [
        { isExEmployee: { $exists: false } },
        { isExEmployee: null },
        { isExEmployee: false }
      ]
    };

    // Filter by department if specified
    if (department) employeeQuery.department = department;

    // Search functionality
    if (search) {
      employeeQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await TenantEmployee.find(employeeQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Get all employees who are currently in offboarding process
    const activeOffboardings = await Offboarding.find({
      status: { $in: ['in-progress', 'initiated'] }
    }).select('employee').lean();

    const offboardingEmployeeIds = activeOffboardings.map(o => o.employee.toString());

    // Filter out employees who are already in offboarding
    const availableEmployees = employees.filter(emp => {
      const employeeId = emp._id.toString();
      return !offboardingEmployeeIds.includes(employeeId);
    });

    // Populate department information manually
    const populatedEmployees = await Promise.all(
      availableEmployees.map(async (employee) => {
        // Try to get department from departmentId first, then from department field
        let departmentInfo = null;
        
        if (employee.departmentId) {
          try {
            const Department = getTenantModel(tenantConnection, 'Department', Department.schema);
            departmentInfo = await Department.findById(employee.departmentId).select('name').lean();
          } catch (deptError) {
            console.warn('Could not fetch department by ID:', deptError.message);
          }
        }

        return {
          ...employee,
          department: departmentInfo?.name || employee.department || 'Not Assigned'
        };
      })
    );

    res.status(200).json({ 
      success: true, 
      data: populatedEmployees,
      count: populatedEmployees.length
    });
  } catch (error) {
    console.error('Error in getEmployeesForOffboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
    const TenantDepartment = getTenantModel(tenantConnection, 'Department', Department.schema);

    const { status, department, search, forOffboarding } = req.query;
    
    // Build base query - explicitly exclude ex-employees, inactive employees, and terminated employees
    let query = {
      isActive: { $ne: false }, // Exclude where isActive is explicitly false
      status: { $ne: 'terminated' }, // Exclude terminated employees
      $or: [
        { isExEmployee: { $exists: false } }, // Field doesn't exist (old records)
        { isExEmployee: null }, // Field is null
        { isExEmployee: false }, // Field is false
        { isExEmployee: { $ne: true } } // Field is not true (covers undefined, etc.)
      ]
    };

    // If specifically requested for offboarding, apply additional filters
    if (forOffboarding === 'true') {
      try {
        const Offboarding = getTenantModel(tenantConnection, 'Offboarding', require('../models/Offboarding'));
        
        // Get all employees who are currently in offboarding process
        const activeOffboardings = await Offboarding.find({
          status: { $in: ['in-progress', 'initiated'] }
        }).select('employee').lean();

        const offboardingEmployeeIds = activeOffboardings.map(o => o.employee.toString());
        
        // Add filter to exclude employees already in offboarding
        if (offboardingEmployeeIds.length > 0) {
          query._id = { $nin: offboardingEmployeeIds };
        }
      } catch (offboardingError) {
        console.warn('Could not filter by offboarding status:', offboardingError.message);
      }
    }

    // Filter by department if specified
    if (department) query.department = department;

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } }
      ];
    }


    const employees = await TenantEmployee.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Additional safety filter: explicitly filter out any ex-employees that might have slipped through
    const filteredEmployees = employees.filter(emp => {
      return emp.isActive !== false && (emp.isExEmployee !== true);
    });

    
    // Also verify specific employees that should be excluded
    const shouldBeExcluded = await TenantEmployee.find({ employeeCode: { $in: ['EMP0004', 'EMP0005', 'EMP0003', 'EMP0002'] } }).lean();

    // Populate department information manually since department is stored as string
    const populatedEmployees = await Promise.all(
      filteredEmployees.map(async (employee) => {
        // Try to get department from departmentId first, then from department field
        const deptId = employee.departmentId || employee.department;
        if (deptId) {
          try {
            const department = await TenantDepartment.findById(deptId);
            employee.department = department ? { _id: department._id, name: department.name } : null;
          } catch (error) {
            console.warn(`Failed to populate department for employee ${employee._id}:`, error.message);
            employee.department = null;
          }
        } else {
          employee.department = null;
        }
        return employee;
      })
    );

    console.log(`📋 Found ${employees.length} employees for company ${req.tenant.companyId}`);

    res.status(200).json({
      success: true,
      count: employees.length,
      data: populatedEmployees
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
exports.getEmployee = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
    const TenantDepartment = getTenantModel(tenantConnection, 'Department', Department.schema);

    const employee = await TenantEmployee.findById(req.params.id).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Populate department information manually since department is stored as string
    // Try to get department from departmentId first, then from department field
    const deptId = employee.departmentId || employee.department;
    if (deptId) {
      try {
        const department = await TenantDepartment.findById(deptId);
        employee.department = department ? { _id: department._id, name: department.name } : null;
      } catch (error) {
        console.warn(`Failed to populate department for employee ${employee._id}:`, error.message);
        employee.department = null;
      }
    } else {
      employee.department = null;
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (Admin, HR)
exports.createEmployee = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);
    const { logEmployeeCreated } = require('../services/hrActivityLogService');

    // Generate employee code
    const employeeCount = await TenantEmployee.countDocuments();
    const employeeCode = `EMP${String(employeeCount + 1).padStart(4, '0')}`;

    // Prepare employee data
    const employeeData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      employeeCode,
      joiningDate: req.body.joiningDate || new Date(),
      designation: req.body.designation,
      department: req.body.department, // Store department ID as string
      departmentId: req.body.department, // Also store as ObjectId reference
      reportingManager: req.body.reportingManager,
      salary: req.body.salary || {
        basic: 0,
        hra: 0,
        allowances: 0,
        total: 0
      },
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      isFirstLogin: true,
      mustChangePassword: true,
      createdBy: req.user._id
    };

    const employee = await TenantEmployee.create(employeeData);

    console.log(`✅ Created employee: ${employee.firstName} ${employee.lastName} (${employeeCode})`);

    // Log HR activity
    await logEmployeeCreated(tenantConnection, employee, req);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin, HR)
exports.updateEmployee = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);

    console.log('📝 Updating employee:', req.params.id);
    console.log('📝 Update data received:', req.body);

    // Get the current employee data before update for logging
    const previousEmployee = await TenantEmployee.findById(req.params.id).lean();

    // Clean up data before update to handle ObjectId fields properly
    const updateData = { ...req.body };
    
    // Handle department field
    if (req.body.department !== undefined) {
      if (req.body.department && req.body.department.trim() !== '') {
        updateData.department = req.body.department;
        updateData.departmentId = req.body.department;
      } else {
        updateData.department = null;
        updateData.departmentId = null;
      }
      console.log('📝 Department update:', { department: updateData.department, departmentId: updateData.departmentId });
    }
    
    // Handle reportingManager field - convert empty string to null for ObjectId fields
    if (req.body.reportingManager !== undefined) {
      if (req.body.reportingManager && req.body.reportingManager.trim() !== '') {
        updateData.reportingManager = req.body.reportingManager;
      } else {
        updateData.reportingManager = null;
      }
    }
    
    // Handle any other ObjectId fields that might be empty strings
    const objectIdFields = ['reportingManager', 'department', 'departmentId'];
    objectIdFields.forEach(field => {
      if (updateData[field] === '' || updateData[field] === 'null' || updateData[field] === 'undefined') {
        updateData[field] = null;
      }
    });

    const employee = await TenantEmployee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Populate department information for response
    const TenantDepartment = getTenantModel(tenantConnection, 'Department', Department.schema);
    if (employee.departmentId) {
      try {
        const department = await TenantDepartment.findById(employee.departmentId);
        employee.department = department ? { _id: department._id, name: department.name } : null;
      } catch (error) {
        console.warn(`Failed to populate department for employee ${employee._id}:`, error.message);
        employee.department = null;
      }
    } else {
      employee.department = null;
    }

    console.log('✅ Employee updated successfully:', employee._id);
    console.log('✅ Updated department:', employee.department);

    // Log HR activity
    try {
      const { logEmployeeUpdated } = require('../services/hrActivityLogService');
      await logEmployeeUpdated(tenantConnection, employee, previousEmployee, req);
      console.log(`📝 HR activity logged for employee update: ${employee.firstName} ${employee.lastName}`);
    } catch (logError) {
      console.error('⚠️ Failed to log HR activity for employee update:', logError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    console.error('❌ Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reset employee password
// @route   PUT /api/employees/:id/reset-password
// @access  Private (Admin, HR)
exports.resetEmployeePassword = async (req, res) => {
  try {
    console.log('🔄 Reset password request for employee ID:', req.params.id);
    
    // Check if tenant connection exists
    if (!req.tenant || !req.tenant.connection) {
      console.error('❌ No tenant connection found');
      return res.status(400).json({
        success: false,
        message: 'Tenant connection not found'
      });
    }

    const tenantConnection = req.tenant.connection;
    const TenantUser = getTenantModel(tenantConnection, 'User', TenantUserSchema);
    
    console.log('✅ Tenant connection established');
    
    // Must select password field explicitly since it has select: false
    const employee = await TenantUser.findById(req.params.id).select('+password');

    if (!employee) {
      console.error('❌ Employee not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    console.log('✅ Employee found:', employee.email);

    // Generate new temporary password
    const crypto = require('crypto');
    const newTempPassword = crypto.randomBytes(8).toString('hex');
    
    console.log('🔑 Generated new temporary password');
    
    // Update password and force change on next login
    employee.password = newTempPassword; // Will be hashed by pre-save hook
    employee.mustChangePassword = true;
    employee.isFirstLogin = true;
    
    console.log('💾 Saving employee with new password...');
    await employee.save();
    console.log('✅ Password reset successful');

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        employeeId: employee._id,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`,
        tempPassword: newTempPassword
      },
      note: 'Please share this temporary password with the employee. They must change it on first login.'
    });
  } catch (error) {
    console.error('❌ Error resetting employee password:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: `Failed to reset password: ${error.message}`
    });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private (Admin)
exports.deleteEmployee = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const TenantEmployee = getTenantModel(tenantConnection, 'Employee', TenantEmployeeSchema);

    const employee = await TenantEmployee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Log HR activity
    try {
      const { logEmployeeDeleted } = require('../services/hrActivityLogService');
      await logEmployeeDeleted(tenantConnection, employee, req);
      console.log(`📝 HR activity logged for employee deletion: ${employee.firstName} ${employee.lastName}`);
    } catch (logError) {
      console.error('⚠️ Failed to log HR activity for employee deletion:', logError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get employee statistics
// @route   GET /api/employees/stats
// @access  Private (Admin, HR)
exports.getEmployeeStats = async (req, res) => {
  try {
    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    // Exclude ex-employees from all stats
    const excludeExEmployees = { isExEmployee: { $ne: true } };
    const total = await Employee.countDocuments(excludeExEmployees);
    const active = await Employee.countDocuments({ status: 'active', ...excludeExEmployees });
    const inactive = await Employee.countDocuments({ status: 'inactive', ...excludeExEmployees });
    const onLeave = await Employee.countDocuments({ status: 'on-leave', ...excludeExEmployees });

    const byDepartment = await Employee.aggregate([
      { $match: { status: 'active', isExEmployee: { $ne: true } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $project: { department: '$dept.name', count: 1, _id: 0 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        active,
        inactive,
        onLeave,
        byDepartment
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
