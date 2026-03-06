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
    
    // Ensure required fields are present
    const { email, firstName, lastName, role, password, ...otherFields } = req.body;
    
    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, firstName, lastName, and role are required'
      });
    }
    
    // Set default role to 'employee' if not provided or invalid
    const validRoles = ['company_admin', 'hr', 'manager', 'employee'];
    const userRole = validRoles.includes(role) ? role : 'employee';
    
    // Generate default password if not provided
    const generatePassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };
    
    const userPassword = password || generatePassword();
    
    // Create user with all required fields
    const userData = {
      email,
      firstName,
      lastName,
      role: userRole,
      password: userPassword,
      authProvider: 'local',
      ...otherFields
    };
    
    const employee = await TenantUser.create(userData);

    // Send welcome email with credentials
    let emailSent = false;
    try {
      const { sendOnboardingEmail } = require('../services/emailService');
      await sendOnboardingEmail({
        employeeName: `${firstName} ${lastName}`,
        employeeEmail: email,
        employeeId: employee._id,
        tempPassword: userPassword,
        companyName: req.user.companyName || 'Our Company'
      });
      console.log(`📧 Welcome email sent to employee: ${email}`);
      emailSent = true;
    } catch (emailError) {
      console.error('❌ Error sending welcome email to employee:', emailError);
      // Don't fail the employee creation if email fails
    }

    // Log the generated password for admin to share with employee
    if (!password) {
      console.log(`🔑 Generated password for ${email}: ${userPassword}`);
    }

    // Remove password from response
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employeeResponse,
      generatedPassword: !password ? userPassword : undefined,
      emailSent: emailSent
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
