const Document = require('../models/Document');
const Notification = require('../models/Notification');

exports.getDocuments = async (req, res) => {
  try {
    const { employee, documentType, status } = req.query;
    let query = {};

    if (employee) query.employee = employee;
    if (documentType) query.documentType = documentType;
    if (status) query.status = status;

    // If user is employee, only show their documents
    if (req.user.role === 'employee' && req.user.employeeId) {
      query.employee = req.user.employeeId;
    }

    const documents = await Document.find(query)
      .populate('employee', 'firstName lastName employeeCode')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: documents.length, data: documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('employee')
      .populate('verifiedBy');

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.status(200).json({ success: true, data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const document = await Document.create(req.body);
    res.status(201).json({ success: true, message: 'Document uploaded successfully', data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    document.status = 'verified';
    document.verifiedBy = req.user.employeeId;
    document.verifiedAt = Date.now();
    await document.save();

    res.status(200).json({ success: true, message: 'Document verified successfully', data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectDocument = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    document.status = 'rejected';
    document.rejectionReason = rejectionReason;
    document.verifiedBy = req.user.employeeId;
    document.verifiedAt = Date.now();
    await document.save();

    res.status(200).json({ success: true, message: 'Document rejected', data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExpiringDocuments = async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 30;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const documents = await Document.find({
      expiryDate: { $gte: today, $lte: futureDate },
      status: { $ne: 'expired' }
    })
      .populate('employee', 'firstName lastName email employeeCode')
      .sort({ expiryDate: 1 });

    res.status(200).json({ success: true, count: documents.length, data: documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
