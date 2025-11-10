const Package = require('../models/Package');
const Client = require('../models/Client');
const { logAction } = require('../middlewares/auditLog');

// Get all packages
const getPackages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const packages = await Package.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Package.countDocuments(query);

    // Get usage count for each package
    const packagesWithUsage = await Promise.all(
      packages.map(async (pkg) => {
        const usageCount = await Client.countDocuments({
          'subscription.packageId': pkg._id
        });
        return {
          ...pkg.toObject(),
          usageCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        packages: packagesWithUsage,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching packages',
      error: error.message
    });
  }
};

// Get single package
const getPackage = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Get clients using this package
    const clients = await Client.find({
      'subscription.packageId': package._id
    }).select('name companyName subscription.status');

    res.json({
      success: true,
      data: {
        package,
        clients
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching package',
      error: error.message
    });
  }
};

// Create new package
const createPackage = async (req, res) => {
  try {
    const package = new Package(req.body);
    await package.save();

    // Log action
    await logAction(
      req.user._id,
      null,
      'create',
      'package',
      package._id,
      { packageName: package.name, type: package.type },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating package',
      error: error.message
    });
  }
};

// Update package
const updatePackage = async (req, res) => {
  try {
    const package = await Package.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Log action
    await logAction(
      req.user._id,
      null,
      'update',
      'package',
      package._id,
      { packageName: package.name, updatedFields: Object.keys(req.body) },
      req
    );

    res.json({
      success: true,
      message: 'Package updated successfully',
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating package',
      error: error.message
    });
  }
};

// Delete package
const deletePackage = async (req, res) => {
  try {
    // Check if package is being used by any clients
    const clientsUsingPackage = await Client.countDocuments({
      'subscription.packageId': req.params.id
    });

    if (clientsUsingPackage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete package. It is currently being used by ${clientsUsingPackage} client(s)`
      });
    }

    const package = await Package.findByIdAndDelete(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Log action
    await logAction(
      req.user._id,
      null,
      'delete',
      'package',
      package._id,
      { packageName: package.name },
      req
    );

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting package',
      error: error.message
    });
  }
};

// Toggle package status
const togglePackageStatus = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    package.isActive = !package.isActive;
    await package.save();

    // Log action
    await logAction(
      req.user._id,
      null,
      'update',
      'package',
      package._id,
      { 
        packageName: package.name, 
        action: package.isActive ? 'activated' : 'deactivated' 
      },
      req
    );

    res.json({
      success: true,
      message: `Package ${package.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { package }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling package status',
      error: error.message
    });
  }
};

module.exports = {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus
};
