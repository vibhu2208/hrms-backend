const Payroll = require('../models/Payroll');

exports.getPayrolls = async (req, res) => {
  try {
    const { employee, month, year, status } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.paymentStatus = status;

    // If user is employee, only show their payroll
    if (req.user.role === 'employee' && req.user.employeeId) {
      query.employee = req.user.employeeId;
    }

    const payrolls = await Payroll.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .sort({ year: -1, month: -1 });

    res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('employee');
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }
    res.status(200).json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPayroll = async (req, res) => {
  try {
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
      netSalary
    });

    res.status(201).json({ success: true, message: 'Payroll created successfully', data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
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

      const totalAllowances = Object.values(updatedAllowances).reduce((sum, val) => sum + (val || 0), 0);
      const totalDeductions = Object.values(updatedDeductions).reduce((sum, val) => sum + (val || 0), 0);
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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { transactionId, paymentMethod } = req.body;
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }

    payroll.paymentStatus = 'paid';
    payroll.paymentDate = Date.now();
    payroll.transactionId = transactionId;
    payroll.paymentMethod = paymentMethod || 'bank-transfer';
    await payroll.save();

    res.status(200).json({ success: true, message: 'Payment processed successfully', data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }
    res.status(200).json({ success: true, message: 'Payroll deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
