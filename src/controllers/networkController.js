const { verifyOfficeNetwork } = require('../utils/networkVerification');

exports.verifyNetwork = async (req, res) => {
  try {
    // Debug logging
    console.log('Network verify request:', {
      userRole: req.user?.role,
      userEmail: req.user?.email,
      companyId: req.companyId
    });

    const result = await verifyOfficeNetwork(req);

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        ...result
      });
    }

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Network verification error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify network'
    });
  }
};
