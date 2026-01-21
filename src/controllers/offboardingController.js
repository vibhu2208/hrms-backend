const { getTenantModel } = require('../utils/tenantModels');

exports.getOffboardingList = async (req, res) => {
  try {
    // Get tenant-specific models
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const TenantUser = getTenantModel(req.tenant.connection, 'User');
    
    const { 
      status, 
      stage, 
      page = 1, 
      limit = 10, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;
    
    let query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by stage
    if (stage) {
      query.currentStage = stage;
    }

    // Date range filter
    if (startDate || endDate) {
      query.lastWorkingDate = {};
      if (startDate) query.lastWorkingDate.$gte = new Date(startDate);
      if (endDate) query.lastWorkingDate.$lte = new Date(endDate);
    }

    // Search functionality - search by employee name/email
    if (search) {
      // First, find employees matching the search
      const employeeIds = await TenantUser.find({
        role: 'employee',
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeCode: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const employeeIdArray = employeeIds.map(emp => emp._id);
      query.employee = { $in: employeeIdArray };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let offboardingList = await Offboarding.find(query)
      .populate('initiatedBy', 'firstName lastName email')
      .populate('exitInterview.conductedBy', 'firstName lastName email')
      .populate('clearance.hr.clearedBy', 'firstName lastName')
      .populate('clearance.finance.clearedBy', 'firstName lastName')
      .populate('clearance.it.clearedBy', 'firstName lastName')
      .populate('clearance.admin.clearedBy', 'firstName lastName')
      .populate('assetsReturned.asset', 'name serialNumber')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Manually populate employee data using TenantUser
    const Department = getTenantModel(req.tenant.connection, 'Department');
    for (let item of offboardingList) {
      if (item.employee) {
        try {
          const employee = await TenantUser.findById(item.employee)
            .select('firstName lastName email employeeCode designation departmentId')
            .lean();
          
          if (employee) {
            // Populate department if it exists
            if (employee.departmentId && Department) {
              const dept = await Department.findById(employee.departmentId).select('name').lean();
              if (dept) {
                employee.department = dept;
              }
            }
            item.employee = employee;
          }
        } catch (err) {
          console.error('Error populating employee:', err);
          // Keep employee as ObjectId if populate fails
        }
      }
    }

    // Get total count for pagination
    const total = await Offboarding.countDocuments(query);

    // Calculate summary statistics
    const allOffboardings = await Offboarding.find({}).select('status currentStage');
    const summary = {
      total: allOffboardings.length,
      inProgress: allOffboardings.filter(o => o.status === 'in-progress').length,
      completed: allOffboardings.filter(o => o.status === 'completed').length,
      cancelled: allOffboardings.filter(o => o.status === 'cancelled').length,
      byStage: {}
    };

    // Count by stage
    allOffboardings.forEach(off => {
      if (off.currentStage) {
        summary.byStage[off.currentStage] = (summary.byStage[off.currentStage] || 0) + 1;
      }
    });

    res.status(200).json({ 
      success: true, 
      count: offboardingList.length,
      data: offboardingList,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching offboarding list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const TenantUser = getTenantModel(req.tenant.connection, 'User');
    const Department = getTenantModel(req.tenant.connection, 'Department');
    
    let offboarding = await Offboarding.findById(req.params.id)
      .populate('initiatedBy', 'firstName lastName email')
      .populate('exitInterview.conductedBy', 'firstName lastName email')
      .populate('clearance.hr.clearedBy', 'firstName lastName email')
      .populate('clearance.finance.clearedBy', 'firstName lastName email')
      .populate('clearance.it.clearedBy', 'firstName lastName email')
      .populate('clearance.admin.clearedBy', 'firstName lastName email')
      .populate('assetsReturned.asset', 'name serialNumber category condition status')
      .lean();

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    // Manually populate employee data using TenantUser
    if (offboarding.employee) {
      try {
        const employee = await TenantUser.findById(offboarding.employee)
          .select('firstName lastName email employeeCode designation departmentId joiningDate dateOfJoining phone address')
          .lean();
        
        if (employee) {
          // Populate department
          if (employee.departmentId && Department) {
            const dept = await Department.findById(employee.departmentId).select('name').lean();
            if (dept) {
              employee.department = dept;
            }
          }
          
          // Populate reporting manager
          if (employee.reportingManager) {
            const manager = await TenantUser.findOne({ email: employee.reportingManager })
              .select('firstName lastName email')
              .lean();
            if (manager) {
              employee.reportingManager = manager;
            }
          }
          
          offboarding.employee = employee;
        }
      } catch (err) {
        console.error('Error populating employee:', err);
      }
    }

    // Calculate clearance summary
    const clearanceSummary = {
      hr: {
        cleared: offboarding.clearance?.hr?.cleared || false,
        clearedAt: offboarding.clearance?.hr?.clearedAt,
        clearedBy: offboarding.clearance?.hr?.clearedBy,
        notes: offboarding.clearance?.hr?.notes
      },
      finance: {
        cleared: offboarding.clearance?.finance?.cleared || false,
        clearedAt: offboarding.clearance?.finance?.clearedAt,
        clearedBy: offboarding.clearance?.finance?.clearedBy,
        notes: offboarding.clearance?.finance?.notes
      },
      it: {
        cleared: offboarding.clearance?.it?.cleared || false,
        clearedAt: offboarding.clearance?.it?.clearedAt,
        clearedBy: offboarding.clearance?.it?.clearedBy,
        notes: offboarding.clearance?.it?.notes
      },
      admin: {
        cleared: offboarding.clearance?.admin?.cleared || false,
        clearedAt: offboarding.clearance?.admin?.clearedAt,
        clearedBy: offboarding.clearance?.admin?.clearedBy,
        notes: offboarding.clearance?.admin?.notes
      }
    };

    // Count cleared departments
    const clearedCount = Object.values(clearanceSummary).filter(dept => dept.cleared).length;
    const totalDepartments = Object.keys(clearanceSummary).length;

    res.status(200).json({ 
      success: true, 
      data: {
        ...offboarding,
        clearanceSummary,
        clearanceProgress: {
          cleared: clearedCount,
          total: totalDepartments,
          percentage: Math.round((clearedCount / totalDepartments) * 100)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching offboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    // Map frontend field names to backend field names
    const { employee, employeeId, lastWorkingDate, lastWorkingDay, resignationType, reason } = req.body;

    // Support both field names (employee/employeeId, lastWorkingDate/lastWorkingDay)
    const employeeIdValue = employee || employeeId;
    const lastWorkingDateValue = lastWorkingDate || lastWorkingDay;
    
    // Map reason to resignationType if resignationType is not provided
    let resignationTypeValue = resignationType;
    if (!resignationTypeValue && reason) {
      // Map reason enum values to resignationType enum values
      const reasonMap = {
        'voluntary_resignation': 'voluntary',
        'involuntary_termination': 'involuntary',
        'retirement': 'retirement',
        'contract_end': 'contract-end',
        'layoff': 'involuntary',
        'performance_issues': 'involuntary',
        'misconduct': 'involuntary',
        'mutual_agreement': 'voluntary',
        'other': 'voluntary'
      };
      resignationTypeValue = reasonMap[reason] || 'voluntary';
    }

    // Validate required fields
    if (!employeeIdValue) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    if (!lastWorkingDateValue) {
      return res.status(400).json({
        success: false,
        message: 'Last working date is required'
      });
    }

    if (!resignationTypeValue) {
      return res.status(400).json({
        success: false,
        message: 'Resignation type is required'
      });
    }

    // Validate last working date (should be in the future)
    const lastWorkingDateObj = new Date(lastWorkingDateValue);
    if (isNaN(lastWorkingDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid last working date format'
      });
    }

    // Initialize clearance status properly
    const clearanceStatus = {
      hr: { cleared: false },
      finance: { cleared: false },
      it: { cleared: false },
      admin: { cleared: false }
    };

    const offboarding = await Offboarding.create({
      employee: employeeIdValue,
      initiatedBy: req.user._id || req.user.id,
      lastWorkingDate: lastWorkingDateObj,
      resignationType: resignationTypeValue,
      reason: reason,
      stages: ['exitDiscussion', 'assetReturn', 'documentation', 'finalSettlement', 'success'],
      currentStage: 'exitDiscussion',
      status: 'in-progress',
      clearance: clearanceStatus,
      exitInterview: {
        completed: false
      },
      finalSettlement: {
        paymentStatus: 'pending'
      }
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

exports.cancelOffboarding = async (req, res) => {
  try {
    const Offboarding = getTenantModel(req.tenant.connection, 'Offboarding');
    const { reason } = req.body;
    const offboarding = await Offboarding.findById(req.params.id);

    if (!offboarding) {
      return res.status(404).json({ success: false, message: 'Offboarding record not found' });
    }

    if (offboarding.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel a completed offboarding process' 
      });
    }

    offboarding.status = 'cancelled';
    if (reason) {
      offboarding.notes = (offboarding.notes || '') + `\n[Cancelled] ${reason}`;
    }
    offboarding.completedAt = new Date();

    await offboarding.save();

    res.status(200).json({ success: true, message: 'Offboarding cancelled successfully', data: offboarding });
  } catch (error) {
    console.error('Error cancelling offboarding:', error);
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
    console.error('Error deleting offboarding:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
