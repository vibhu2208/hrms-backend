/**
 * ESI (Employee State Insurance) Calculation Service
 * Handles ESI calculation as per Indian regulations
 */

class ESICalculationService {
  /**
   * Calculate ESI for an employee
   * @param {Number} grossSalary - Gross salary of employee
   * @param {Object} config - ESI configuration
   * @returns {Object} ESI breakdown
   */
  calculateESI(grossSalary, config = {}) {
    // Default ESI configuration (as per Indian regulations)
    const esiConfig = {
      enabled: config.enabled !== false,
      wageLimit: config.wageLimit || 21000, // ESI applicable if gross <= ₹21,000
      employeeRate: config.employeeRate || 0.75, // 0.75%
      employerRate: config.employerRate || 3.25  // 3.25%
    };

    // ESI not applicable if disabled or salary exceeds wage limit
    if (!esiConfig.enabled || grossSalary > esiConfig.wageLimit) {
      return {
        applicable: false,
        reason: grossSalary > esiConfig.wageLimit 
          ? `Gross salary (₹${grossSalary}) exceeds ESI wage limit (₹${esiConfig.wageLimit})`
          : 'ESI is disabled',
        grossSalary,
        employee: 0,
        employer: 0,
        total: 0
      };
    }

    // Calculate contributions
    const employeeContribution = Math.round((grossSalary * esiConfig.employeeRate) / 100);
    const employerContribution = Math.round((grossSalary * esiConfig.employerRate) / 100);

    return {
      applicable: true,
      grossSalary,
      employee: {
        contribution: employeeContribution,
        rate: esiConfig.employeeRate
      },
      employer: {
        contribution: employerContribution,
        rate: esiConfig.employerRate
      },
      total: employeeContribution + employerContribution,
      breakdown: {
        employeeContribution,
        employerContribution,
        totalContribution: employeeContribution + employerContribution
      }
    };
  }

  /**
   * Calculate ESI for multiple employees
   */
  calculateBulkESI(employees, config) {
    return employees.map(emp => ({
      employeeId: emp.employeeId,
      employeeName: emp.name,
      grossSalary: emp.grossSalary,
      esi: this.calculateESI(emp.grossSalary, config)
    }));
  }

  /**
   * Get ESI summary for a month
   */
  getESISummary(esiCalculations) {
    const summary = {
      totalEmployees: 0,
      applicableEmployees: 0,
      nonApplicableEmployees: 0,
      totalEmployeeContribution: 0,
      totalEmployerContribution: 0,
      grandTotal: 0
    };

    esiCalculations.forEach(calc => {
      const esi = calc.esi;
      if (esi.applicable) {
        summary.applicableEmployees++;
        summary.totalEmployeeContribution += esi.employee.contribution;
        summary.totalEmployerContribution += esi.employer.contribution;
        summary.grandTotal += esi.total;
      } else {
        summary.nonApplicableEmployees++;
      }
      summary.totalEmployees++;
    });

    return summary;
  }

  /**
   * Validate ESI calculation
   */
  validateESI(grossSalary, wageLimit = 21000) {
    const errors = [];
    const warnings = [];

    if (!grossSalary || grossSalary <= 0) {
      errors.push('Gross salary must be greater than zero');
    }

    if (grossSalary > wageLimit) {
      warnings.push(`Gross salary (₹${grossSalary}) exceeds ESI wage limit (₹${wageLimit}). ESI not applicable.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if employee is eligible for ESI
   */
  isEligible(grossSalary, wageLimit = 21000) {
    return grossSalary > 0 && grossSalary <= wageLimit;
  }

  /**
   * Generate ESI challan data
   */
  generateESIChallan(esiSummary, month, year, companyDetails) {
    return {
      month,
      year,
      company: {
        name: companyDetails.name,
        esiNumber: companyDetails.esiNumber,
        address: companyDetails.address
      },
      summary: esiSummary,
      challanDetails: {
        employeeShare: esiSummary.totalEmployeeContribution,
        employerShare: esiSummary.totalEmployerContribution,
        total: esiSummary.grandTotal,
        applicableEmployees: esiSummary.applicableEmployees
      },
      dueDate: this.getESIDueDate(month, year),
      generatedAt: new Date()
    };
  }

  /**
   * Get ESI due date (15th of next month)
   */
  getESIDueDate(month, year) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return new Date(nextYear, nextMonth - 1, 15);
  }

  /**
   * Get ESI contribution history
   */
  getContributionHistory(employeeId, startDate, endDate, contributions) {
    return contributions.filter(c => 
      c.employeeId === employeeId &&
      c.date >= startDate &&
      c.date <= endDate &&
      c.esi.applicable
    ).map(c => ({
      month: c.month,
      year: c.year,
      grossSalary: c.grossSalary,
      employeeContribution: c.esi.employee.contribution,
      employerContribution: c.esi.employer.contribution,
      total: c.esi.total
    }));
  }
}

module.exports = new ESICalculationService();
