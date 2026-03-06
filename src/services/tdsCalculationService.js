/**
 * TDS (Tax Deducted at Source) Calculation Service
 * Handles income tax calculation as per Indian Income Tax Act
 */

class TDSCalculationService {
  constructor() {
    // FY 2024-25 Tax Slabs - New Regime (Default)
    this.newRegimeSlabs = [
      { minIncome: 0, maxIncome: 300000, taxRate: 0 },
      { minIncome: 300001, maxIncome: 700000, taxRate: 5 },
      { minIncome: 700001, maxIncome: 1000000, taxRate: 10 },
      { minIncome: 1000001, maxIncome: 1200000, taxRate: 15 },
      { minIncome: 1200001, maxIncome: 1500000, taxRate: 20 },
      { minIncome: 1500001, maxIncome: Infinity, taxRate: 30 }
    ];

    // FY 2024-25 Tax Slabs - Old Regime
    this.oldRegimeSlabs = [
      { minIncome: 0, maxIncome: 250000, taxRate: 0 },
      { minIncome: 250001, maxIncome: 500000, taxRate: 5 },
      { minIncome: 500001, maxIncome: 1000000, taxRate: 20 },
      { minIncome: 1000001, maxIncome: Infinity, taxRate: 30 }
    ];

    // Surcharge rates
    this.surchargeRates = [
      { minIncome: 5000000, maxIncome: 10000000, rate: 10 },
      { minIncome: 10000001, maxIncome: 20000000, rate: 15 },
      { minIncome: 20000001, maxIncome: 50000000, rate: 25 },
      { minIncome: 50000001, maxIncome: Infinity, rate: 37 }
    ];

    // Standard deduction
    this.standardDeduction = 50000;

    // Health and Education Cess
    this.cessPercentage = 4;
  }

  /**
   * Calculate TDS for an employee
   * @param {Object} salaryDetails - Employee salary breakdown
   * @param {Object} investments - Tax saving investments (80C, 80D, etc.)
   * @param {String} regime - 'new' or 'old'
   * @returns {Object} TDS calculation
   */
  calculateTDS(salaryDetails, investments = {}, regime = 'new') {
    // Calculate gross annual income
    const grossAnnualIncome = this.calculateGrossAnnualIncome(salaryDetails);

    // Calculate taxable income
    const taxableIncome = this.calculateTaxableIncome(
      grossAnnualIncome,
      investments,
      regime
    );

    // Calculate tax as per slabs
    const slabs = regime === 'new' ? this.newRegimeSlabs : this.oldRegimeSlabs;
    const taxOnIncome = this.calculateTaxOnSlabs(taxableIncome, slabs);

    // Calculate surcharge (if applicable)
    const surcharge = this.calculateSurcharge(taxableIncome, taxOnIncome);

    // Calculate health and education cess
    const cess = Math.round(((taxOnIncome + surcharge) * this.cessPercentage) / 100);

    // Total tax liability
    const totalTax = taxOnIncome + surcharge + cess;

    // Monthly TDS
    const monthlyTDS = Math.round(totalTax / 12);

    return {
      regime,
      grossAnnualIncome,
      deductions: this.getDeductions(grossAnnualIncome, investments, regime),
      taxableIncome,
      taxBreakdown: {
        taxOnIncome,
        surcharge,
        cess,
        totalTax
      },
      monthlyTDS,
      annualTDS: totalTax,
      effectiveTaxRate: grossAnnualIncome > 0 
        ? ((totalTax / grossAnnualIncome) * 100).toFixed(2) 
        : 0
    };
  }

  /**
   * Calculate gross annual income
   */
  calculateGrossAnnualIncome(salaryDetails) {
    const {
      basicSalary = 0,
      hra = 0,
      specialAllowance = 0,
      otherAllowances = 0,
      bonus = 0,
      arrears = 0
    } = salaryDetails;

    return (basicSalary + hra + specialAllowance + otherAllowances) * 12 + bonus + arrears;
  }

  /**
   * Calculate taxable income
   */
  calculateTaxableIncome(grossIncome, investments, regime) {
    let taxableIncome = grossIncome;

    // Standard deduction (available in both regimes)
    taxableIncome -= this.standardDeduction;

    // Old regime deductions
    if (regime === 'old') {
      // 80C deductions (max ₹1.5 lakh)
      const section80C = Math.min(investments.section80C || 0, 150000);
      taxableIncome -= section80C;

      // 80D deductions (health insurance)
      const section80D = Math.min(investments.section80D || 0, 25000);
      taxableIncome -= section80D;

      // 80CCD(1B) - NPS (max ₹50,000)
      const section80CCD1B = Math.min(investments.section80CCD1B || 0, 50000);
      taxableIncome -= section80CCD1B;

      // HRA exemption
      if (investments.hraExemption) {
        taxableIncome -= investments.hraExemption;
      }

      // Other deductions
      if (investments.otherDeductions) {
        taxableIncome -= investments.otherDeductions;
      }
    }

    return Math.max(taxableIncome, 0);
  }

