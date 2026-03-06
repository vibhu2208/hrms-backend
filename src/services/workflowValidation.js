/**
 * Workflow validation (server-side)
 * Enforces HRMS approval hierarchy rules and returns structured errors/warnings.
 *
 * Hierarchy (strict):
 * employee(1) -> hr(2) -> manager(3) -> admin(4)
 *
 * Notes:
 * - We allow skipping intermediate roles as long as hierarchy never decreases.
 * - Sequential steps cannot repeat the same hierarchy role.
 */

const ROLE_LEVEL = Object.freeze({
  employee: 1,
  hr: 2,
  manager: 3,
  admin: 4
});

const CANONICAL_ROLES = new Set(Object.keys(ROLE_LEVEL));
const APPROVER_TO_CANONICAL_ROLE = Object.freeze({
  employee: 'employee',
  hr: 'hr',
  manager: 'manager',
  admin: 'admin',
  company_admin: 'admin'
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRole(input) {
  if (!input) return null;
  const role = String(input).toLowerCase();
  if (APPROVER_TO_CANONICAL_ROLE[role]) return APPROVER_TO_CANONICAL_ROLE[role];
  if (CANONICAL_ROLES.has(role)) return role;
  return null;
}

function getRoleLevel(role) {
  if (!role) return null;
  return ROLE_LEVEL[role] ?? null;
}

/**
 * Extract canonical steps from workflow payload.
 * Supports new `steps[]` and legacy `approvalSteps[]` / `levels[]`.
 */
function extractSteps(workflow) {
  if (Array.isArray(workflow?.steps) && workflow.steps.length > 0) {
    return workflow.steps.map((s, idx) => ({
      index: idx,
      role: normalizeRole(s.role),
      mode: s.mode || s.approvalMode || 'sequential',
      escalationRole: normalizeRole(s.escalation?.escalateToRole || s.escalateTo),
      raw: s
    }));
  }

  const legacy = asArray(workflow?.approvalSteps).length
    ? workflow.approvalSteps
    : asArray(workflow?.levels);

  return legacy.map((s, idx) => ({
    index: idx,
    role: normalizeRole(s.role || s.approverRole || s.approverType),
    mode: s.mode || s.approvalMode || 'sequential',
    escalationRole: normalizeRole(s.escalation?.escalateToRole || s.escalateTo),
    raw: s
  }));
}

function pushError(errors, code, message, meta = {}) {
  errors.push({ severity: 'error', code, message, ...meta });
}

function pushWarning(warnings, code, message, meta = {}) {
  warnings.push({ severity: 'warning', code, message, ...meta });
}

/**
 * Validate a workflow payload.
 * Returns machine-readable errors/warnings and a boolean `isValid`.
 */
function validateWorkflow(workflow) {
  const errors = [];
  const warnings = [];

  const name = (workflow?.workflowName || workflow?.name || '').trim();
  const description = (workflow?.description || '').trim();

  if (!name) {
    pushError(errors, 'WORKFLOW_NAME_REQUIRED', 'Workflow name is required.');
  } else if (name.length > 50) {
    pushError(errors, 'WORKFLOW_NAME_TOO_LONG', 'Workflow name must be 50 characters or less.', {
      field: 'name',
      limit: 50
    });
  }

  if (description.length > 200) {
    pushError(errors, 'WORKFLOW_DESCRIPTION_TOO_LONG', 'Description must be 200 characters or less.', {
      field: 'description',
      limit: 200
    });
  }

  // Applies-to: accept either new appliesTo or legacy requestType/entityType
  const appliesTo = workflow?.appliesTo || workflow?.requestType || workflow?.entityType;
  if (!appliesTo) {
    pushError(errors, 'WORKFLOW_APPLIES_TO_REQUIRED', 'Applies To is required (request type).', {
      field: 'appliesTo'
    });
  }

  // Validate steps
  const steps = extractSteps(workflow);
  if (steps.length === 0) {
    pushError(errors, 'WORKFLOW_STEPS_REQUIRED', 'Workflow must include at least one approval step.');
    return { isValid: false, errors, warnings, derived: { stepsCount: 0 } };
  }

  // Step role + hierarchy ordering (upward-only, no auto-assigned baseline)
  let prevLevel = -1; // workflows can start from any role
  const sequentialRolesSeen = new Set();

  steps.forEach((step) => {
    const stepLabel = `Step ${step.index + 1}`;
    const role = step.role;
    const level = getRoleLevel(role);
    const mode = String(step.mode || 'sequential').toLowerCase();

    if (!role) {
      pushError(errors, 'STEP_ROLE_REQUIRED', `${stepLabel}: Role is required (Employee/HR/Manager/Admin).`, {
        stepIndex: step.index,
        field: 'role'
      });
      return;
    }

    if (!level) {
      pushError(errors, 'STEP_ROLE_UNKNOWN', `${stepLabel}: Unknown role '${step.raw?.role || step.raw?.approverType || role}'.`, {
        stepIndex: step.index
      });
      return;
    }

    if (level < prevLevel) {
      pushError(
        errors,
        'HIERARCHY_DECREASED',
        `${stepLabel} violates hierarchy: role '${role}' cannot come after a higher role.`,
        { stepIndex: step.index, previousLevel: prevLevel, currentLevel: level }
      );
    } else {
      prevLevel = level;
    }

    // Sequential duplicate rule (only applies to sequential-mode steps)
    if (mode === 'sequential') {
      if (sequentialRolesSeen.has(role)) {
        pushError(
          errors,
          'SEQUENTIAL_DUPLICATE_ROLE',
          `Sequential flow cannot contain duplicate roles. Duplicate: '${role}'.`,
          { stepIndex: step.index, role }
        );
      } else {
        sequentialRolesSeen.add(role);
      }
    }

    // Escalation validation (must be higher)
    if (step.escalationRole) {
      const escLevel = getRoleLevel(step.escalationRole);
      if (!escLevel) {
        pushError(
          errors,
          'ESCALATION_ROLE_UNKNOWN',
          `${stepLabel}: Escalation target role is invalid.`,
          { stepIndex: step.index, field: 'escalation.escalateToRole' }
        );
      } else if (escLevel <= level) {
        pushError(
          errors,
          'ESCALATION_NOT_UPWARD',
          `${stepLabel}: Escalation target must be higher than the step role.`,
          { stepIndex: step.index, stepRole: role, escalationRole: step.escalationRole }
        );
      }
    } else {
      pushWarning(warnings, 'ESCALATION_MISSING', `${stepLabel}: No escalation target defined.`, {
        stepIndex: step.index
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    derived: {
      stepsCount: steps.length
    }
  };
}

module.exports = {
  ROLE_LEVEL,
  normalizeRole,
  extractSteps,
  validateWorkflow
};

