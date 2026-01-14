/**
 * Employee Profile Controller
 * Handles family details, certifications, profile update requests, and official data
 */

const { getTenantConnection } = require('../config/database.config');
const FamilyDetailSchema = require('../models/tenant/FamilyDetail');
const CertificationSchema = require('../models/tenant/Certification');
const OfficialDataSchema = require('../models/tenant/OfficialData');
const ProfileUpdateRequestSchema = require('../models/tenant/ProfileUpdateRequest');
const TenantUserSchema = require('../models/tenant/TenantUser');
const approvalWorkflowService = require('../services/approvalWorkflowService');

// ============ Family Details ============

exports.getFamilyDetails = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const employeeId = req.user.role === 'employee' ? req.user._id : req.query.employeeId || req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const FamilyDetail = tenantConnection.model('FamilyDetail', FamilyDetailSchema);

    const familyDetails = await FamilyDetail.find({
      employeeId: employeeId,
      isActive: true
    }).sort({ relationship: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: familyDetails.length,
      data: familyDetails
    });
  } catch (error) {
    console.error('Error fetching family details:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createFamilyDetail = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const familyData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const FamilyDetail = tenantConnection.model('FamilyDetail', FamilyDetailSchema);

    const familyDetail = new FamilyDetail({
      ...familyData,
      employeeId: user._id,
      employeeEmail: user.email
    });

    await familyDetail.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Family detail added successfully',
      data: familyDetail
    });
  } catch (error) {
    console.error('Error creating family detail:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateFamilyDetail = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const FamilyDetail = tenantConnection.model('FamilyDetail', FamilyDetailSchema);

    const familyDetail = await FamilyDetail.findById(id);
    if (!familyDetail) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Family detail not found'
      });
    }

    // Check authorization
    if (user.role === 'employee' && familyDetail.employeeId.toString() !== user._id.toString()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    Object.assign(familyDetail, updateData);
    await familyDetail.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Family detail updated successfully',
      data: familyDetail
    });
  } catch (error) {
    console.error('Error updating family detail:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteFamilyDetail = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const FamilyDetail = tenantConnection.model('FamilyDetail', FamilyDetailSchema);

    const familyDetail = await FamilyDetail.findById(id);
    if (!familyDetail) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Family detail not found'
      });
    }

    // Check authorization
    if (user.role === 'employee' && familyDetail.employeeId.toString() !== user._id.toString()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    familyDetail.isActive = false;
    await familyDetail.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Family detail deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting family detail:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ Certifications ============

exports.getCertifications = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const employeeId = req.user.role === 'employee' ? req.user._id : req.query.employeeId || req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Certification = tenantConnection.model('Certification', CertificationSchema);

    const certifications = await Certification.find({
      employeeId: employeeId,
      isActive: true
    }).sort({ issueDate: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: certifications.length,
      data: certifications
    });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createCertification = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const certData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Certification = tenantConnection.model('Certification', CertificationSchema);

    const certification = new Certification({
      ...certData,
      employeeId: user._id,
      employeeEmail: user.email
    });

    await certification.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Certification added successfully',
      data: certification
    });
  } catch (error) {
    console.error('Error creating certification:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateCertification = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const updateData = req.body;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Certification = tenantConnection.model('Certification', CertificationSchema);

    const certification = await Certification.findById(id);
    if (!certification) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    // Check authorization
    if (user.role === 'employee' && certification.employeeId.toString() !== user._id.toString()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    Object.assign(certification, updateData);
    await certification.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Certification updated successfully',
      data: certification
    });
  } catch (error) {
    console.error('Error updating certification:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteCertification = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const Certification = tenantConnection.model('Certification', CertificationSchema);

    const certification = await Certification.findById(id);
    if (!certification) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    // Check authorization
    if (user.role === 'employee' && certification.employeeId.toString() !== user._id.toString()) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    certification.isActive = false;
    await certification.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Certification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting certification:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ Official Data ============

exports.getOfficialData = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const employeeId = req.user.role === 'employee' ? req.user._id : req.query.employeeId || req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const OfficialData = tenantConnection.model('OfficialData', OfficialDataSchema);

    const officialData = await OfficialData.findOne({
      employeeId: employeeId
    });

    if (!officialData) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Official data not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: officialData
    });
  } catch (error) {
    console.error('Error fetching official data:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ Profile Update Requests ============

exports.createProfileUpdateRequest = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const { fieldName, fieldCategory, oldValue, newValue, reason } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ProfileUpdateRequest = tenantConnection.model('ProfileUpdateRequest', ProfileUpdateRequestSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Get employee details for workflow initialization
    const employee = await TenantUser.findById(user._id);

    // Initialize approval workflow
    const workflowData = await approvalWorkflowService.initializeWorkflow(
      companyId,
      'profile_update',
      null,
      { fieldCategory, fieldName },
      user._id
    );

    const updateRequest = new ProfileUpdateRequest({
      employeeId: user._id,
      employeeEmail: user.email,
      fieldName,
      fieldCategory,
      oldValue,
      newValue,
      reason,
      status: 'pending',
      approvals: workflowData.approvalLevels.map(level => ({
        approverId: level.approverId,
        approverEmail: level.approverEmail,
        approverName: level.approverName,
        status: 'pending'
      })),
      currentApprover: workflowData.approvalLevels[0]?.approverId,
      slaDeadline: workflowData.slaDeadline
    });

    await updateRequest.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Profile update request created successfully',
      data: updateRequest
    });
  } catch (error) {
    console.error('Error creating profile update request:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getProfileUpdateRequests = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const { status } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ProfileUpdateRequest = tenantConnection.model('ProfileUpdateRequest', ProfileUpdateRequestSchema);

    const query = {};
    if (user.role === 'employee') {
      query.employeeId = user._id;
    } else if (user.role === 'manager' || user.role === 'hr') {
      // Show requests pending their approval
      query.currentApprover = user._id;
    }
    if (status) query.status = status;

    const requests = await ProfileUpdateRequest.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('currentApprover', 'firstName lastName email')
      .sort({ appliedOn: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching profile update requests:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.approveProfileUpdateRequest = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { action, comments } = req.body;
    const approverId = req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ProfileUpdateRequest = tenantConnection.model('ProfileUpdateRequest', ProfileUpdateRequestSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const request = await ProfileUpdateRequest.findById(id);
    if (!request) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Profile update request not found'
      });
    }

    // Find current approval
    const currentApproval = request.approvals.find(a => 
      a.approverId.toString() === approverId.toString() && a.status === 'pending'
    );

    if (!currentApproval) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or already processed'
      });
    }

    if (action === 'approve') {
      currentApproval.status = 'approved';
      currentApproval.comments = comments || '';
      currentApproval.approvedAt = new Date();

      // Check if all approvals are done
      const allApproved = request.approvals.every(a => a.status === 'approved' || a.status === 'rejected');
      if (allApproved) {
        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = approverId;

        // Apply the update to employee profile
        const employee = await TenantUser.findById(request.employeeId);
        if (employee) {
          employee[request.fieldName] = request.newValue;
          await employee.save();
        }
      } else {
        // Move to next approver
        const nextApproval = request.approvals.find(a => a.status === 'pending');
        if (nextApproval) {
          request.currentApprover = nextApproval.approverId;
        }
      }
    } else if (action === 'reject') {
      currentApproval.status = 'rejected';
      currentApproval.comments = comments || '';
      currentApproval.rejectedAt = new Date();
      request.status = 'rejected';
      request.rejectedAt = new Date();
      request.rejectedBy = approverId;
      request.rejectionReason = comments || 'Rejected by approver';
    }

    await request.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: `Profile update request ${action}d successfully`,
      data: request
    });
  } catch (error) {
    console.error('Error processing profile update request:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