  /**
   * Calculate tax based on slabs
   */
  calculateTaxOnSlabs(taxableIncome, slabs) {
    let tax = 0;
    let remainingIncome = taxableIncome;

    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      const slabIncome = Math.min(
        Math.max(remainingIncome - slab.minIncome, 0),
        slab.maxIncome - slab.minIncome
      );

      if (slabIncome > 0) {
        tax += (slabIncome * slab.taxRate) / 100;
        remainingIncome -= slabIncome;
      }

      if (remainingIncome <= 0) break;
    }

    return Math.round(tax);
  }

  /**
   * Calculate surcharge
   */
  calculateSurcharge(taxableIncome, taxOnIncome) {
    for (const rate of this.surchargeRates) {
      if (taxableIncome >= rate.minIncome && taxableIncome <= rate.maxIncome) {
        return Math.round((taxOnIncome * rate.rate) / 100);
      }
    }
    return 0;
  }

  /**
   * Get deductions breakdown
   */
  getDeductions(grossIncome, investments, regime) {
    const deductions = {
      standardDeduction: this.standardDeduction
    };

    if (regime === 'old') {
      deductions.section80C = Math.min(investments.section80C || 0, 150000);
      deductions.section80D = Math.min(investments.section80D || 0, 25000);
      deductions.section80CCD1B = Math.min(investments.section80CCD1B || 0, 50000);
      deductions.hraExemption = investments.hraExemption || 0;
      deductions.otherDeductions = investments.otherDeductions || 0;
    }

    deductions.total = Object.values(deductions).reduce((sum, val) => sum + val, 0);
    return deductions;
  }

  /**
   * Compare tax in both regimes
   */
  compareTaxRegimes(salaryDetails, investments = {}) {
    const newRegimeTax = this.calculateTDS(salaryDetails, investments, 'new');
    const oldRegimeTax = this.calculateTDS(salaryDetails, investments, 'old');

    return {
      newRegime: newRegimeTax,
      oldRegime: oldRegimeTax,
      recommendation: newRegimeTax.annualTDS < oldRegimeTax.annualTDS ? 'new' : 'old',
      savings: Math.abs(newRegimeTax.annualTDS - oldRegimeTax.annualTDS)
    };
  }

  /**
   * Calculate quarterly TDS
   */
  calculateQuarterlyTDS(annualTDS) {
    return {
      Q1: Math.round(annualTDS / 4), // Apr-Jun
      Q2: Math.round(annualTDS / 4), // Jul-Sep
      Q3: Math.round(annualTDS / 4), // Oct-Dec
      Q4: Math.round(annualTDS / 4)  // Jan-Mar
    };
  }

  /**
   * Validate TDS calculation
   */
  validateTDS(salaryDetails) {
    const errors = [];
    const warnings = [];

    if (!salaryDetails.basicSalary || salaryDetails.basicSalary <= 0) {
      errors.push('Basic salary is required and must be greater than zero');
    }

    const grossIncome = this.calculateGrossAnnualIncome(salaryDetails);
    if (grossIncome < 0) {
      errors.push('Gross annual income cannot be negative');
    }

    if (grossIncome > 5000000) {
      warnings.push('Income exceeds ₹50 lakh. Surcharge will be applicable.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get TDS certificate data (Form 16 Part B)
   */
  getTDSCertificateData(employeeDetails, salaryDetails, investments, financialYear) {
    const tds = this.calculateTDS(salaryDetails, investments, employeeDetails.taxRegime || 'new');

    return {
      financialYear,
      assessmentYear: this.getAssessmentYear(financialYear),
      employee: employeeDetails,
      salary: salaryDetails,
      grossIncome: tds.grossAnnualIncome,
      deductions: tds.deductions,
      taxableIncome: tds.taxableIncome,
      taxBreakdown: tds.taxBreakdown,
      totalTDS: tds.annualTDS,
      quarterlyTDS: this.calculateQuarterlyTDS(tds.annualTDS)
    };
  }

  /**
   * Get assessment year from financial year
   */
  getAssessmentYear(financialYear) {
    // FY 2024-25 -> AY 2025-26
    const years = financialYear.split('-');
    const startYear = parseInt(years[0]);
    return `${startYear + 1}-${(startYear + 2).toString().slice(-2)}`;
  }
}

module.exports = new TDSCalculationService();
