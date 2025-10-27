const Onboarding = require('../models/Onboarding');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const Department = require('../models/Department');
const { generatePassword, generateEmployeeId } = require('../utils/passwordGenerator');
const { sendOnboardingEmail, sendHRNotification } = require('../services/emailService');

exports.getOnboardingList = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) query.status = status;

    const onboardingList = await Onboarding.find(query)
      .populate('employee', 'firstName lastName email')
      .populate('department', 'name')
      .populate('tasks.assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: onboardingList.length, data: onboardingList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOnboarding = async (req, res) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id)
      .populate('employee')
      .populate('department')
      .populate('tasks.assignedTo');

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    res.status(200).json({ success: true, data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOnboarding = async (req, res) => {
  try {
    const { candidateName, candidateEmail, position, department } = req.body;

    const onboarding = await Onboarding.create({
      candidateName,
      candidateEmail,
      candidatePhone: req.body.candidatePhone,
      position,
      department,
      stages: ['interview1', 'hrDiscussion', 'documentation', 'success'],
      currentStage: 'interview1',
      status: 'in-progress'
    });

    res.status(201).json({ success: true, message: 'Onboarding process initiated', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOnboarding = async (req, res) => {
  try {
    const onboarding = await Onboarding.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Onboarding updated successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.advanceStage = async (req, res) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    const currentIndex = onboarding.stages.indexOf(onboarding.currentStage);
    if (currentIndex < onboarding.stages.length - 1) {
      onboarding.currentStage = onboarding.stages[currentIndex + 1];
      
      // If reached success stage, mark as completed
      if (onboarding.currentStage === 'success') {
        onboarding.status = 'completed';
        onboarding.completedAt = Date.now();
      }
      
      await onboarding.save();
      res.status(200).json({ success: true, message: 'Stage advanced successfully', data: onboarding });
    } else {
      res.status(400).json({ success: false, message: 'Already at final stage' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setJoiningDate = async (req, res) => {
  try {
    const { joiningDate } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    onboarding.joiningDate = joiningDate;
    await onboarding.save();

    res.status(200).json({ success: true, message: 'Joining date set successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    onboarding.tasks.push({
      title,
      description,
      assignedTo,
      dueDate,
      status: 'pending'
    });

    await onboarding.save();

    res.status(200).json({ success: true, message: 'Task added successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const onboarding = await Onboarding.findById(req.params.id);

    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }

    const task = onboarding.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    await onboarding.save();

    res.status(200).json({ success: true, message: 'Task completed successfully', data: onboarding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteOnboarding = async (req, res) => {
  try {
    const onboarding = await Onboarding.findByIdAndDelete(req.params.id);
    if (!onboarding) {
      return res.status(404).json({ success: false, message: 'Onboarding record not found' });
    }
    res.status(200).json({ success: true, message: 'Onboarding deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Complete onboarding process and create employee account
 * @route POST /api/onboarding/:id/complete
 * @access Private (HR/Admin only)
 * 
 * This function:
 * 1. Validates onboarding completion
 * 2. Creates employee record in database
 * 3. Generates secure credentials
 * 4. Creates user account with temporary password
 * 5. Sends welcome email with credentials
 * 6. Notifies HR team
 */
exports.completeOnboardingProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName } = req.body;

    // Find onboarding record with all related data
    const onboarding = await Onboarding.findById(id)
      .populate('department')
      .populate('candidate');

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }

    // Validate onboarding is at success stage
    if (onboarding.currentStage !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Onboarding must be at success stage before completing. Current stage: ' + onboarding.currentStage
      });
    }

    // Check if already completed
    if (onboarding.onboardingComplete && onboarding.employeeAccountCreated) {
      return res.status(400).json({
        success: false,
        message: 'Employee account has already been created for this onboarding',
        data: {
          employeeId: onboarding.employee,
          credentialsSent: onboarding.credentialsSent
        }
      });
    }

    // Validate required fields
    if (!onboarding.candidateEmail || !onboarding.candidateName) {
      return res.status(400).json({
        success: false,
        message: 'Candidate email and name are required'
      });
    }

    if (!onboarding.department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required to create employee account'
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: onboarding.candidateEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account already exists with this email address'
      });
    }

    // Check if employee already exists with this email
    const existingEmployee = await Employee.findOne({ email: onboarding.candidateEmail });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'An employee record already exists with this email address'
      });
    }

    // Split candidate name into first and last name
    const nameParts = onboarding.candidateName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Get employee count for ID generation
    const employeeCount = await Employee.countDocuments();
    const employeeCode = generateEmployeeId(employeeCount);

    // Generate secure random password
    const tempPassword = generatePassword(12, {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true
    });

    // Create employee record
    const employee = await Employee.create({
      employeeCode,
      firstName,
      lastName,
      email: onboarding.candidateEmail,
      phone: onboarding.candidatePhone || 'N/A',
      department: onboarding.department._id,
      designation: onboarding.position,
      joiningDate: onboarding.joiningDate || new Date(),
      employmentType: 'full-time',
      status: 'active'
    });

    console.log(`✅ Employee created: ${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`);

    // Create user account with temporary password
    const user = await User.create({
      email: onboarding.candidateEmail,
      password: tempPassword, // Will be hashed by pre-save hook
      role: 'employee',
      employeeId: employee._id,
      isActive: true,
      isFirstLogin: true,
      mustChangePassword: true
    });

    console.log(`✅ User account created for: ${user.email}`);

    // Send onboarding email with credentials
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendOnboardingEmail({
        employeeName: `${firstName} ${lastName}`,
        employeeEmail: onboarding.candidateEmail,
        employeeId: employeeCode,
        tempPassword: tempPassword,
        companyName: companyName || 'Our Company'
      });

      emailSent = emailResult.success;
      console.log(`✅ Onboarding email sent to: ${onboarding.candidateEmail}`);

      // Send HR notification (non-blocking)
      sendHRNotification({
        employeeName: `${firstName} ${lastName}`,
        employeeId: employeeCode,
        department: onboarding.department.name,
        designation: onboarding.position
      }).catch(err => {
        console.error('HR notification failed:', err.message);
      });

    } catch (error) {
      console.error('❌ Failed to send onboarding email:', error.message);
      emailError = error.message;
      // Don't fail the entire process if email fails
    }

    // Update onboarding record
    onboarding.employee = employee._id;
    onboarding.onboardingComplete = true;
    onboarding.employeeAccountCreated = true;
    onboarding.credentialsSent = emailSent;
    onboarding.credentialsSentAt = emailSent ? new Date() : null;
    onboarding.status = 'completed';
    onboarding.completedAt = new Date();

    await onboarding.save();

    // Update candidate status if linked
    if (onboarding.candidate) {
      try {
        await Candidate.findByIdAndUpdate(onboarding.candidate, {
          status: 'hired',
          stage: 'joined'
        });
        console.log(`✅ Candidate status updated to 'hired'`);
      } catch (error) {
        console.error('Failed to update candidate status:', error.message);
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Onboarding completed successfully and employee account created',
      data: {
        employee: {
          id: employee._id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          department: onboarding.department.name,
          designation: employee.designation,
          joiningDate: employee.joiningDate
        },
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword
        },
        credentials: {
          sent: emailSent,
          sentAt: onboarding.credentialsSentAt
        }
      }
    };

    // Add warning if email failed
    if (!emailSent && emailError) {
      response.warning = `Employee account created successfully, but failed to send credentials email: ${emailError}`;
      response.data.tempPassword = tempPassword; // Include in response if email failed
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error completing onboarding:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding process',
      error: error.message
    });
  }
};
