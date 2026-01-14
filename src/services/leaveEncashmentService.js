/**
 * Leave Encashment Service
 * Handles eligibility validation, amount calculation, and payroll integration
 * @module services/leaveEncashmentService
 */

const { getTenantConnection } = require('../config/database.config');
const LeaveEncashmentRuleSchema = require('../models/tenant/LeaveEncashmentRule');
const LeaveEncashmentRequestSchema = require('../models/tenant/LeaveEncashmentRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const TenantUserSchema = require('../models/tenant/TenantUser');
const approvalWorkflowService = require('./approvalWorkflowService');

class LeaveEncashmentService {
  /**
   * Check eligibility for leave encashment
   */
  async checkEligibility(companyId, employeeId, leaveType, numberOfDays) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get encashment rule
      const rule = await LeaveEncashmentRule.findOne({
        leaveType: leaveType,
        isActive: true,
        isEncashable: true,
        applicableFrom: { $lte: new Date() }
      });

      if (!rule) {
        return {
          eligible: false,
          reason: 'No encashment rule found for this leave type'
        };
      }

      // Get employee details
      const employee = await TenantUser.findById(employeeId);
      if (!employee) {
        return {
          eligible: false,
          reason: 'Employee not found'
        };
      }

      // Check service period
      if (rule.eligibilityCriteria.minServicePeriod > 0) {
        const joiningDate = new Date(employee.joiningDate);
        const monthsOfService = (new Date() - joiningDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsOfService < rule.eligibilityCriteria.minServicePeriod) {
          return {
            eligible: false,
            reason: `Minimum service period of ${rule.eligibilityCriteria.minServicePeriod} months required`
          };
        }
      }

      // Check probationary status
      if (rule.eligibilityCriteria.excludeProbationary && employee.probationary) {
        return {
          eligible: false,
          reason: 'Employees on probation are not eligible for encashment'
        };
      }

      // Check employment type
      if (rule.eligibilityCriteria.excludeContract && employee.employmentType === 'contract') {
        return {
          eligible: false,
          reason: 'Contract employees are not eligible for encashment'
        };
      }

      // Check department/designation/location restrictions
      if (rule.applicableTo === 'specific-departments') {
        if (!rule.eligibilityCriteria.allowedDepartments.some(dept => dept.toString() === employee.departmentId?.toString())) {
          return {
            eligible: false,
            reason: 'Employee department not eligible for encashment'
          };
        }
      }

      if (rule.applicableTo === 'specific-designations') {
        if (!rule.eligibilityCriteria.allowedDesignations.includes(employee.designation)) {
          return {
            eligible: false,
            reason: 'Employee designation not eligible for encashment'
          };
        }
      }

      // Get leave balance
      const currentYear = new Date().getFullYear();
      const leaveBalance = await LeaveBalance.findOne({
        employeeEmail: employee.email,
        year: currentYear,
        leaveType: leaveType
      });

      if (!leaveBalance || leaveBalance.available < rule.minBalance) {
        return {
          eligible: false,
          reason: `Minimum balance of ${rule.minBalance} days required`
        };
      }

      // Check if requested days are available
      if (leaveBalance.available < numberOfDays) {
        return {
          eligible: false,
          reason: `Insufficient leave balance. Available: ${leaveBalance.available} days`
        };
      }

      // Check minimum balance after encashment
      const balanceAfterEncashment = leaveBalance.available - numberOfDays;
      if (balanceAfterEncashment < rule.eligibilityCriteria.minBalanceAfterEncashment) {
        return {
          eligible: false,
          reason: `Minimum balance of ${rule.eligibilityCriteria.minBalanceAfterEncashment} days must be maintained after encashment`
        };
      }

      // Check max encashable
      let maxEncashable = rule.maxEncashable;
      if (rule.maxEncashablePercentage > 0 && rule.maxEncashablePercentage < 100) {
        const percentageBased = (leaveBalance.available * rule.maxEncashablePercentage) / 100;
        if (maxEncashable === 0 || percentageBased < maxEncashable) {
          maxEncashable = percentageBased;
        }
      }

      if (maxEncashable > 0 && numberOfDays > maxEncashable) {
        return {
          eligible: false,
          reason: `Maximum ${maxEncashable} days can be encashed`
        };
      }

      // Check max encashments per year
      if (rule.eligibilityCriteria.maxEncashmentsPerYear > 0) {
        const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);
        
        const existingRequests = await LeaveEncashmentRequest.countDocuments({
          employeeId: employeeId,
          leaveType: leaveType,
          status: { $in: ['approved', 'processed'] },
          appliedOn: { $gte: yearStart, $lte: yearEnd }
        });

        if (existingRequests >= rule.eligibilityCriteria.maxEncashmentsPerYear) {
          return {
            eligible: false,
            reason: `Maximum ${rule.eligibilityCriteria.maxEncashmentsPerYear} encashments allowed per year`
          };
        }
      }

      return {
        eligible: true,
        rule: rule,
        leaveBalance: leaveBalance
      };
    } catch (error) {
      throw new Error(`Eligibility check failed: ${error.message}`);
    }
  }

  /**
   * Calculate encashment amount
   */
  async calculateEncashmentAmount(companyId, employeeId, leaveType, numberOfDays, rule) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const employee = await TenantUser.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      let ratePerDay = 0;

      switch (rule.calculationMethod) {
        case 'fixed_rate':
          ratePerDay = rule.ratePerDay;
          break;

        case 'basic_salary':
          // Get basic salary from employee or payroll
          const basicSalary = employee.salary?.basic || 0;
          const daysInMonth = 30; // Standard calculation
          ratePerDay = basicSalary / daysInMonth;
          break;

        case 'gross_salary':
          const grossSalary = employee.salary?.total || employee.salary?.basic || 0;
          const daysInMonthGross = 30;
          ratePerDay = grossSalary / daysInMonthGross;
          break;

        case 'custom':
          // Custom calculation logic can be added here
          ratePerDay = rule.ratePerDay || 0;
          break;

        default:
          throw new Error(`Unknown calculation method: ${rule.calculationMethod}`);
      }

      const totalAmount = ratePerDay * numberOfDays;

      return {
        ratePerDay: ratePerDay,
        totalAmount: totalAmount,
        numberOfDays: numberOfDays
      };
    } catch (error) {
      throw new Error(`Amount calculation failed: ${error.message}`);
    }
  }

  /**
   * Create encashment request
   */
  async createEncashmentRequest(companyId, employeeId, leaveType, numberOfDays, reason) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

      // Check eligibility
      const eligibility = await this.checkEligibility(companyId, employeeId, leaveType, numberOfDays);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }

      const rule = eligibility.rule;
      const leaveBalance = eligibility.leaveBalance;

      // Calculate amount
      const calculation = await this.calculateEncashmentAmount(companyId, employeeId, leaveType, numberOfDays, rule);

      // Get employee details
      const employee = await TenantUser.findById(employeeId);

      // Initialize approval workflow if required
      let workflowData = null;
      if (rule.requiresApproval) {
        workflowData = await approvalWorkflowService.initializeWorkflow(
          companyId,
          'leave_encashment',
          null,
          { leaveType, amount: calculation.totalAmount },
          employeeId
        );
      }

      // Create request
      const request = new LeaveEncashmentRequest({
        employeeId: employeeId,
        employeeEmail: employee.email,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        leaveType: leaveType,
        numberOfDays: numberOfDays,
        ratePerDay: calculation.ratePerDay,
        totalAmount: calculation.totalAmount,
        reason: reason,
        status: rule.requiresApproval ? 'pending' : 'approved',
        workflowId: workflowData?.workflowId || null,
        currentLevel: workflowData ? 1 : 0,
        approvalLevels: workflowData?.approvalLevels || [],
        slaDeadline: workflowData?.slaDeadline || null,
        leaveBalanceAtRequest: {
          total: leaveBalance.total,
          available: leaveBalance.available,
          consumed: leaveBalance.consumed
        }
      });

      await request.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: 'Encashment request created successfully',
        data: request
      };
    } catch (error) {
      throw new Error(`Failed to create encashment request: ${error.message}`);
    }
  }

  /**
   * Process approved encashment for payroll
   */
  async processForPayroll(companyId, requestId, payrollReference, payrollMonth, payrollYear) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      const Payroll = require('../models/Payroll');

      const request = await LeaveEncashmentRequest.findById(requestId);
      if (!request) {
        throw new Error('Encashment request not found');
      }

      if (request.status !== 'approved') {
        throw new Error('Only approved requests can be processed for payroll');
      }

      if (request.payrollProcessed) {
        throw new Error('Request already processed for payroll');
      }

      // Get employee to find Employee model reference
      const employee = await TenantUser.findById(request.employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Find or create payroll record for the month
      const month = payrollMonth || new Date().getMonth() + 1;
      const year = payrollYear || new Date().getFullYear();

      let payroll = await Payroll.findOne({
        employee: employee.employeeId || employee._id, // Adjust based on your Employee model reference
        month: month,
        year: year
      });

      if (payroll) {
        // Add encashment to bonus or other allowances
        if (!payroll.bonus) payroll.bonus = 0;
        payroll.bonus += request.totalAmount;
        payroll.totalEarnings += request.totalAmount;
        payroll.netSalary += request.totalAmount;
        await payroll.save();
      } else {
        // Create payroll record with encashment
        // Note: This is a simplified version - actual payroll creation should use payroll service
        console.log(`Payroll record not found for ${month}/${year}. Encashment amount: ${request.totalAmount}`);
      }

      // Update request
      request.payrollProcessed = true;
      request.payrollReference = payrollReference;
      request.payrollProcessedAt = new Date();
      request.status = 'processed';
      request.payrollProcessedBy = request.approvalLevels[request.approvalLevels.length - 1]?.approverId;

      // Deduct leave balance
      const currentYear = new Date().getFullYear();
      const leaveBalance = await LeaveBalance.findOne({
        employeeEmail: request.employeeEmail,
        year: currentYear,
        leaveType: request.leaveType
      });

      if (leaveBalance) {
        leaveBalance.consumed += request.numberOfDays;
        leaveBalance.available = leaveBalance.total - leaveBalance.consumed;
        await leaveBalance.save();
      }

      await request.save();

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: 'Encashment processed for payroll successfully',
        data: request,
        payrollUpdated: !!payroll
      };
    } catch (error) {
      throw new Error(`Payroll processing failed: ${error.message}`);
    }
  }
}

module.exports = new LeaveEncashmentService();

