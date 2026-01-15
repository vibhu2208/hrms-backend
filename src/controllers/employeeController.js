const TenantUserSchema = require('../models/tenant/TenantUser');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
exports.getEmployees = async (req, res) => {
  try {
    // Get tenant connection from middleware
    const tenantConnection = req.tenant.connection;
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const { status, department, search, role } = req.query;
    let query = { isActive: true };

    // Filter by role (default: employees and managers)
    if (role) {
      query.role = role;
    } else {
      query.role = { $in: ['employee', 'manager'] };
    }

    if (department) query.department = department;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await TenantUser.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    console.log(`📋 Found ${employees.length} employees for company ${req.tenant.companyId}`);

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
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
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const employee = await TenantUser.findById(req.params.id)
      .select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
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
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    // Generate employee code
    const employeeCount = await TenantUser.countDocuments({ role: { $in: ['employee', 'manager'] } });
    const employeeCode = `EMP${String(employeeCount + 1).padStart(5, '0')}`;
    
    // Generate temporary password
    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(8).toString('hex');
    
    // Prepare employee data with required fields
    const employeeData = {
      ...req.body,
      employeeCode,
      role: req.body.role || 'employee', // Default to 'employee' if not provided
      password: tempPassword, // Will be hashed by pre-save hook
      authProvider: 'local',
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true
    };
    
    const employee = await TenantUser.create(employeeData);
    
    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        ...employeeResponse,
        tempPassword: tempPassword // Send temp password in response for HR to share
      },
      note: 'Please share the temporary password with the employee. They must change it on first login.'
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
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const employee = await TenantUser.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
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
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
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
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    const employee = await TenantUser.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
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
    const total = await Employee.countDocuments();
    const active = await Employee.countDocuments({ status: 'active' });
    const inactive = await Employee.countDocuments({ status: 'inactive' });
    const onLeave = await Employee.countDocuments({ status: 'on-leave' });

    const byDepartment = await Employee.aggregate([
      { $match: { status: 'active' } },
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
