/**
 * Leave Accrual Service
 * Handles automated leave accrual calculation, pro-rata, and carry forward
 * @module services/leaveAccrualService
 */

const { getTenantConnection } = require('../config/database.config');
const LeaveAccrualPolicySchema = require('../models/tenant/LeaveAccrualPolicy');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const TenantUserSchema = require('../models/tenant/TenantUser');

class LeaveAccrualService {
  /**
   * Calculate pro-rata accrual for mid-year joiners
   */
  calculateProRata(joiningDate, policy, year) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const joinDate = new Date(joiningDate);

    if (joinDate < yearStart) {
      joinDate.setFullYear(year);
      joinDate.setMonth(0);
      joinDate.setDate(1);
    }

    if (policy.proRataCalculation === 'calendar-days') {
      const totalDays = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysWorked = Math.ceil((yearEnd - joinDate) / (1000 * 60 * 60 * 24)) + 1;
      return (policy.yearlyAllocation * daysWorked) / totalDays;
    } else if (policy.proRataCalculation === 'months') {
      const totalMonths = 12;
      const monthsWorked = 12 - joinDate.getMonth();
      return (policy.yearlyAllocation * monthsWorked) / totalMonths;
    } else {
      // working-days - simplified calculation
      const totalDays = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysWorked = Math.ceil((yearEnd - joinDate) / (1000 * 60 * 60 * 24)) + 1;
      // Assume 5 working days per week
      const workingDaysRatio = (daysWorked * 5) / (totalDays * 5);
      return policy.yearlyAllocation * workingDaysRatio;
    }
  }

  /**
   * Process monthly accrual for employees
   */
  async processMonthlyAccrual(companyId, month, year) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get active monthly accrual policies
      const policies = await LeaveAccrualPolicy.find({
        isActive: true,
        accrualFrequency: 'monthly',
        applicableFrom: { $lte: new Date(year, month - 1, 1) }
      });

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const policy of policies) {
        // Get active employees applicable for this policy
        const query = { role: 'employee', isActive: true };
        
        if (policy.applicableTo === 'specific-departments' && policy.departments.length > 0) {
          query.departmentId = { $in: policy.departments };
        }

        const employees = await TenantUser.find(query);

        for (const employee of employees) {
          try {
            // Check if employee is applicable
            if (!this.isEmployeeApplicable(employee, policy)) {
              continue;
            }

            // Get or create leave balance
            let balance = await LeaveBalance.findOne({
              employeeEmail: employee.email,
              year: year,
              leaveType: policy.leaveType
            });

            if (!balance) {
              balance = new LeaveBalance({
                employeeId: employee._id,
                employeeEmail: employee.email,
                year: year,
                leaveType: policy.leaveType,
                accrued: 0,
                consumed: 0,
                carriedForward: 0
              });
            }

            // Check if already accrued for this month
            const lastAccrual = balance.lastAccrualDate;
            if (lastAccrual) {
              const lastAccrualMonth = lastAccrual.getMonth() + 1;
              const lastAccrualYear = lastAccrual.getFullYear();
              if (lastAccrualMonth === month && lastAccrualYear === year) {
                continue; // Already accrued for this month
              }
            }

            // Calculate accrual amount
            let accrualAmount = policy.accrualAmount;

            // Apply pro-rata if enabled and employee joined mid-year
            if (policy.proRataEnabled && employee.joiningDate) {
              const joiningDate = new Date(employee.joiningDate);
              if (joiningDate.getFullYear() === year && joiningDate.getMonth() + 1 === month) {
                // First month accrual - apply pro-rata for partial month
                const daysInMonth = new Date(year, month, 0).getDate();
                const daysWorked = daysInMonth - joiningDate.getDate() + 1;
                accrualAmount = (policy.accrualAmount * daysWorked) / daysInMonth;
              }
            }

            // Update balance
            balance.accrued += accrualAmount;
            balance.lastAccrualDate = new Date(year, month - 1, policy.accrualDay || 1);

            // Add to accrual history
            if (!balance.accrualHistory) {
              balance.accrualHistory = [];
            }
            balance.accrualHistory.push({
              accrualDate: new Date(year, month - 1, policy.accrualDay || 1),
              amount: accrualAmount,
              type: 'regular',
              notes: `Monthly accrual for ${month}/${year}`
            });

            // Check max accumulation
            if (policy.maxAccumulation > 0 && balance.total > policy.maxAccumulation) {
              const excess = balance.total - policy.maxAccumulation;
              balance.lapsed += excess;
              balance.accrued -= excess;
            }

            await balance.save();
            results.success++;
            results.total++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              employee: employee.email,
              leaveType: policy.leaveType,
              error: error.message
            });
          }
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${results.success}/${results.total} accruals`,
        data: results
      };
    } catch (error) {
      throw new Error(`Monthly accrual processing failed: ${error.message}`);
    }
  }

  /**
   * Process yearly accrual for employees
   */
  async processYearlyAccrual(companyId, year) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      // Get active yearly accrual policies
      const policies = await LeaveAccrualPolicy.find({
        isActive: true,
        accrualFrequency: 'yearly',
        applicableFrom: { $lte: new Date(year, 0, 1) }
      });

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const policy of policies) {
        const employees = await TenantUser.find({ role: 'employee', isActive: true });

        for (const employee of employees) {
          try {
            if (!this.isEmployeeApplicable(employee, policy)) {
              continue;
            }

            // Get or create leave balance
            let balance = await LeaveBalance.findOne({
              employeeEmail: employee.email,
              year: year,
              leaveType: policy.leaveType
            });

            if (!balance) {
              balance = new LeaveBalance({
                employeeId: employee._id,
                employeeEmail: employee.email,
                year: year,
                leaveType: policy.leaveType,
                accrued: 0,
                consumed: 0,
                carriedForward: 0
              });
            }

            // Calculate accrual amount
            let accrualAmount = policy.yearlyAllocation || policy.accrualAmount;

            // Apply pro-rata if enabled
            if (policy.proRataEnabled && employee.joiningDate) {
              const joiningDate = new Date(employee.joiningDate);
              if (joiningDate.getFullYear() === year) {
                accrualAmount = this.calculateProRata(joiningDate, policy, year);
              }
            }

            // Update balance
            balance.accrued = accrualAmount;
            balance.lastAccrualDate = new Date(year, policy.accrualMonth - 1 || 0, policy.accrualDay || 1);

            // Add to accrual history
            if (!balance.accrualHistory) {
              balance.accrualHistory = [];
            }
            balance.accrualHistory.push({
              accrualDate: new Date(year, policy.accrualMonth - 1 || 0, policy.accrualDay || 1),
              amount: accrualAmount,
              type: policy.proRataEnabled ? 'pro-rata' : 'regular',
              notes: `Yearly accrual for ${year}`
            });

            await balance.save();
            results.success++;
            results.total++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              employee: employee.email,
              leaveType: policy.leaveType,
              error: error.message
            });
          }
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${results.success}/${results.total} yearly accruals`,
        data: results
      };
    } catch (error) {
      throw new Error(`Yearly accrual processing failed: ${error.message}`);
    }
  }

  /**
   * Process carry forward at year-end
   */
  async processCarryForward(companyId, fromYear, toYear) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

      // Get policies with carry forward enabled
      const policies = await LeaveAccrualPolicy.find({
        isActive: true,
        carryForwardEnabled: true
      });

      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const policy of policies) {
        // Get balances from previous year
        const previousBalances = await LeaveBalance.find({
          year: fromYear,
          leaveType: policy.leaveType,
          available: { $gt: 0 }
        });

        for (const prevBalance of previousBalances) {
          try {
            const availableToCarry = Math.min(prevBalance.available, policy.maxCarryForward || prevBalance.available);
            const toLapse = prevBalance.available - availableToCarry;

            // Update previous year balance
            prevBalance.lapsed += toLapse;
            prevBalance.available -= availableToCarry;
            await prevBalance.save();

            // Get or create current year balance
            let currentBalance = await LeaveBalance.findOne({
              employeeEmail: prevBalance.employeeEmail,
              year: toYear,
              leaveType: policy.leaveType
            });

            if (!currentBalance) {
              currentBalance = new LeaveBalance({
                employeeId: prevBalance.employeeId,
                employeeEmail: prevBalance.employeeEmail,
                year: toYear,
                leaveType: policy.leaveType,
                accrued: 0,
                consumed: 0,
                carriedForward: 0
              });
            }

            // Add carry forward
            currentBalance.carriedForward = availableToCarry;

            // Add to accrual history
            if (!currentBalance.accrualHistory) {
              currentBalance.accrualHistory = [];
            }
            currentBalance.accrualHistory.push({
              accrualDate: new Date(toYear, 0, 1),
              amount: availableToCarry,
              type: 'carry-forward',
              notes: `Carried forward from ${fromYear}`
            });

            await currentBalance.save();
            results.success++;
            results.total++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              employee: prevBalance.employeeEmail,
              leaveType: policy.leaveType,
              error: error.message
            });
          }
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${results.success}/${results.total} carry forwards`,
        data: results
      };
    } catch (error) {
      throw new Error(`Carry forward processing failed: ${error.message}`);
    }
  }

  /**
   * Process carry forward expiry
   */
  async processCarryForwardExpiry(companyId, year, month) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);

      const policies = await LeaveAccrualPolicy.find({
        isActive: true,
        carryForwardEnabled: true,
        carryForwardExpiry: { $gt: 0 }
      });

      const results = {
        total: 0,
        lapsed: 0,
        errors: []
      };

      for (const policy of policies) {
        const balances = await LeaveBalance.find({
          year: year,
          leaveType: policy.leaveType,
          carriedForward: { $gt: 0 }
        });

        for (const balance of balances) {
          try {
            // Check if carry forward has expired
            const yearEnd = new Date(year, 11, 31);
            const expiryDate = new Date(yearEnd);
            expiryDate.setMonth(expiryDate.getMonth() + policy.carryForwardExpiry);

            const currentDate = new Date(year, month - 1, 1);
            if (currentDate > expiryDate) {
              // Carry forward has expired
              balance.lapsed += balance.carriedForward;
              balance.carriedForward = 0;

              if (!balance.accrualHistory) {
                balance.accrualHistory = [];
              }
              balance.accrualHistory.push({
                accrualDate: currentDate,
                amount: -balance.lapsed,
                type: 'adjustment',
                notes: `Carry forward expired after ${policy.carryForwardExpiry} months`
              });

              await balance.save();
              results.lapsed++;
              results.total++;
            }
          } catch (error) {
            results.errors.push({
              employee: balance.employeeEmail,
              error: error.message
            });
          }
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Processed ${results.lapsed} expired carry forwards`,
        data: results
      };
    } catch (error) {
      throw new Error(`Carry forward expiry processing failed: ${error.message}`);
    }
  }

  /**
   * Check if employee is applicable for policy
   */
  isEmployeeApplicable(employee, policy) {
    if (policy.applicableTo === 'all') {
      return true;
    }

    if (policy.applicableTo === 'specific-departments') {
      return policy.departments.some(dept => dept.toString() === employee.departmentId?.toString());
    }

    if (policy.applicableTo === 'specific-designations') {
      return policy.designations.includes(employee.designation);
    }

    if (policy.applicableTo === 'specific-locations') {
      return policy.locations.includes(employee.location);
    }

    return false;
  }

  /**
   * Initialize leave balances for employee based on policies
   */
  async initializeEmployeeBalances(companyId, employeeId, year) {
    try {
      const tenantConnection = await getTenantConnection(companyId);
      const LeaveAccrualPolicy = tenantConnection.model('LeaveAccrualPolicy', LeaveAccrualPolicySchema);
      const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
      const TenantUser = tenantConnection.model('User', TenantUserSchema);

      const employee = await TenantUser.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policies = await LeaveAccrualPolicy.find({
        isActive: true,
        applicableFrom: { $lte: new Date(year, 0, 1) }
      });

      const results = {
        created: 0,
        updated: 0,
        errors: []
      };

      for (const policy of policies) {
        try {
          if (!this.isEmployeeApplicable(employee, policy)) {
            continue;
          }

          let balance = await LeaveBalance.findOne({
            employeeEmail: employee.email,
            year: year,
            leaveType: policy.leaveType
          });

          if (!balance) {
            let initialAmount = 0;

            if (policy.accrualFrequency === 'yearly') {
              initialAmount = policy.yearlyAllocation || policy.accrualAmount;
              if (policy.proRataEnabled && employee.joiningDate) {
                initialAmount = this.calculateProRata(employee.joiningDate, policy, year);
              }
            }

            balance = new LeaveBalance({
              employeeId: employee._id,
              employeeEmail: employee.email,
              year: year,
              leaveType: policy.leaveType,
              accrued: initialAmount,
              consumed: 0,
              carriedForward: 0,
              lastAccrualDate: new Date(year, 0, 1)
            });

            if (initialAmount > 0) {
              balance.accrualHistory = [{
                accrualDate: new Date(year, 0, 1),
                amount: initialAmount,
                type: policy.proRataEnabled ? 'pro-rata' : 'regular',
                notes: `Initial allocation for ${year}`
              }];
            }

            await balance.save();
            results.created++;
          } else {
            results.updated++;
          }
        } catch (error) {
          results.errors.push({
            leaveType: policy.leaveType,
            error: error.message
          });
        }
      }

      if (tenantConnection) await tenantConnection.close();

      return {
        success: true,
        message: `Initialized ${results.created} balances, updated ${results.updated}`,
        data: results
      };
    } catch (error) {
      throw new Error(`Balance initialization failed: ${error.message}`);
    }
  }
}

module.exports = new LeaveAccrualService();


