/**
 * Approval Workflow Controller
 * Handles workflow configuration, approval actions, delegation, and SLA monitoring
 */

const mongoose = require('mongoose');
const { getTenantConnection } = require('../config/database.config');
const { getTenantModel } = require('../utils/tenantModels');
const ApprovalWorkflowSchema = require('../models/tenant/ApprovalWorkflow');
const ApprovalMatrixSchema = require('../models/tenant/ApprovalMatrix');
const ApprovalDelegationSchema = require('../models/tenant/ApprovalDelegation');
const approvalWorkflowService = require('../services/approvalWorkflowService');
const { validateWorkflow } = require('../services/workflowValidation');
// NOTE: Projects are tenant-scoped. Always resolve Project via tenant connection.

function normalizeAppliesTo(appliesTo) {
  if (!appliesTo) return null;
  return String(appliesTo).trim();
}

function computeVersionBump(currentMajor = 1, currentMinor = 0) {
  return { versionMajor: currentMajor, versionMinor: currentMinor + 1 };
}

function pickComparableWorkflowFields(docOrObj) {
  const src = docOrObj || {};
  return {
    workflowName: src.workflowName || src.name || '',
    description: src.description || '',
    appliesTo: src.appliesTo || src.requestType || src.entityType || '',
    status: src.status || (src.isActive ? 'active' : 'draft'),
    effectiveDate: src.effectiveDate || null,
    autoArchiveAfterDays: src.autoArchiveAfterDays ?? null,
    steps: src.steps || src.approvalSteps || src.levels || []
  };
}

function diffObjects(before, after) {
  const changes = {};
  Object.keys(after).forEach((key) => {
    const b = before?.[key];
    const a = after?.[key];
    const isEqual =
      key === 'steps'
        ? JSON.stringify(b || []) === JSON.stringify(a || [])
        : JSON.stringify(b) === JSON.stringify(a);
    if (!isEqual) changes[key] = { from: b, to: a };
  });
  return changes;
}

/**
 * Get all workflows
 */
