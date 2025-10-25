const Asset = require('../models/Asset');

exports.getAssets = async (req, res) => {
  try {
    const { status, category, assignedTo } = req.query;
    let query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;

    const assets = await Asset.find(query)
      .populate('assignedTo', 'firstName lastName email employeeCode')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('assignedTo')
      .populate('history.employee', 'firstName lastName');

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.status(200).json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const asset = await Asset.create(req.body);
    res.status(201).json({ success: true, message: 'Asset created successfully', data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.status(200).json({ success: true, message: 'Asset updated successfully', data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignAsset = async (req, res) => {
  try {
    const { employeeId, notes } = req.body;
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    if (asset.status === 'assigned') {
      return res.status(400).json({ success: false, message: 'Asset is already assigned' });
    }

    asset.status = 'assigned';
    asset.assignedTo = employeeId;
    asset.assignedDate = Date.now();
    asset.history.push({
      action: 'assigned',
      employee: employeeId,
      date: Date.now(),
      notes
    });

    await asset.save();

    res.status(200).json({ success: true, message: 'Asset assigned successfully', data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.returnAsset = async (req, res) => {
  try {
    const { notes } = req.body;
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    if (asset.status !== 'assigned') {
      return res.status(400).json({ success: false, message: 'Asset is not assigned' });
    }

    const previousEmployee = asset.assignedTo;

    asset.status = 'available';
    asset.returnDate = Date.now();
    asset.history.push({
      action: 'returned',
      employee: previousEmployee,
      date: Date.now(),
      notes
    });
    asset.assignedTo = null;
    asset.assignedDate = null;

    await asset.save();

    res.status(200).json({ success: true, message: 'Asset returned successfully', data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.status(200).json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
