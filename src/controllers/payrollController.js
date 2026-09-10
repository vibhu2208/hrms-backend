const { getTenantModel } = require('../utils/tenantModels');
const { asString, asEnum, asInt, pickAllowed } = require('../utils/safeQuery');

const PAYROLL_UPDATE_FIELDS = [
  'basicSalary', 'allowances', 'deductions', 'bonus', 'overtime',
  'totalEarnings', 'totalDeductions', 'netSalary', 'notes'
];

async function resolveCallerEmployeeId(req) {
  const Employee = getTenantModel(req.tenant.connection, 'Employee');
  const emp = await Employee.findOne({ email: req.user.email }).select('_id').lean();
  return emp?._id || null;
}

function isPrivilegedPayrollRole(role) {
  return ['admin', 'hr', 'company_admin'].includes(role);
}

exports.getPayrolls = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const Employee = getTenantModel(req.tenant.connection, 'Employee');

    const employee = asString(req.query.employee, { maxLen: 64 });
    const month = asInt(req.query.month, { min: 1, max: 12 });
    const year = asInt(req.query.year, { min: 2000, max: 2100 });
    const status = asEnum(req.query.status, ['pending', 'paid', 'failed', 'processing']);

    let query = {};
    if (employee) query.employee = employee;
    if (month !== undefined) query.month = month;
    if (year !== undefined) query.year = year;
    if (status) query.paymentStatus = status;

    // Employees: own payroll only. Managers: not full payroll access via this API.
    if (!isPrivilegedPayrollRole(req.user.role)) {
      const tenantEmployee = await resolveCallerEmployeeId(req);
      if (!tenantEmployee) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      query.employee = tenantEmployee;
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
    res.status(500).json({ success: false, message: 'Failed to fetch payrolls' });
  }
};

exports.getPayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const Employee = getTenantModel(req.tenant.connection, 'Employee');

    const payroll = await Payroll.findById(req.params.id).lean();
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    if (!isPrivilegedPayrollRole(req.user.role)) {
      const tenantEmployee = await resolveCallerEmployeeId(req);
      const ownerId = payroll.employee?.toString?.() || String(payroll.employee);
      if (!tenantEmployee || ownerId !== tenantEmployee.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this payroll' });
      }
    }

    if (payroll.employee) {
      const emp = await Employee.findById(payroll.employee)
        .select('firstName lastName email employeeCode designation departmentId')
        .lean();
      if (emp) payroll.employee = emp;
    }

    res.status(200).json({ success: true, data: payroll });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll' });
  }
};

exports.createPayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const { employee, month, year, basicSalary, allowances, deductions, bonus, overtime } = req.body;

    const existingPayroll = await Payroll.findOne({ employee, month, year });
    if (existingPayroll) {
      return res.status(400).json({ success: false, message: 'Payroll already exists for this month' });
    }

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
    res.status(500).json({ success: false, message: 'Failed to create payroll' });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const updates = pickAllowed(req.body, PAYROLL_UPDATE_FIELDS);
    const { basicSalary, allowances, deductions, bonus, overtime } = updates;

    if (basicSalary || allowances || deductions || bonus || overtime) {
      const payroll = await Payroll.findById(req.params.id);
      if (!payroll) {
        return res.status(404).json({ success: false, message: 'Payroll not found' });
      }

      const updatedBasic = basicSalary !== undefined ? basicSalary : payroll.basicSalary;
      const updatedAllowances = allowances || payroll.allowances;
      const updatedDeductions = deductions || payroll.deductions;
      const updatedBonus = bonus !== undefined ? bonus : payroll.bonus;
      const updatedOvertime = overtime || payroll.overtime;

      const totalAllowances = Object.values(updatedAllowances || {}).reduce((sum, val) => sum + (val || 0), 0);
      const totalDeductions = Object.values(updatedDeductions || {}).reduce((sum, val) => sum + (val || 0), 0);
      const totalEarnings = updatedBasic + totalAllowances + updatedBonus + (updatedOvertime?.amount || 0);
      const netSalary = totalEarnings - totalDeductions;

      updates.totalEarnings = totalEarnings;
      updates.totalDeductions = totalDeductions;
      updates.netSalary = netSalary;
    }

    const payroll = await Payroll.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    res.status(200).json({ success: true, message: 'Payroll updated successfully', data: payroll });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({ success: false, message: 'Failed to update payroll' });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const transactionId = asString(req.body.transactionId, { maxLen: 128 });
    const paymentMethod = asString(req.body.paymentMethod, { maxLen: 64 }) || 'bank-transfer';
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    payroll.paymentStatus = 'paid';
    payroll.paymentDate = new Date();
    payroll.transactionId = transactionId;
    payroll.paymentMethod = paymentMethod;
    await payroll.save();

    res.status(200).json({ success: true, message: 'Payment processed successfully', data: payroll });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
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
    res.status(500).json({ success: false, message: 'Failed to delete payroll' });
  }
};

// Bulk generate payroll for all employees
exports.bulkGeneratePayroll = async (req, res) => {
  try {
    const Payroll = getTenantModel(req.tenant.connection, 'Payroll');
    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    const month = asInt(req.body.month, { min: 1, max: 12 });
    const year = asInt(req.body.year, { min: 2000, max: 2100 });

    if (month === undefined || year === undefined) {
      return res.status(400).json({ success: false, message: 'Valid month and year are required' });
    }

    const employees = await Employee.find({ isActive: true }).select('_id salary').lean();
    const created = [];
    const skipped = [];

    for (const emp of employees) {
      const exists = await Payroll.findOne({ employee: emp._id, month, year });
      if (exists) {
        skipped.push(emp._id);
        continue;
      }
      const basicSalary = emp.salary?.basic || 0;
      const payroll = await Payroll.create({
        employee: emp._id,
        month,
        year,
        basicSalary,
        allowances: {},
        deductions: {},
        totalEarnings: basicSalary,
        totalDeductions: 0,
        netSalary: basicSalary,
        paymentStatus: 'pending'
      });
      created.push(payroll._id);
    }

    res.status(201).json({
      success: true,
      message: `Generated ${created.length} payroll records`,
      data: { created: created.length, skipped: skipped.length }
    });
  } catch (error) {
    console.error('Error bulk generating payroll:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk generate payroll' });
  }
};