exports.getWorkflows = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const {
      entityType,
      isActive,
      status,
      appliesTo,
      q,
      isValid,
      page = 1,
      limit = 25,
      sortBy = 'updatedAt',
      sortDir = 'desc'
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const query = {};
    if (entityType) query.entityType = entityType;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (status) query.status = status;
    if (appliesTo) query.appliesTo = appliesTo;
    if (isValid !== undefined) query['validation.isValid'] = isValid === 'true';
    if (q) {
      query.$or = [
        { workflowName: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const direction = String(sortDir).toLowerCase() === 'asc' ? 1 : -1;
    const sort = { [sortBy]: direction };

    const [workflows, total] = await Promise.all([
      ApprovalWorkflow.find(query)
      .populate('levels.approverId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum),
      ApprovalWorkflow.countDocuments(query)
    ]);

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: workflows.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: workflows
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single workflow by id
 */
exports.getWorkflow = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflow = await ApprovalWorkflow.findById(id)
      .populate('levels.approverId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email');

    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    if (tenantConnection) await tenantConnection.close();
    return res.status(200).json({ success: true, data: workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Workflow quick stats (for dashboard cards / sidebar badge)
 */
exports.getWorkflowStats = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const [totalActive, totalDraft, totalArchived, invalidCount] = await Promise.all([
      ApprovalWorkflow.countDocuments({ status: 'active', 'validation.isValid': true }),
      ApprovalWorkflow.countDocuments({ status: 'draft' }),
      ApprovalWorkflow.countDocuments({ status: 'archived' }),
      ApprovalWorkflow.countDocuments({ 'validation.isValid': false })
    ]);

    // Pending approvals + avg approval time are domain-specific; return safe defaults for now.
    const stats = {
      totalActiveWorkflows: totalActive,
      totalDraftWorkflows: totalDraft,
      totalArchivedWorkflows: totalArchived,
      workflowsRequiringAttention: invalidCount,
      pendingApprovals: 0,
      averageApprovalTimeHours: 0
    };

    if (tenantConnection) await tenantConnection.close();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching workflow stats:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Validate workflow payload without saving (dry-run)
 */
exports.validateWorkflowDryRun = async (req, res) => {
  try {
    const workflowData = req.body || {};
    const result = validateWorkflow(workflowData);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error validating workflow:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create workflow
 */
exports.createWorkflow = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const workflowData = req.body;
    const normalizedName = (workflowData?.name || workflowData?.workflowName || '').trim();
    const appliesToValue = normalizeAppliesTo(workflowData?.appliesTo || workflowData?.requestType || workflowData?.entityType);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
    const validation = validateWorkflow({
      ...workflowData,
      name: normalizedName,
      workflowName: workflowData?.workflowName || normalizedName,
      appliesTo: appliesToValue
    });

    if (!validation.isValid) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const normalizedStatus = workflowData?.status || (workflowData?.isActive ? 'active' : 'draft');
    const requestType = appliesToValue || workflowData?.requestType;
    const entityType = workflowData?.entityType || (['leave', 'roster_change', 'profile_update', 'attendance_regularization', 'expense', 'project', 'other'].includes(requestType) ? requestType : 'other');

    const workflow = new ApprovalWorkflow({
      ...workflowData,
      name: normalizedName,
      workflowName: workflowData?.workflowName || normalizedName,
      appliesTo: appliesToValue,
      requestType: requestType || workflowData?.requestType,
      entityType,
      status: normalizedStatus,
      isActive: normalizedStatus === 'active',
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        updatedAt: new Date()
      },
      auditTrail: [
        ...(workflowData?.auditTrail || []),
        {
          action: 'CREATED',
          performedBy: user._id,
          performedByEmail: user.email,
          timestamp: new Date(),
          changes: pickComparableWorkflowFields(workflowData)
        }
      ],
      lastModifiedBy: user._id,
      createdBy: user._id
    });

    await workflow.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      data: workflow
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update workflow
 */
exports.updateWorkflow = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const updateData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const existing = await ApprovalWorkflow.findById(id);
    if (!existing) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    const appliesToValue = normalizeAppliesTo(updateData?.appliesTo || updateData?.requestType || updateData?.entityType || existing.appliesTo);

    const validation = validateWorkflow({
      ...existing.toObject(),
      ...updateData,
      name: updateData?.name || existing.name || existing.workflowName,
      workflowName: updateData?.workflowName || existing.workflowName || existing.name,
      appliesTo: appliesToValue
    });

    if (!validation.isValid) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const normalizedStatus = updateData?.status || existing.status || (updateData?.isActive ? 'active' : 'draft');
    const requestType = appliesToValue || existing.requestType;
    const entityType = updateData?.entityType || existing.entityType || (['leave', 'roster_change', 'profile_update', 'attendance_regularization', 'expense', 'project', 'other'].includes(requestType) ? requestType : 'other');

    const beforeComparable = pickComparableWorkflowFields(existing.toObject());
    const afterComparable = pickComparableWorkflowFields({
      ...existing.toObject(),
      ...updateData,
      appliesTo: appliesToValue,
      status: normalizedStatus,
      steps: updateData?.steps || existing.steps
    });
    const changes = diffObjects(beforeComparable, afterComparable);

    const { versionMajor, versionMinor } = computeVersionBump(existing.versionMajor, existing.versionMinor);

    const workflow = await ApprovalWorkflow.findByIdAndUpdate(
      id,
      {
        ...updateData,
        name: updateData?.name || existing.name || existing.workflowName,
        workflowName: updateData?.workflowName || existing.workflowName || existing.name,
        appliesTo: appliesToValue,
        requestType,
        entityType,
        status: normalizedStatus,
        isActive: normalizedStatus === 'active',
        versionMajor,
        versionMinor,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          updatedAt: new Date()
        },
        lastModifiedBy: req.user?._id,
        $push: {
          auditTrail: {
            action: 'UPDATED',
            performedBy: req.user?._id,
            performedByEmail: req.user?.email,
            timestamp: new Date(),
            changes
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      message: 'Workflow updated successfully',
      data: workflow
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Duplicate workflow
 */
exports.duplicateWorkflow = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const existing = await ApprovalWorkflow.findById(id);
    if (!existing) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    const cloned = existing.toObject();
    delete cloned._id;
    delete cloned.createdAt;
    delete cloned.updatedAt;

    const copy = new ApprovalWorkflow({
      ...cloned,
      workflowName: `${existing.workflowName || existing.name} (Copy)`,
      name: `${existing.name || existing.workflowName} (Copy)`,
      status: 'draft',
      isActive: false,
      versionMajor: 1,
      versionMinor: 0,
      createdBy: user._id,
      lastModifiedBy: user._id,
      auditTrail: [
        ...(existing.auditTrail || []),
        {
          action: 'DUPLICATED',
          performedBy: user._id,
          performedByEmail: user.email,
          timestamp: new Date(),
          changes: { fromWorkflowId: existing._id }
        }
      ]
    });

    await copy.save();
    if (tenantConnection) await tenantConnection.close();
    return res.status(201).json({ success: true, message: 'Workflow duplicated', data: copy });
  } catch (error) {
    console.error('Error duplicating workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Archive workflow (soft)
 */
exports.archiveWorkflow = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const user = req.user;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflow = await ApprovalWorkflow.findByIdAndUpdate(
      id,
      {
        status: 'archived',
        isActive: false,
        lastModifiedBy: user?._id,
        $push: {
          auditTrail: {
            action: 'ARCHIVED',
            performedBy: user?._id,
            performedByEmail: user?.email,
            timestamp: new Date(),
            changes: { status: { from: 'active', to: 'archived' } }
          }
        }
      },
      { new: true }
    );

    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    if (tenantConnection) await tenantConnection.close();
    return res.status(200).json({ success: true, message: 'Workflow archived', data: workflow });
  } catch (error) {
    console.error('Error archiving workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Workflow history (audit trail + versions)
 */
exports.getWorkflowHistory = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflow = await ApprovalWorkflow.findById(id).populate('auditTrail.performedBy', 'firstName lastName email');
    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    if (tenantConnection) await tenantConnection.close();
    return res.status(200).json({
      success: true,
      data: {
        workflowId: workflow._id,
        versionMajor: workflow.versionMajor,
        versionMinor: workflow.versionMinor,
        versionLabel: workflow.versionLabel,
        auditTrail: workflow.auditTrail || []
      }
    });
  } catch (error) {
    console.error('Error fetching workflow history:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export workflows as CSV
 */
exports.exportWorkflowsCSV = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const workflows = await ApprovalWorkflow.find({}).sort({ updatedAt: -1 });
    const rows = [
      ['WorkflowName', 'AppliesTo', 'Status', 'IsValid', 'Version', 'TotalSteps', 'LastModifiedAt'].join(',')
    ];

    workflows.forEach((w) => {
      const name = (w.workflowName || w.name || '').replaceAll('"', '""');
      const applies = (w.appliesTo || w.requestType || '').replaceAll('"', '""');
      const version = w.versionLabel || `v${w.versionMajor || 1}.${w.versionMinor || 0}`;
      const totalSteps = (w.steps && w.steps.length) || (w.levels && w.levels.length) || (w.approvalSteps && w.approvalSteps.length) || 0;
      rows.push(
        [
          `"${name}"`,
          `"${applies}"`,
          w.status || '',
          String(w.validation?.isValid ?? true),
          version,
          String(totalSteps),
          w.updatedAt ? new Date(w.updatedAt).toISOString() : ''
        ].join(',')
      );
    });

    if (tenantConnection) await tenantConnection.close();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="workflows.csv"');
    return res.status(200).send(rows.join('\n'));
  } catch (error) {
    console.error('Error exporting workflows CSV:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export single workflow as JSON
 */
exports.exportWorkflowJSON = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);
    const workflow = await ApprovalWorkflow.findById(id);
    if (!workflow) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    if (tenantConnection) await tenantConnection.close();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="workflow_${id}.json"`);
    return res.status(200).send(JSON.stringify(workflow.toObject(), null, 2));
  } catch (error) {
    console.error('Error exporting workflow JSON:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Import workflow JSON (template/import)
 */
exports.importWorkflowJSON = async (req, res) => {
  let tenantConnection = null;
  try {
    const companyId = req.companyId;
    const user = req.user;
    const payload = req.body || {};
    const normalizedName = (payload?.name || payload?.workflowName || '').trim();

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID not found' });
    }

    const appliesToValue = normalizeAppliesTo(payload?.appliesTo || payload?.requestType || payload?.entityType);
    const validation = validateWorkflow({
      ...payload,
      name: normalizedName,
      workflowName: payload?.workflowName || normalizedName,
      appliesTo: appliesToValue
    });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Workflow validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalWorkflow = tenantConnection.model('ApprovalWorkflow', ApprovalWorkflowSchema);

    const requestType = appliesToValue || payload?.requestType;
    const entityType = payload?.entityType || (['leave', 'roster_change', 'profile_update', 'attendance_regularization', 'expense', 'project', 'other'].includes(requestType) ? requestType : 'other');

    const workflow = new ApprovalWorkflow({
      ...payload,
      appliesTo: appliesToValue,
      requestType,
      entityType,
      status: payload?.status || 'draft',
      isActive: false,
      versionMajor: 1,
      versionMinor: 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        updatedAt: new Date()
      },
      createdBy: user._id,
      lastModifiedBy: user._id,
      auditTrail: [
        ...(payload.auditTrail || []),
        {
          action: 'IMPORTED',
          performedBy: user._id,
          performedByEmail: user.email,
          timestamp: new Date(),
          changes: { source: 'import' }
        }
      ]
    });

    await workflow.save();
    if (tenantConnection) await tenantConnection.close();
    return res.status(201).json({ success: true, message: 'Workflow imported', data: workflow });
  } catch (error) {
    console.error('Error importing workflow:', error);
    if (tenantConnection) await tenantConnection.close();
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get approval matrices
 */
exports.getApprovalMatrices = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { entityType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);

    const query = { isActive: true };
    if (entityType) query.entityType = entityType;

    const matrices = await ApprovalMatrix.find(query)
      .populate('requiredApprovers.approverId', 'firstName lastName email')
      .sort({ priority: -1, name: 1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: matrices.length,
      data: matrices
    });
  } catch (error) {
    console.error('Error fetching approval matrices:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create approval matrix
 */
exports.createApprovalMatrix = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const matrixData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalMatrix = tenantConnection.model('ApprovalMatrix', ApprovalMatrixSchema);

    const matrix = new ApprovalMatrix({
      ...matrixData,
      createdBy: user._id
    });

    await matrix.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Approval matrix created successfully',
      data: matrix
    });
  } catch (error) {
    console.error('Error creating approval matrix:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get delegations
 */
exports.getDelegations = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { delegatorId, delegateId, isActive } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalDelegation = tenantConnection.model('ApprovalDelegation', ApprovalDelegationSchema);

    const query = {};
    if (delegatorId) query.delegatorId = delegatorId;
    if (delegateId) query.delegateId = delegateId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const delegations = await ApprovalDelegation.find(query)
      .populate('delegatorId', 'firstName lastName email')
      .populate('delegateId', 'firstName lastName email')
      .sort({ startDate: -1 });

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: delegations.length,
      data: delegations
    });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create delegation
 */
exports.createDelegation = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const user = req.user;
    const delegationData = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const ApprovalDelegation = tenantConnection.model('ApprovalDelegation', ApprovalDelegationSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    // Get delegate details
    const delegate = await TenantUser.findById(delegationData.delegateId);
    if (!delegate) {
      if (tenantConnection) await tenantConnection.close();
      return res.status(404).json({
        success: false,
        message: 'Delegate not found'
      });
    }

    const delegation = new ApprovalDelegation({
      delegatorId: user._id,
      delegatorEmail: user.email,
      delegateId: delegate._id,
      delegateEmail: delegate.email,
      delegateName: `${delegate.firstName} ${delegate.lastName}`,
      entityTypes: delegationData.entityTypes || ['all'],
      startDate: delegationData.startDate,
      endDate: delegationData.endDate,
      reason: delegationData.reason,
      createdBy: user._id
    });

    await delegation.save();

    if (tenantConnection) await tenantConnection.close();

    res.status(201).json({
      success: true,
      message: 'Delegation created successfully',
      data: delegation
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Process approval action
 */
exports.processApproval = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { entityType, entityId } = req.params;
    const { level, action, comments } = req.body;
    const approverId = req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    // For leave and project requests, entityId is actually the approval instance ID
    if (entityType === 'leave_request' || entityType === 'project') {
      tenantConnection = await getTenantConnection(companyId);
      const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
      const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);
      
      // Use approvalEngine to process the approval
      const approvalEngine = require('../services/approvalEngine');
      const result = await approvalEngine.processApproval(entityId, approverId, action, comments, tenantConnection);
      
      // Update the actual entity status if fully approved
      if (result.status === 'approved' || result.status === 'rejected') {
        const instance = await ApprovalInstance.findById(entityId);
        
        if (instance) {
          if (instance.requestType === 'leave') {
            const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
            const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
            await LeaveRequest.findByIdAndUpdate(instance.requestId, {
              status: result.status,
              approvalComments: comments
            });
          } else if (instance.requestType === 'project') {
            const ProjectModel = getTenantModel(tenantConnection, 'Project');
            const updateData = {
              approvalStatus: result.status,
              approvalComments: comments
            };
            if (result.status === 'approved') {
              updateData.status = 'active';
              updateData.approvedBy = approverId;
              updateData.approvedAt = new Date();
            }
            if (ProjectModel) {
              await ProjectModel.findByIdAndUpdate(instance.requestId, updateData);
            }
          }
        }
      }
      
      res.status(200).json({
        success: true,
        message: `Request ${action}d successfully`,
        data: result
      });
    } else {
      // Use legacy workflow service for other entity types
      const result = await approvalWorkflowService.processApproval(
        companyId,
        entityType,
        entityId,
        level,
        approverId,
        action,
        comments
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.entity
      });
    }
  } catch (error) {
    console.error('Error processing approval:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (tenantConnection) await tenantConnection.close();
  }
};

/**
 * Get SLA monitoring data
 */
exports.getSLAMonitoring = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { entityType } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const tenantConnection = await getTenantConnection(companyId);
    const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);

    const query = { status: 'pending' };
    if (entityType) {
      // For now, only leave requests are supported
    }

    const pendingRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'firstName lastName email')
      .sort({ slaDeadline: 1 });

    const now = new Date();
    const slaData = {
      total: pendingRequests.length,
      withinSLA: 0,
      approachingSLA: 0,
      exceededSLA: 0,
      escalated: 0,
      requests: pendingRequests.map(req => {
        const hoursRemaining = (req.slaDeadline - now) / (1000 * 60 * 60);
        let status = 'within_sla';
        if (req.isEscalated) {
          status = 'escalated';
        } else if (hoursRemaining < 0) {
          status = 'exceeded_sla';
        } else if (hoursRemaining < 24) {
          status = 'approaching_sla';
        }

        if (status === 'within_sla') slaData.withinSLA++;
        else if (status === 'approaching_sla') slaData.approachingSLA++;
        else if (status === 'exceeded_sla') slaData.exceededSLA++;
        else if (status === 'escalated') slaData.escalated++;

        return {
          id: req._id,
          employeeName: req.employeeName,
          leaveType: req.leaveType,
          startDate: req.startDate,
          numberOfDays: req.numberOfDays,
          currentLevel: req.currentLevel,
          slaDeadline: req.slaDeadline,
          hoursRemaining: Math.round(hoursRemaining * 10) / 10,
          status: status,
          isEscalated: req.isEscalated
        };
      })
    };

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      data: slaData
    });
  } catch (error) {
    console.error('Error fetching SLA monitoring:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get pending approvals for current user
 */
exports.getPendingApprovals = async (req, res) => {
  let tenantConnection = null;
  
  try {
    const companyId = req.companyId;
    const { entityType, status } = req.query;
    const userEmail = req.user.email;
    const userId = req.user._id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    tenantConnection = await getTenantConnection(companyId);
    const LeaveRequestSchema = require('../models/tenant/LeaveRequest');
    const LeaveRequest = tenantConnection.model('LeaveRequest', LeaveRequestSchema);
    const ApprovalInstanceSchema = require('../models/tenant/ApprovalInstance');
    const ApprovalInstance = tenantConnection.model('ApprovalInstance', ApprovalInstanceSchema);
    const ProjectModel = getTenantModel(tenantConnection, 'Project');

    // Only show approvals that are currently assigned to the logged-in user.
    // This respects your configured workflow (Step 1 HR vs Manager etc.).
    const instanceQuery = {
      status: status || 'pending',
      approvalChain: {
        $elemMatch: {
          status: 'pending',
          approverId: userId
        }
      }
    };

    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H3', location: 'hrms-backend/src/controllers/approvalWorkflowController.js:getPendingApprovals:entry', message: 'Pending approvals query starting', data: { companyId, userId: String(userId), userRole: req.user?.role || null, entityType: entityType || null, status: status || 'pending', hasProjectModel: Boolean(ProjectModel) }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    if (entityType) {
      const normalized = String(entityType).toLowerCase();
      // Frontend sends 'leave_request' or 'project'; approval instances store 'leave' or 'project'
      if (normalized.includes('leave')) {
        instanceQuery.requestType = 'leave';
      } else if (normalized.includes('project')) {
        instanceQuery.requestType = 'project';
      } else {
        // Unknown entity type for approval instances
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
    }

    const instances = await ApprovalInstance.find(instanceQuery).sort({ createdAt: -1 }).lean();
    const leaveIds = instances.filter(i => i.requestType === 'leave').map(i => i.requestId);
    const projectIds = instances.filter(i => i.requestType === 'project').map(i => i.requestId);

    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H3', location: 'hrms-backend/src/controllers/approvalWorkflowController.js:getPendingApprovals:instances', message: 'Approval instances fetched for pending list', data: { instancesCount: instances.length, requestTypes: [...new Set(instances.map(i => i.requestType).filter(Boolean))], leaveIdsCount: leaveIds.length, projectIdsCount: projectIds.length }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    const leaveRequests = await LeaveRequest.find({ _id: { $in: leaveIds } })
      .populate('employeeId', 'firstName lastName email employeeCode')
      .lean();

    // For projects, always use the tenant-scoped Project model.
    const projects = ProjectModel
      ? await ProjectModel.find({ _id: { $in: projectIds } })
          .populate('projectManager', 'firstName lastName email')
          .populate('client', 'name')
          .lean()
      : [];

    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/55260818-aa6f-4194-8f1a-a7b791aff845', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: 'baseline', hypothesisId: 'H4', location: 'hrms-backend/src/controllers/approvalWorkflowController.js:getPendingApprovals:hydration', message: 'Hydrated entities for pending list', data: { leaveRequestsCount: leaveRequests.length, projectsCount: projects.length }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    const leaveById = new Map(leaveRequests.map((r) => [String(r._id), r]));
    const projectById = new Map(projects.map((p) => [String(p._id), p]));

    const approvals = instances
      .map((inst) => {
        if (inst.requestType === 'leave') {
          const reqDoc = leaveById.get(String(inst.requestId));
          if (!reqDoc) return null;
          return {
            _id: inst._id,
            entityType: 'leave_request',
            entityId: reqDoc._id,
            instanceId: inst._id, // Include approval instance ID for approval actions
            currentLevel: inst.currentLevel, // Include current approval level
            employeeName: reqDoc.employeeId
              ? `${reqDoc.employeeId.firstName} ${reqDoc.employeeId.lastName}`
              : reqDoc.employeeName,
            employeeEmail: reqDoc.employeeId?.email || reqDoc.employeeEmail,
            details: `${reqDoc.leaveType} - ${reqDoc.numberOfDays} day(s) from ${new Date(reqDoc.startDate).toLocaleDateString()} to ${new Date(reqDoc.endDate).toLocaleDateString()}`,
            requestDate: reqDoc.createdAt || inst.createdAt,
            slaDeadline: inst?.approvalChain?.find((s) => s.level === inst.currentLevel)?.sla?.dueDate,
            status: inst.status,
            leaveType: reqDoc.leaveType,
            startDate: reqDoc.startDate,
            endDate: reqDoc.endDate,
            numberOfDays: reqDoc.numberOfDays,
            reason: reqDoc.reason,
            approvalComments: reqDoc.approvalComments
          };
        } else if (inst.requestType === 'project') {
          const projectDoc = projectById.get(String(inst.requestId));
          if (!projectDoc) return null;
          return {
            _id: inst._id,
            entityType: 'project',
            entityId: projectDoc._id,
            instanceId: inst._id, // Include approval instance ID for approval actions
            currentLevel: inst.currentLevel, // Include current approval level
            employeeName: projectDoc.projectManager
              ? `${projectDoc.projectManager.firstName} ${projectDoc.projectManager.lastName}`
              : 'Unknown Manager',
            employeeEmail: projectDoc.projectManager?.email || '',
            details: `${projectDoc.name} - ${projectDoc.client?.name || 'No Client'} (${projectDoc.projectCode})`,
            requestDate: projectDoc.createdAt || inst.createdAt,
            slaDeadline: inst?.approvalChain?.find((s) => s.level === inst.currentLevel)?.sla?.dueDate,
            status: inst.status,
            projectName: projectDoc.name,
            projectCode: projectDoc.projectCode,
            client: projectDoc.client?.name || 'No Client',
            priority: projectDoc.priority,
            location: projectDoc.location
          };
        }
        return null;
      })
      .filter(Boolean);

    if (tenantConnection) await tenantConnection.close();

    res.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    if (tenantConnection) await tenantConnection.close();
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger SLA escalation check
 */
exports.triggerSLAEscalation = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found'
      });
    }

    const result = await approvalWorkflowService.checkSLAEscalations(companyId);

    res.status(200).json({
      success: true,
      message: `Checked ${result.checked} requests, escalated ${result.escalated}`,
      data: result
    });
  } catch (error) {
    console.error('Error triggering SLA escalation:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


