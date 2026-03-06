const { getTenantConnection } = require('../config/database.config');
const AllowedNetworkSchema = require('../models/tenant/AllowedNetwork');

const normalizeIp = (ip) => (ip || '').replace('::ffff:', '').trim();

exports.listAllowedNetworks = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const AllowedNetwork = tenantConnection.model('AllowedNetwork', AllowedNetworkSchema);

    const networks = await AllowedNetwork.find({}).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, data: networks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

exports.createAllowedNetwork = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const { networkName, ipAddress, location } = req.body;

    if (!networkName || !ipAddress) {
      return res.status(400).json({ success: false, message: 'networkName and ipAddress are required' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const AllowedNetwork = tenantConnection.model('AllowedNetwork', AllowedNetworkSchema);

    const doc = await AllowedNetwork.create({
      networkName: networkName.trim(),
      ipAddress: normalizeIp(ipAddress),
      location: location ? location.trim() : undefined
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    // Handle duplicate key error for ipAddress
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This IP address is already whitelisted'
      });
    }

    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

exports.updateAllowedNetwork = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const { id } = req.params;
    const { networkName, ipAddress, location } = req.body;

    tenantConnection = await getTenantConnection(companyId);
    const AllowedNetwork = tenantConnection.model('AllowedNetwork', AllowedNetworkSchema);

    const update = {};
    if (networkName !== undefined) update.networkName = networkName;
    if (ipAddress !== undefined) update.ipAddress = normalizeIp(ipAddress);
    if (location !== undefined) update.location = location;

    const doc = await AllowedNetwork.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Allowed network not found' });
    }

    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This IP address is already whitelisted'
      });
    }

    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

exports.deleteAllowedNetwork = async (req, res) => {
  let tenantConnection = null;

  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const { id } = req.params;

    tenantConnection = await getTenantConnection(companyId);
    const AllowedNetwork = tenantConnection.model('AllowedNetwork', AllowedNetworkSchema);

    const doc = await AllowedNetwork.findByIdAndDelete(id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Allowed network not found' });
    }

    return res.status(200).json({ success: true, message: 'Allowed network deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};
