const Onboarding = require('../models/Onboarding');

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
