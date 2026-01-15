/**
 * PF (Provident Fund) Calculation Service
 * Handles EPF, EPS, and admin charges calculation as per Indian regulations
 */

class PFCalculationService {
  /**
   * Calculate PF for an employee
   * @param {Number} basicSalary - Basic salary of employee
   * @param {Object} config - Statutory configuration
   * @returns {Object} PF breakdown
   */
  calculatePF(basicSalary, config = {}) {
    // Default PF configuration (as per Indian regulations)
    const pfConfig = {
      enabled: config.enabled !== false,
      pfCeiling: config.pfCeiling || 15000,
      employeeRate: config.employeeRate || 12,
      epsRate: config.epsRate || 8.33,
      epfRate: config.epfRate || 3.67,
      adminChargesRate: config.adminChargesRate || 0.5,
      edliChargesRate: config.edliChargesRate || 0.5
    };

    if (!pfConfig.enabled) {
      return this.getZeroPF();
    }

    // Cap basic salary at PF ceiling (₹15,000)
    const cappedBasic = Math.min(basicSalary, pfConfig.pfCeiling);

    // Employee contribution: 12% of basic (capped)
    const employeeContribution = Math.round((cappedBasic * pfConfig.employeeRate) / 100);

    // Employer contribution breakdown:
    // 1. EPS (Employee Pension Scheme): 8.33% of basic (capped)
    const epsContribution = Math.round((cappedBasic * pfConfig.epsRate) / 100);

    // 2. EPF (Employee Provident Fund): 3.67% of basic (capped)
    const epfContribution = Math.round((cappedBasic * pfConfig.epfRate) / 100);

    // 3. Admin charges: 0.5% of basic (capped)
    const adminCharges = Math.round((cappedBasic * pfConfig.adminChargesRate) / 100);

    // 4. EDLI (Employee Deposit Linked Insurance): 0.5% of basic (capped)
    const edliCharges = Math.round((cappedBasic * pfConfig.edliChargesRate) / 100);

    // Total employer contribution
    const employerContribution = epsContribution + epfContribution + adminCharges + edliCharges;

    return {
      basicSalary,
      cappedBasic,
      employee: {
        contribution: employeeContribution,
        rate: pfConfig.employeeRate
      },
      employer: {
        eps: epsContribution,
        epf: epfContribution,
        admin: adminCharges,
        edli: edliCharges,
        total: employerContribution
      },
      total: employeeContribution + employerContribution,
      breakdown: {
        employeeContribution,
        epsContribution,
        epfContribution,
        adminCharges,
        edliCharges,
        totalEmployerContribution: employerContribution,
        grandTotal: employeeContribution + employerContribution
      }
    };
  }

  /**
   * Calculate PF for multiple employees
   */
  calculateBulkPF(employees, config) {
    return employees.map(emp => ({
      employeeId: emp.employeeId,
      employeeName: emp.name,
      basicSalary: emp.basicSalary,
      pf: this.calculatePF(emp.basicSalary, config)
    }));
  }

  /**
   * Get PF summary for a month
   */
  getPFSummary(pfCalculations) {
    const summary = {
      totalEmployees: pfCalculations.length,
      totalEmployeeContribution: 0,
      totalEPS: 0,
      totalEPF: 0,
      totalAdmin: 0,
      totalEDLI: 0,
      totalEmployerContribution: 0,
      grandTotal: 0
    };

    pfCalculations.forEach(calc => {
      const pf = calc.pf;
      summary.totalEmployeeContribution += pf.employee.contribution;
      summary.totalEPS += pf.employer.eps;
      summary.totalEPF += pf.employer.epf;
      summary.totalAdmin += pf.employer.admin;
      summary.totalEDLI += pf.employer.edli;
      summary.totalEmployerContribution += pf.employer.total;
      summary.grandTotal += pf.total;
    });

    return summary;
  }

  /**
   * Validate PF calculation
   */
  validatePF(basicSalary) {
    const errors = [];
    const warnings = [];

    if (!basicSalary || basicSalary <= 0) {
      errors.push('Basic salary must be greater than zero');
    }

    if (basicSalary > 15000) {
      warnings.push(`Basic salary (₹${basicSalary}) exceeds PF ceiling (₹15,000). PF will be calculated on ₹15,000`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get zero PF (when PF is not applicable)
   */
  getZeroPF() {
    return {
      basicSalary: 0,
      cappedBasic: 0,
      employee: {
        contribution: 0,
        rate: 0
      },
      employer: {
        eps: 0,
        epf: 0,
        admin: 0,
        edli: 0,
        total: 0
      },
      total: 0,
      breakdown: {
        employeeContribution: 0,
        epsContribution: 0,
        epfContribution: 0,
        adminCharges: 0,
        edliCharges: 0,
        totalEmployerContribution: 0,
        grandTotal: 0
      }
    };
  }

  /**
   * Generate PF challan data
   */
  generatePFChallan(pfSummary, month, year, companyDetails) {
    return {
      month,
      year,
      company: {
        name: companyDetails.name,
        pfNumber: companyDetails.pfNumber,
        address: companyDetails.address
      },
      summary: pfSummary,
      challanDetails: {
        employeeShare: pfSummary.totalEmployeeContribution,
        employerEPFShare: pfSummary.totalEPF,
        employerEPSShare: pfSummary.totalEPS,
        adminCharges: pfSummary.totalAdmin,
        edliCharges: pfSummary.totalEDLI,
        total: pfSummary.grandTotal
      },
      dueDate: this.getPFDueDate(month, year),
      generatedAt: new Date()
    };
  }

  /**
   * Get PF due date (15th of next month)
   */
  getPFDueDate(month, year) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return new Date(nextYear, nextMonth - 1, 15);
  }
}

module.exports = new PFCalculationService();
