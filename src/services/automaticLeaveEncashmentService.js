/**
 * Automatic Leave Encashment Service
 * Handles automatic processing of leave encashment based on policy rules
 * @module services/automaticLeaveEncashmentService
 */

const { getTenantConnection } = require('../config/database.config');
const LeaveEncashmentRuleSchema = require('../models/tenant/LeaveEncashmentRule');
const LeaveEncashmentRequestSchema = require('../models/tenant/LeaveEncashmentRequest');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const TenantUserSchema = require('../models/tenant/TenantUser');
const leaveEncashmentService = require('./leaveEncashmentService');

class AutomaticLeaveEncashmentService {
  /**
   * Process automatic encashment for all companies
   */
  async processAllCompanies(triggerType = 'year_end') {
    try {
      // This would typically get all active companies from your system
      // For now, we'll assume this is called per company
      console.log(`Processing automatic encashment for trigger: ${triggerType}`);
      return { success: true, message: 'Automatic encashment processing initiated' };
    } catch (error) {
      throw new Error(`Failed to process automatic encashment: ${error.message}`);
    }
  }

  /**
   * Process automatic encashment for a specific company
   */
  async processCompanyAutomaticEncashment(companyId, triggerType = 'year_end') {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveEncashmentRule = tenantConnection.model('LeaveEncashmentRule', LeaveEncashmentRuleSchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get all automatic encashment rules
      const automaticRules = await LeaveEncashmentRule.find({
        isAutomatic: true,
        isActive: true,
        isEncashable: true,
        automaticTrigger: triggerType,
        applicableFrom: { $lte: new Date() }
      });

      if (automaticRules.length === 0) {
        if (tenantConnection) await tenantConnection.close();
        return { success: true, message: 'No automatic encashment rules found', processed: 0 };
      }

      let totalProcessed = 0;

      for (const rule of automaticRules) {
        const processed = await this.processRuleForCompany(companyId, rule, tenantConnection);
        totalProcessed += processed;
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${totalProcessed} automatic encashments`,
        processed: totalProcessed
      };
    } catch (error) {
      throw new Error(`Company automatic encashment failed: ${error.message}`);
    }
  }

  /**
   * Process a specific rule for all eligible employees
   */
  async processRuleForCompany(companyId, rule, tenantConnection) {
    try {
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      let processedCount = 0;

      // Get all active employees
      const employees = await TenantUser.find({
        status: 'active',
        email: { $exists: true }
      });

      for (const employee of employees) {
        try {
          const shouldProcess = await this.shouldProcessEmployee(employee, rule, tenantConnection);
          
          if (shouldProcess) {
            await this.processAutomaticEncashmentForEmployee(companyId, employee, rule, tenantConnection);
            processedCount++;
            console.log(`Processed automatic encashment for employee: ${employee.email}`);
          }
        } catch (error) {
          console.error(`Failed to process employee ${employee.email}:`, error.message);
          // Continue with next employee
        }
      }

      return processedCount;
    } catch (error) {
      throw new Error(`Rule processing failed: ${error.message}`);
    }
  }

  /**
   * Check if employee should be processed for automatic encashment
   */
  async shouldProcessEmployee(employee, rule, tenantConnection) {
    try {
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);

      // Check eligibility first
      const eligibility = await leaveEncashmentService.checkEligibility(
        tenantConnection.name,
        employee._id,
        rule.leaveType,
        1 // Check with 1 day initially
      );

      if (!eligibility.eligible) {
        return false;
      }

      // Get current leave balance
      const currentYear = new Date().getFullYear();
      const leaveBalance = await LeaveBalance.findOne({
        employeeEmail: employee.email,
        year: currentYear,
        leaveType: rule.leaveType
      });

      if (!leaveBalance || leaveBalance.available <= rule.minBalance) {
        return false;
      }

      // Check trigger-specific conditions
      switch (rule.automaticTrigger) {
        case 'year_end':
          return await this.checkYearEndTrigger(employee, rule, tenantConnection);
        
        case 'employment_end':
          return employee.status === 'inactive' || employee.terminationDate;
        
        case 'specific_date':
          if (!rule.automaticTriggerDate) return false;
          const today = new Date();
          const triggerDate = new Date(rule.automaticTriggerDate);
          return today.toDateString() === triggerDate.toDateString();
        
        case 'leave_balance_threshold':
          if (!rule.automaticTriggerThreshold) return false;
          return leaveBalance.available >= rule.automaticTriggerThreshold;
        
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error checking employee eligibility: ${error.message}`);
      return false;
    }
  }

