const { getTenantConnection } = require('../config/database.config');
const AllowedNetworkSchema = require('../models/tenant/AllowedNetwork');

const normalizeIp = (ip) => {
  if (!ip) return '';
  const normalized = ip.replace('::ffff:', '').trim();
  if (normalized === '::1') return '127.0.0.1';
  return normalized;
};

const getRequestIp = (req) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    '';

  return normalizeIp(ip);
};

const verifyOfficeNetwork = async (req) => {
  const companyId = req.companyId;
  const ip = getRequestIp(req);

  console.log('Network verification:', {
    companyId,
    detectedIp: ip,
    headers: {
      xForwardedFor: req.headers['x-forwarded-for'],
      remoteAddress: req.socket?.remoteAddress
    }
  });

  if (!companyId) {
    return {
      ip,
      allowed: false,
      message: 'Company ID not found'
    };
  }

  try {
    const tenantConnection = await getTenantConnection(companyId);
    const AllowedNetwork = tenantConnection.model('AllowedNetwork', AllowedNetworkSchema);

    const match = await AllowedNetwork.findOne({ ipAddress: ip }).lean();
    
    console.log('Network lookup result:', {
      searchedIp: ip,
      foundMatch: !!match,
      match: match
    });

    if (!match) {
      return {
        ip,
        allowed: false,
        message: 'You are not connected to office WiFi'
      };
    }

    return {
      ip,
      allowed: true,
      network: match.networkName,
      location: match.location
    };
  } catch (error) {
    console.error('Network verification error:', error);
    return {
      ip,
      allowed: false,
      message: 'Failed to verify network'
    };
  }
};

module.exports = {
  normalizeIp,
  getRequestIp,
  verifyOfficeNetwork
};
