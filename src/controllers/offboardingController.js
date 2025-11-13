const { getTenantModel } = require('../utils/tenantModels');

exports.getOffboardingList = async (req, res) => {
  try {
    // Get tenant-specific models
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    
    const { status } = req.query;
    let query = {};

    if (status) query.status = status;

    const offboardingList = await Offboarding.find(query)
      .populate('employee', 'firstName lastName email employeeCode')
      .populate('initiatedBy', 'firstName lastName')
      .populate('exitInterview.conductedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: offboardingList.length, data: offboardingList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const offboarding = await Offboarding.findById(req.params.id)
      .populate('employee')
      .populate('initiatedBy')
      .populate('exitInterview.conductedBy')
      .populate('assetsReturned.asset');

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    res.status(200).json({ success: true, data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { employee, lastWorkingDate, resignationType, reason } = req.body;

    const offboarding = await Offboarding.create({
      employee,
      initiatedBy: req.user.employeeId,
      lastWorkingDate,
      resignationType,
      reason,
      stages: ['exitDiscussion', 'assetReturn', 'documentation', 'finalSettlement', 'success'],
      currentStage: 'exitDiscussion',
      status: 'in-progress'
    });

    res.status(201).json({ success: true, message: 'Offboarding process initiated', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const offboarding = await Offboarding.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Offboarding updated successfully', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.advanceStage = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const offboarding = await Offboarding.findById(req.params.id);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    const currentIndex = offboarding.stages.indexOf(offboarding.currentStage);
    if (currentIndex < offboarding.stages.length - 1) {
      offboarding.currentStage = offboarding.stages[currentIndex + 1];
      
      // If reached success stage, mark as completed
      if (offboarding.currentStage === 'success') {
        offboarding.status = 'completed';
        offboarding.completedAt = Date.now();
      }
      
      await offboarding.save();
      res.status(200).json({ success: true, message: 'Stage advanced successfully', data: offboarding });
    } else {
      res.status(400).json({ success: false, message: 'Already at final stage' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleExitInterview = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { scheduledDate, conductedBy } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    offboarding.exitInterview.scheduledDate = scheduledDate;
    offboarding.exitInterview.conductedBy = conductedBy;
    await offboarding.save();

    res.status(200).json({ success: true, message: 'Exit interview scheduled', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeExitInterview = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { feedback } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    offboarding.exitInterview.feedback = feedback;
    offboarding.exitInterview.completed = true;
    await offboarding.save();

    res.status(200).json({ success: true, message: 'Exit interview completed', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordAssetReturn = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { asset, condition } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    offboarding.assetsReturned.push({
      asset,
      returnedDate: Date.now(),
      condition
    });

    await offboarding.save();

    res.status(200).json({ success: true, message: 'Asset return recorded', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClearance = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { department, cleared, notes } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    if (!offboarding.clearance[department]) {
      return res.status(400).json({ success: false, message: 'Invalid department' });
    }

    offboarding.clearance[department].cleared = cleared;
    offboarding.clearance[department].clearedBy = req.user.employeeId;
    offboarding.clearance[department].clearedAt = Date.now();
    offboarding.clearance[department].notes = notes;

    await offboarding.save();

    res.status(200).json({ success: true, message: 'Clearance updated', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.processFinalSettlement = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { amount, paymentStatus } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    offboarding.finalSettlement.amount = amount;
    offboarding.finalSettlement.paymentDate = Date.now();
    offboarding.finalSettlement.paymentStatus = paymentStatus || 'processed';

    await offboarding.save();

    res.status(200).json({ success: true, message: 'Final settlement processed', data: offboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const offboarding = await Offboarding.findByIdAndDelete(req.params.id);
    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Offboarding deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
