const Compliance = require('../models/Compliance');

exports.getCompliances = async (req, res) => {
  try {
    const { employee, client, status, complianceType } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (client) query.client = client;
    if (status) query.status = status;
    if (complianceType) query.complianceType = complianceType;

    const compliances = await Compliance.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .populate('client', 'name clientCode')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ dueDate: 1 });

    res.status(200).json({ success: true, count: compliances.length, data: compliances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCompliance = async (req, res) => {
  try {
    const compliance = await Compliance.findById(req.params.id)
      .populate('employee')
      .populate('client')
      .populate('verifiedBy');

    if (!compliance) {
      return res.status(404).json({ success: false, message: 'Compliance not found' });
    }

    res.status(200).json({ success: true, data: compliance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCompliance = async (req, res) => {
  try {
    const compliance = await Compliance.create(req.body);
    res.status(201).json({ success: true, message: 'Compliance created successfully', data: compliance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCompliance = async (req, res) => {
  try {
    const compliance = await Compliance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!compliance) {
      return res.status(404).json({ success: false, message: 'Compliance not found' });
    }
    res.status(200).json({ success: true, message: 'Compliance updated successfully', data: compliance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeCompliance = async (req, res) => {
  try {
    const compliance = await Compliance.findById(req.params.id);
    
    if (!compliance) {
      return res.status(404).json({ success: false, message: 'Compliance not found' });
    }

    compliance.status = 'completed';
    compliance.completedDate = Date.now();
    compliance.verifiedBy = req.user.employeeId;
    compliance.verifiedAt = Date.now();
    await compliance.save();

    res.status(200).json({ success: true, message: 'Compliance marked as completed', data: compliance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDueCompliances = async (req, res) => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 15);

    const compliances = await Compliance.find({
      dueDate: { $gte: today, $lte: futureDate },
      status: { $in: ['pending', 'in-progress'] }
    })
      .populate('employee', 'firstName lastName email employeeCode')
      .populate('client', 'name')
      .sort({ dueDate: 1 });

    res.status(200).json({ success: true, count: compliances.length, data: compliances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCompliance = async (req, res) => {
  try {
    const compliance = await Compliance.findByIdAndDelete(req.params.id);
    if (!compliance) {
      return res.status(404).json({ success: false, message: 'Compliance not found' });
    }
    res.status(200).json({ success: true, message: 'Compliance deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
