/**
 * Professional Tax Calculation Service
 * Handles PT calculation for different Indian states
 */

class ProfessionalTaxService {
  constructor() {
    // Professional Tax slabs for different states
    this.statePTSlabs = {
      'Maharashtra': [
        { minSalary: 0, maxSalary: 7500, taxAmount: 0 },
        { minSalary: 7501, maxSalary: 10000, taxAmount: 175 },
        { minSalary: 10001, maxSalary: Infinity, taxAmount: 200 }
      ],
      'Karnataka': [
        { minSalary: 0, maxSalary: 15000, taxAmount: 0 },
        { minSalary: 15001, maxSalary: Infinity, taxAmount: 200 }
      ],
      'West Bengal': [
        { minSalary: 0, maxSalary: 10000, taxAmount: 0 },
        { minSalary: 10001, maxSalary: 15000, taxAmount: 110 },
        { minSalary: 15001, maxSalary: 25000, taxAmount: 130 },
        { minSalary: 25001, maxSalary: 40000, taxAmount: 150 },
        { minSalary: 40001, maxSalary: Infinity, taxAmount: 200 }
      ],
      'Tamil Nadu': [
        { minSalary: 0, maxSalary: 21000, taxAmount: 0 },
        { minSalary: 21001, maxSalary: Infinity, taxAmount: 208.33 } // ₹2,500 per year / 12 months
      ],
      'Gujarat': [
        { minSalary: 0, maxSalary: 5999, taxAmount: 0 },
        { minSalary: 6000, maxSalary: 8999, taxAmount: 80 },
        { minSalary: 9000, maxSalary: 11999, taxAmount: 150 },
        { minSalary: 12000, maxSalary: Infinity, taxAmount: 200 }
      ],
      'Andhra Pradesh': [
        { minSalary: 0, maxSalary: 15000, taxAmount: 0 },
        { minSalary: 15001, maxSalary: 20000, taxAmount: 150 },
        { minSalary: 20001, maxSalary: Infinity, taxAmount: 200 }
      ],
      'Telangana': [
        { minSalary: 0, maxSalary: 15000, taxAmount: 0 },
        { minSalary: 15001, maxSalary: 20000, taxAmount: 150 },
        { minSalary: 20001, maxSalary: Infinity, taxAmount: 200 }
      ],
      'Madhya Pradesh': [
        { minSalary: 0, maxSalary: 15000, taxAmount: 0 },
        { minSalary: 15001, maxSalary: Infinity, taxAmount: 208.33 } // ₹2,500 per year / 12 months
      ],
      'Assam': [
        { minSalary: 0, maxSalary: 10000, taxAmount: 0 },
        { minSalary: 10001, maxSalary: 15000, taxAmount: 150 },
        { minSalary: 15001, maxSalary: 25000, taxAmount: 180 },
        { minSalary: 25001, maxSalary: Infinity, taxAmount: 208 }
      ]
    };
  }

  /**
   * Calculate Professional Tax for an employee
   * @param {Number} grossSalary - Gross monthly salary
   * @param {String} state - State name
   * @param {Array} customSlabs - Custom PT slabs (optional)
   * @returns {Object} PT calculation
   */
  calculatePT(grossSalary, state, customSlabs = null) {
    // Use custom slabs if provided, otherwise use state slabs
    const slabs = customSlabs || this.statePTSlabs[state];

    if (!slabs) {
      return {
        applicable: false,
        reason: `Professional Tax slabs not configured for state: ${state}`,
        grossSalary,
        state,
        taxAmount: 0
      };
    }

    // Find applicable slab
    for (const slab of slabs) {
      if (grossSalary >= slab.minSalary && grossSalary <= slab.maxSalary) {
        return {
          applicable: slab.taxAmount > 0,
          grossSalary,
          state,
          slab: {
            minSalary: slab.minSalary,
            maxSalary: slab.maxSalary === Infinity ? 'No limit' : slab.maxSalary
          },
          taxAmount: Math.round(slab.taxAmount),
          annualTax: Math.round(slab.taxAmount * 12)
        };
      }
    }

    // No slab found (shouldn't happen with proper slabs)
    return {
      applicable: false,
      reason: 'No applicable slab found',
      grossSalary,
      state,
      taxAmount: 0
    };
  }

  /**
   * Calculate PT for multiple employees
   */
  calculateBulkPT(employees, state, customSlabs = null) {
    return employees.map(emp => ({
      employeeId: emp.employeeId,
      employeeName: emp.name,
      grossSalary: emp.grossSalary,
      pt: this.calculatePT(emp.grossSalary, state, customSlabs)
    }));
  }

  /**
   * Get PT summary for a month
   */
  getPTSummary(ptCalculations) {
    const summary = {
      totalEmployees: ptCalculations.length,
      applicableEmployees: 0,
      nonApplicableEmployees: 0,
      totalPTAmount: 0,
      byState: {}
    };

    ptCalculations.forEach(calc => {
      const pt = calc.pt;
      
      if (pt.applicable) {
        summary.applicableEmployees++;
        summary.totalPTAmount += pt.taxAmount;
        
        // Group by state
        if (!summary.byState[pt.state]) {
          summary.byState[pt.state] = {
            employees: 0,
            totalAmount: 0
          };
        }
        summary.byState[pt.state].employees++;
        summary.byState[pt.state].totalAmount += pt.taxAmount;
      } else {
        summary.nonApplicableEmployees++;
      }
    });

    return summary;
  }

  /**
   * Get available states
   */
  getAvailableStates() {
    return Object.keys(this.statePTSlabs);
  }

  /**
   * Get PT slabs for a state
   */
  getStatePTSlabs(state) {
    return this.statePTSlabs[state] || null;
  }

  /**
   * Validate PT calculation
   */
  validatePT(grossSalary, state) {
    const errors = [];
    const warnings = [];

    if (!grossSalary || grossSalary <= 0) {
      errors.push('Gross salary must be greater than zero');
    }

    if (!state) {
      errors.push('State is required for PT calculation');
    } else if (!this.statePTSlabs[state]) {
      warnings.push(`PT slabs not configured for state: ${state}. Please configure custom slabs.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate PT challan data
   */
  generatePTChallan(ptSummary, month, year, companyDetails) {
    return {
      month,
      year,
      company: {
        name: companyDetails.name,
        ptRegistrationNumber: companyDetails.ptRegistrationNumber,
        state: companyDetails.state,
        address: companyDetails.address
      },
      summary: ptSummary,
      challanDetails: {
        totalEmployees: ptSummary.applicableEmployees,
        totalPTAmount: ptSummary.totalPTAmount,
        byState: ptSummary.byState
      },
      dueDate: this.getPTDueDate(month, year),
      generatedAt: new Date()
    };
  }

  /**
   * Get PT due date (varies by state, default 15th of next month)
   */
  getPTDueDate(month, year, state = null) {
    // Some states have different due dates
    const stateDueDates = {
      'Maharashtra': 15,
      'Karnataka': 20,
      'West Bengal': 15,
      'Tamil Nadu': 15
    };

    const dueDay = state && stateDueDates[state] ? stateDueDates[state] : 15;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    return new Date(nextYear, nextMonth - 1, dueDay);
  }

  /**
   * Check if PT is applicable for an employee
   */
  isApplicable(grossSalary, state) {
    const pt = this.calculatePT(grossSalary, state);
    return pt.applicable;
  }
}

module.exports = new ProfessionalTaxService();
