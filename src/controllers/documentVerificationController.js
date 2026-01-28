/**
 * Document Verification Controller
 * HR/Admin panel for verifying candidate documents
 */

const { getTenantModel } = require('../utils/tenantModels');
const { sendDocumentRejectionEmail } = require('../services/emailService');

/**
 * Get all candidates with pending document verification
 */
exports.getCandidatesWithDocuments = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const { status } = req.query;
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    
    // Get unique onboarding IDs with documents
    const pipeline = [
      { $match: { isActive: true } }
    ];
    
    if (status) {
      pipeline[0].$match.verificationStatus = status;
    }
    
    pipeline.push(
      {
        $group: {
          _id: '$onboardingId',
          totalDocuments: { $sum: 1 },
          pendingDocuments: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] }
          },
          verifiedDocuments: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
          },
          unverifiedDocuments: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'unverified'] }, 1, 0] }
          },
          resubmittedDocuments: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'resubmitted'] }, 1, 0] }
          },
          lastUploadedAt: { $max: '$uploadedAt' }
        }
      },
      { $sort: { lastUploadedAt: -1 } }
    );
    
    const documentStats = await CandidateDocument.aggregate(pipeline);
    
    // Get onboarding details
    const onboardingIds = documentStats.map(stat => stat._id);
    const onboardings = await Onboarding.find({ _id: { $in: onboardingIds } })
      .select('onboardingId candidateName candidateEmail position department status')
      .lean();
    
    // Merge data
    const candidates = documentStats.map(stat => {
      const onboarding = onboardings.find(o => o._id.toString() === stat._id.toString());
      return {
        onboardingId: stat._id,
        candidateId: onboarding?.onboardingId,
        candidateName: onboarding?.candidateName,
        candidateEmail: onboarding?.candidateEmail,
        position: onboarding?.position,
        department: onboarding?.department,
        onboardingStatus: onboarding?.status,
        documentStats: {
          total: stat.totalDocuments,
          pending: stat.pendingDocuments,
          verified: stat.verifiedDocuments,
          unverified: stat.unverifiedDocuments,
          resubmitted: stat.resubmittedDocuments
        },
        lastUploadedAt: stat.lastUploadedAt
      };
    });
    
    res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates
    });
  } catch (error) {
    console.error('Error fetching candidates with documents:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get documents for a specific candidate
 */
exports.getCandidateDocuments = async (req, res) => {
  try {
    const { onboardingId } = req.params;
    const tenantConnection = req.tenant.connection;
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    const DocumentConfiguration = getTenantModel(tenantConnection, 'DocumentConfiguration');
    
    // Get onboarding details
    const onboarding = await Onboarding.findById(onboardingId);
    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding record not found'
      });
    }
    
    // Get documents
    const documents = await CandidateDocument.find({
      onboardingId,
      isActive: true
    })
    .sort({ uploadedAt: -1 })
    .lean();
    
    // Get document configurations
    const docConfigs = await DocumentConfiguration.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        candidate: {
          onboardingId: onboarding._id,
          candidateId: onboarding.onboardingId,
          candidateName: onboarding.candidateName,
          candidateEmail: onboarding.candidateEmail,
          position: onboarding.position,
          department: onboarding.department
        },
        documents,
        documentConfigurations: docConfigs
      }
    });
  } catch (error) {
    console.error('Error fetching candidate documents:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verify a document
 */
exports.verifyDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { remarks } = req.body;
    const tenantConnection = req.tenant.connection;
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    
    const document = await CandidateDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Update verification status
    document.verificationStatus = 'verified';
    document.verifiedBy = req.user._id;
    document.verifiedByName = `${req.user.firstName} ${req.user.lastName}`;
    document.verifiedAt = new Date();
    document.verificationRemarks = remarks;
    
    // Add to history
    document.addToHistory('verified', req.user._id, document.verifiedByName, remarks);
    
    await document.save();
    
    console.log(`✅ Document verified: ${document.documentName} for ${document.candidateName}`);
    
    res.status(200).json({
      success: true,
      message: 'Document verified successfully',
      data: document
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark document as unverified and trigger re-submission
 */
exports.unverifyDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { reason } = req.body;
    const tenantConnection = req.tenant.connection;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Reason is required when marking document as unverified'
      });
    }
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    const CandidateDocumentUploadToken = getTenantModel(tenantConnection, 'CandidateDocumentUploadToken');
    
    const document = await CandidateDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Update verification status
    document.verificationStatus = 'unverified';
    document.unverifiedBy = req.user._id;
    document.unverifiedByName = `${req.user.firstName} ${req.user.lastName}`;
    document.unverifiedAt = new Date();
    document.unverificationReason = reason;
    
    // Add to history
    document.addToHistory('unverified', req.user._id, document.unverifiedByName, reason);
    
    await document.save();
    
    // Update upload token to mark resubmission required
    const uploadToken = await CandidateDocumentUploadToken.findOne({
      onboardingId: document.onboardingId,
      isActive: true
    });
    
    if (uploadToken) {
      uploadToken.resubmissionRequired = true;
      uploadToken.resubmissionRequestedAt = new Date();
      
      // Add to rejected documents list
      const existingRejection = uploadToken.rejectedDocuments.find(
        rd => rd.documentType === document.documentType
      );
      
      if (existingRejection) {
        existingRejection.reason = reason;
        existingRejection.rejectedAt = new Date();
      } else {
        uploadToken.rejectedDocuments.push({
          documentType: document.documentType,
          reason,
          rejectedAt: new Date()
        });
      }
      
      await uploadToken.save();
      
      // Send re-submission email
      try {
        await sendDocumentRejectionEmail({
          candidateName: document.candidateName,
          candidateEmail: document.candidateEmail,
          documentName: document.documentName,
          rejectionReason: reason,
          // Hard-coded public upload URL as requested
          uploadUrl: `http://3.108.172.119/public/upload-documents/${uploadToken.token}`,
          rejectedDocuments: uploadToken.rejectedDocuments
        });
        
        console.log(`📧 Re-submission email sent to ${document.candidateEmail}`);
      } catch (emailError) {
        console.error('Error sending re-submission email:', emailError);
      }
    }
    
    console.log(`❌ Document marked unverified: ${document.documentName} for ${document.candidateName}`);
    
    res.status(200).json({
      success: true,
      message: 'Document marked as unverified. Re-submission email sent to candidate.',
      data: document
    });
  } catch (error) {
    console.error('Error marking document as unverified:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Bulk verify documents
 */
exports.bulkVerifyDocuments = async (req, res) => {
  try {
    const { documentIds, remarks } = req.body;
    const tenantConnection = req.tenant.connection;
    
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Document IDs array is required'
      });
    }
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    
    const verifierName = `${req.user.firstName} ${req.user.lastName}`;
    const verifiedAt = new Date();
    
    // Update all documents
    const result = await CandidateDocument.updateMany(
      { _id: { $in: documentIds }, isActive: true },
      {
        $set: {
          verificationStatus: 'verified',
          verifiedBy: req.user._id,
          verifiedByName: verifierName,
          verifiedAt,
          verificationRemarks: remarks
        },
        $push: {
          history: {
            action: 'verified',
            performedBy: req.user._id,
            performedByName: verifierName,
            remarks,
            timestamp: verifiedAt
          }
        }
      }
    );
    
    console.log(`✅ Bulk verified ${result.modifiedCount} documents`);
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} documents verified successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error bulk verifying documents:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Download document
 */
const path = require('path');
const fs = require('fs');

exports.downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const tenantConnection = req.tenant.connection;
    
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    
    const document = await CandidateDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Resolve absolute file path. filePath is stored relative to backend root (e.g. "uploads/...").
    const absolutePath = path.isAbsolute(document.filePath)
      ? document.filePath
      : path.join(__dirname, '..', '..', document.filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error('Download error: file not found on disk', {
        filePath: document.filePath,
        resolvedPath: absolutePath
      });
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    res.download(absolutePath, document.originalFileName);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get document verification statistics
 */
exports.getVerificationStats = async (req, res) => {
  try {
    const tenantConnection = req.tenant.connection;
    const CandidateDocument = getTenantModel(tenantConnection, 'CandidateDocument');
    
    const stats = await CandidateDocument.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statsObj = {
      total: 0,
      pending: 0,
      verified: 0,
      unverified: 0,
      resubmitted: 0
    };
    
    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });
    
    res.status(200).json({
      success: true,
      data: statsObj
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
