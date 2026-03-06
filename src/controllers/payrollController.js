const { getTenantModel } = require('../utils/tenantModels');

exports.getPayrolls = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const Employee = getTenantModel(req.tenant.connection, 'Employee');

    const { employee, month, year, status } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.paymentStatus = status;

    // If user is employee, only show their payroll
    if (req.user.role === 'employee') {
      const tenantEmployee = await Employee.findOne({ email: req.user.email }).select('_id');
      if (tenantEmployee) {
        query.employee = tenantEmployee._id;
      }
    }

    const payrolls = await Payroll.find(query)
      .populate({
        path: 'employee',
        model: Employee,
        select: 'firstName lastName email employeeCode designation'
      })
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);

    const payroll = await Payroll.findById(req.params.id).lean();
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    // Populate employee
    if (payroll.employee) {
      const emp = await TenantUser.findById(payroll.employee).select('firstName lastName email employeeCode designation departmentId').lean();
      if (emp) payroll.employee = emp;
    }

    res.status(200).json({ success: true, data: payroll });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const { employee, month, year, basicSalary, allowances, deductions, bonus, overtime } = req.body;

    // Check if payroll already exists
    const existingPayroll = await Payroll.findOne({ employee, month, year });
    if (existingPayroll) {
      return res.status(400).json({ success: false, message: 'Payroll already exists for this month' });
    }

    // Calculate totals
    const totalAllowances = Object.values(allowances || {}).reduce((sum, val) => sum + (val || 0), 0);
    const totalDeductions = Object.values(deductions || {}).reduce((sum, val) => sum + (val || 0), 0);
    const totalEarnings = basicSalary + totalAllowances + (bonus || 0) + (overtime?.amount || 0);
    const netSalary = totalEarnings - totalDeductions;

    const payroll = await Payroll.create({
      employee,
      month,
      year,
      basicSalary,
      allowances,
      deductions,
      bonus,
      overtime,
      totalEarnings,
      totalDeductions,
      netSalary,
      paymentStatus: 'pending'
    });

    res.status(201).json({ success: true, message: 'Payroll created successfully', data: payroll });
  } catch (error) {
    console.error('Error creating payroll:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const { basicSalary, allowances, deductions, bonus, overtime } = req.body;

    // Recalculate totals if provided
    if (basicSalary || allowances || deductions || bonus || overtime) {
      const payroll = await Payroll.findById(req.params.id);
      if (!payroll) {
        return res.status(404).json({ success: false, message: 'Payroll not found' });
      }

      const updatedBasic = basicSalary || payroll.basicSalary;
      const updatedAllowances = allowances || payroll.allowances;
      const updatedDeductions = deductions || payroll.deductions;
      const updatedBonus = bonus !== undefined ? bonus : payroll.bonus;
      const updatedOvertime = overtime || payroll.overtime;

      const totalAllowances = Object.values(updatedAllowances || {}).reduce((sum, val) => sum + (val || 0), 0);
      const totalDeductions = Object.values(updatedDeductions || {}).reduce((sum, val) => sum + (val || 0), 0);
      const totalEarnings = updatedBasic + totalAllowances + updatedBonus + (updatedOvertime?.amount || 0);
      const netSalary = totalEarnings - totalDeductions;

      req.body.totalEarnings = totalEarnings;
      req.body.totalDeductions = totalDeductions;
      req.body.netSalary = netSalary;
    }

    const payroll = await Payroll.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    res.status(200).json({ success: true, message: 'Payroll updated successfully', data: payroll });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const { transactionId, paymentMethod } = req.body;
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    payroll.paymentStatus = 'paid';
    payroll.paymentDate = new Date();
    payroll.transactionId = transactionId;
    payroll.paymentMethod = paymentMethod || 'bank-transfer';
    await payroll.save();

    res.status(200).json({ success: true, message: 'Payment processed successfully', data: payroll });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }
    res.status(200).json({ success: true, message: 'Payroll deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk generate payroll for all employees
exports.bulkGeneratePayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const TenantUserSchema = require('../models/tenant/TenantUser');
    const TenantUser = req.tenant.connection.model('User', TenantUserSchema);
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year are required' });
    }

    // Get all active employees
    const employees = await TenantUser.find({ 
      role: 'employee',
      isActive: true 
    }).select('_id firstName lastName email employeeCode designation basicSalary').lean();

    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    for (const employee of employees) {
      try {
        // Check if payroll already exists
        const existing = await Payroll.findOne({ employee: employee._id, month, year });
        if (existing) {
          results.skipped.push({ employee: employee.email, reason: 'Already exists' });
          continue;
        }

        // Create payroll with basic salary
        const basicSalary = employee.basicSalary || 0;
        const allowances = {};
        const deductions = {};
        const totalAllowances = 0;
        const totalDeductions = 0;
        const totalEarnings = basicSalary + totalAllowances;
        const netSalary = totalEarnings - totalDeductions;

        const payroll = await Payroll.create({
          employee: employee._id,
          month,
          year,
          basicSalary,
          allowances,
          deductions,
          totalEarnings,
          totalDeductions,
          netSalary,
          paymentStatus: 'pending'
        });

        results.created.push({ employee: employee.email, payrollId: payroll._id });
      } catch (error) {
        results.errors.push({ employee: employee.email, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Payroll generation completed. Created: ${results.created.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
      data: results
    });
  } catch (error) {
    console.error('Error bulk generating payroll:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