  /**
   * Check year-end trigger conditions
   */
  async checkYearEndTrigger(employee, rule, tenantConnection) {
    try {
      const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
      
      const currentYear = new Date().getFullYear();
      const yearEnd = new Date(currentYear, 11, 31); // December 31st
      const today = new Date();
      
      // Only process on December 31st or within a few days before
      const daysUntilYearEnd = Math.ceil((yearEnd - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilYearEnd > 7) { // Process within 7 days of year end
        return false;
      }

      // Check if already processed this year
      const existingRequest = await LeaveEncashmentRequest.findOne({
        employeeId: employee._id,
        leaveType: rule.leaveType,
        status: { $in: ['approved', 'processed'] },
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1)
        }
      });

      return !existingRequest;
    } catch (error) {
      console.error(`Error checking year-end trigger: ${error.message}`);
      return false;
    }
  }

  /**
   * Process automatic encashment for a specific employee
   */
  async processAutomaticEncashmentForEmployee(companyId, employee, rule, tenantConnection) {
    try {
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

      // Get current leave balance
      const currentYear = new Date().getFullYear();
      const leaveBalance = await LeaveBalance.findOne({
        employeeEmail: employee.email,
        year: currentYear,
        leaveType: rule.leaveType
      });

      if (!leaveBalance) {
        throw new Error('Leave balance not found');
      }

      // Calculate days to encash
      let daysToEncash = leaveBalance.available - rule.minBalance;
      
      // Apply maximum encashment limits
      if (rule.maxEncashable > 0 && daysToEncash > rule.maxEncashable) {
        daysToEncash = rule.maxEncashable;
      }

      // Apply percentage-based limit
      if (rule.maxEncashablePercentage > 0 && rule.maxEncashablePercentage < 100) {
        const percentageBased = Math.floor((leaveBalance.available * rule.automaticEncashmentPercentage) / 100);
        daysToEncash = Math.min(daysToEncash, percentageBased);
      }

      if (daysToEncash <= 0) {
        throw new Error('No eligible days for encashment');
      }

      // Create automatic encashment request
      const reason = `Automatic leave encashment - ${rule.automaticTrigger}`;
      
      const result = await leaveEncashmentService.createEncashmentRequest(
        companyId,
        employee._id,
        rule.leaveType,
        daysToEncash,
        reason
      );

      // Mark as automatic and auto-approve if no approval required
      if (result.data) {
        const LeaveEncashmentRequest = tenantConnection.model('LeaveEncashmentRequest', LeaveEncashmentRequestSchema);
        await LeaveEncashmentRequest.findByIdAndUpdate(result.data._id, {
          isAutomatic: true,
          automaticTrigger: rule.automaticTrigger,
          status: rule.requiresApproval ? 'pending' : 'approved'
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to process automatic encashment: ${error.message}`);
    }
  }

  /**
   * Schedule automatic encashment (can be called by cron job)
   */
  async scheduleAutomaticEncashment() {
    try {
      console.log('Starting scheduled automatic encashment processing...');
      
      // Process year-end encashments
      await this.processAllCompanies('year_end');
      
      // Process specific date triggers
      await this.processAllCompanies('specific_date');
      
      // Process leave balance threshold triggers
      await this.processAllCompanies('leave_balance_threshold');
      
      console.log('Automatic encashment processing completed');
    } catch (error) {
      console.error('Scheduled automatic encashment failed:', error);
    }
  }
}

module.exports = new AutomaticLeaveEncashmentService();
