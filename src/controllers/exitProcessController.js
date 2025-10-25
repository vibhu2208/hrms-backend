const ExitProcess = require('../models/ExitProcess');
const Employee = require('../models/Employee');

exports.getExitProcesses = async (req, res) => {
  try {
    const { status, exitType } = req.query;
    let query = {};

    if (status) query.status = status;
    if (exitType) query.exitType = exitType;

    const exitProcesses = await ExitProcess.find(query)
      .populate('employee', 'firstName lastName employeeCode email')
      .populate('initiatedBy', 'firstName lastName')
      .populate('clearanceChecklist.hr.clearedBy', 'firstName lastName')
      .populate('clearanceChecklist.finance.clearedBy', 'firstName lastName')
      .populate('clearanceChecklist.it.clearedBy', 'firstName lastName')
      .populate('clearanceChecklist.admin.clearedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: exitProcesses.length, data: exitProcesses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExitProcess = async (req, res) => {
  try {
    const exitProcess = await ExitProcess.findById(req.params.id)
      .populate('employee')
      .populate('initiatedBy')
      .populate('clearanceChecklist.hr.clearedBy')
      .populate('clearanceChecklist.finance.clearedBy')
      .populate('clearanceChecklist.it.clearedBy')
      .populate('clearanceChecklist.admin.clearedBy')
      .populate('clearanceChecklist.projectManager.clearedBy')
      .populate('exitInterview.conductedBy');

    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }

    res.status(200).json({ success: true, data: exitProcess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.initiateExitProcess = async (req, res) => {
  try {
    const { employee, exitType, lastWorkingDate, reason } = req.body;

    // Check if exit process already exists for employee
    const existing = await ExitProcess.findOne({ 
      employee, 
      status: { $in: ['initiated', 'clearance-pending'] } 
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Exit process already initiated for this employee' 
      });
    }

    const exitProcess = await ExitProcess.create({
      employee,
      initiatedBy: req.user.employeeId,
      exitType,
      lastWorkingDate,
      reason,
      resignationDate: Date.now()
    });

    // Update employee status
    await Employee.findByIdAndUpdate(employee, { status: 'inactive' });

    res.status(201).json({ 
      success: true, 
      message: 'Exit process initiated successfully', 
      data: exitProcess 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClearance = async (req, res) => {
  try {
    const { department, cleared, notes } = req.body;
    const exitProcess = await ExitProcess.findById(req.params.id);

    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }

    if (!exitProcess.clearanceChecklist[department]) {
      return res.status(400).json({ success: false, message: 'Invalid department' });
    }

    exitProcess.clearanceChecklist[department].cleared = cleared;
    exitProcess.clearanceChecklist[department].clearedBy = req.user.employeeId;
    exitProcess.clearanceChecklist[department].clearedAt = Date.now();
    exitProcess.clearanceChecklist[department].notes = notes;

    // Check if all clearances are done
    const allCleared = Object.values(exitProcess.clearanceChecklist).every(dept => dept.cleared);
    if (allCleared && exitProcess.status === 'clearance-pending') {
      exitProcess.status = 'clearance-completed';
    }

    await exitProcess.save();

    res.status(200).json({ success: true, message: 'Clearance updated', data: exitProcess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleExitInterview = async (req, res) => {
  try {
    const { scheduledDate, conductedBy } = req.body;
    const exitProcess = await ExitProcess.findById(req.params.id);

    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }

    exitProcess.exitInterview.scheduled = true;
    exitProcess.exitInterview.scheduledDate = scheduledDate;
    exitProcess.exitInterview.conductedBy = conductedBy;
    await exitProcess.save();

    res.status(200).json({ success: true, message: 'Exit interview scheduled', data: exitProcess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeExitInterview = async (req, res) => {
  try {
    const { feedback, rehireEligible } = req.body;
    const exitProcess = await ExitProcess.findById(req.params.id);

    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }

    exitProcess.exitInterview.conductedAt = Date.now();
    exitProcess.exitInterview.feedback = feedback;
    exitProcess.exitInterview.rehireEligible = rehireEligible;
    await exitProcess.save();

    res.status(200).json({ success: true, message: 'Exit interview completed', data: exitProcess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.processFinalSettlement = async (req, res) => {
  try {
    const { amount, transactionId } = req.body;
    const exitProcess = await ExitProcess.findById(req.params.id);

    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }

    exitProcess.finalSettlement.amount = amount;
    exitProcess.finalSettlement.paymentDate = Date.now();
    exitProcess.finalSettlement.paymentStatus = 'processed';
    exitProcess.finalSettlement.transactionId = transactionId;
    exitProcess.status = 'completed';
    exitProcess.completedAt = Date.now();
    await exitProcess.save();

    res.status(200).json({ success: true, message: 'Final settlement processed', data: exitProcess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteExitProcess = async (req, res) => {
  try {
    const exitProcess = await ExitProcess.findByIdAndDelete(req.params.id);
    if (!exitProcess) {
      return res.status(404).json({ success: false, message: 'Exit process not found' });
    }
    res.status(200).json({ success: true, message: 'Exit process deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
