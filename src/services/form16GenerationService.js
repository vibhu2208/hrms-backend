/**
 * Form 16 Generation Service
 * Generates Form 16 (TDS Certificate) as per Indian Income Tax regulations
 */

const tdsCalculationService = require('./tdsCalculationService');

class Form16GenerationService {
  /**
   * Generate Form 16 for an employee
   * @param {Object} employeeData - Employee details
   * @param {Object} salaryData - Annual salary breakdown
   * @param {Object} investmentData - Tax saving investments
   * @param {String} financialYear - Financial year (e.g., '2024-25')
   * @param {Object} companyData - Company details
   * @returns {Object} Form 16 data
   */
  generateForm16(employeeData, salaryData, investmentData, financialYear, companyData) {
    // Part A: Certificate details
    const partA = this.generatePartA(employeeData, companyData, financialYear);

    // Part B: Salary and tax computation
    const partB = this.generatePartB(employeeData, salaryData, investmentData, financialYear);

    // Annexure: Salary breakup
    const annexure = this.generateAnnexure(salaryData, financialYear);

    return {
      certificateNumber: this.generateCertificateNumber(employeeData, financialYear),
      financialYear,
      assessmentYear: tdsCalculationService.getAssessmentYear(financialYear),
      generatedDate: new Date(),
      partA,
      partB,
      annexure,
      verification: {
        place: companyData.city || '',
        date: new Date(),
        authorizedSignatory: companyData.authorizedSignatory || '',
        designation: companyData.designation || 'HR Manager'
      }
    };
  }

  /**
   * Generate Part A - Certificate under section 203 of the Income-tax Act, 1961
   */
  generatePartA(employeeData, companyData, financialYear) {
    return {
      certificateDetails: {
        name: `${employeeData.firstName} ${employeeData.lastName}`,
        pan: employeeData.pan || '',
        employeeCode: employeeData.employeeCode || '',
        designation: employeeData.designation || '',
        address: employeeData.address || ''
      },
      deductorDetails: {
        name: companyData.name,
        tan: companyData.tan || '',
        pan: companyData.pan || '',
        address: companyData.address || ''
      },
      periodOfEmployment: {
        from: `01-04-${financialYear.split('-')[0]}`,
        to: `31-03-${financialYear.split('-')[1]}`
      }
    };
  }

  /**
   * Generate Part B - Details of Salary paid and any other income and tax deducted
   */
  generatePartB(employeeData, salaryData, investmentData, financialYear) {
    const tdsData = tdsCalculationService.getTDSCertificateData(
      employeeData,
      salaryData,
      investmentData,
      financialYear
    );

    return {
      grossSalary: {
        salaryAsPerProvisions: tdsData.grossIncome,
        valueOfPerquisites: salaryData.perquisites || 0,
        profitsInLieuOfSalary: 0,
        total: tdsData.grossIncome + (salaryData.perquisites || 0)
      },
      lessAllowances: {
        entertainmentAllowance: 0,
        taxOnEmployment: salaryData.professionalTax || 0,
        total: salaryData.professionalTax || 0
      },
      incomeChargeable: tdsData.grossIncome - (salaryData.professionalTax || 0),
      deductions: {
        standardDeduction: tdsData.deductions.standardDeduction || 0,
        entertainmentAllowance: 0,
        taxOnEmployment: salaryData.professionalTax || 0,
        ...tdsData.deductions
      },
      totalIncome: tdsData.taxableIncome,
      taxOnTotalIncome: tdsData.taxBreakdown.taxOnIncome,
      surcharge: tdsData.taxBreakdown.surcharge,
      healthEducationCess: tdsData.taxBreakdown.cess,
      totalTaxLiability: tdsData.taxBreakdown.totalTax,
      lessReliefUnderSection89: 0,
      netTaxPayable: tdsData.taxBreakdown.totalTax,
      quarterlyBreakup: tdsData.quarterlyTDS
    };
  }

  /**
   * Generate Annexure - Salary breakup
   */
  generateAnnexure(salaryData, financialYear) {
    const months = this.getFinancialYearMonths(financialYear);
    
    return {
      salaryBreakup: months.map(month => ({
        month: month.name,
        basic: salaryData.basicSalary || 0,
        hra: salaryData.hra || 0,
        specialAllowance: salaryData.specialAllowance || 0,
        otherAllowances: salaryData.otherAllowances || 0,
        gross: (salaryData.basicSalary || 0) + (salaryData.hra || 0) + 
               (salaryData.specialAllowance || 0) + (salaryData.otherAllowances || 0),
        pf: salaryData.pfEmployee || 0,
        esi: salaryData.esiEmployee || 0,
        pt: salaryData.professionalTax || 0,
        tds: Math.round((salaryData.annualTDS || 0) / 12),
        netSalary: 0 // Will be calculated
      })),
      totals: {
        basic: (salaryData.basicSalary || 0) * 12,
        hra: (salaryData.hra || 0) * 12,
        specialAllowance: (salaryData.specialAllowance || 0) * 12,
        otherAllowances: (salaryData.otherAllowances || 0) * 12,
        gross: ((salaryData.basicSalary || 0) + (salaryData.hra || 0) + 
                (salaryData.specialAllowance || 0) + (salaryData.otherAllowances || 0)) * 12,
        pf: (salaryData.pfEmployee || 0) * 12,
        esi: (salaryData.esiEmployee || 0) * 12,
        pt: (salaryData.professionalTax || 0) * 12,
        tds: salaryData.annualTDS || 0
      }
    };
  }

  /**
   * Get financial year months
   */
  getFinancialYearMonths(financialYear) {
    const year = parseInt(financialYear.split('-')[0]);
    return [
      { name: 'April', year },
      { name: 'May', year },
      { name: 'June', year },
      { name: 'July', year },
      { name: 'August', year },
      { name: 'September', year },
      { name: 'October', year },
      { name: 'November', year },
      { name: 'December', year },
      { name: 'January', year: year + 1 },
      { name: 'February', year: year + 1 },
      { name: 'March', year: year + 1 }
    ];
  }

  /**
   * Generate certificate number
   */
  generateCertificateNumber(employeeData, financialYear) {
    const year = financialYear.replace('-', '');
    const empCode = employeeData.employeeCode || '0000';
    const timestamp = Date.now().toString().slice(-6);
    return `F16-${year}-${empCode}-${timestamp}`;
  }

  /**
   * Generate Form 16 PDF (placeholder - requires PDF library)
   */
  async generateForm16PDF(form16Data) {
    // TODO: Implement PDF generation using libraries like pdfkit or puppeteer
    return {
      success: true,
      message: 'PDF generation not yet implemented',
      data: form16Data
    };
  }

  /**
   * Validate Form 16 data
   */
  validateForm16Data(employeeData, salaryData, companyData) {
    const errors = [];
    const warnings = [];

    // Employee validations
    if (!employeeData.pan) {
      errors.push('Employee PAN is required for Form 16');
    }
    if (!employeeData.firstName || !employeeData.lastName) {
      errors.push('Employee name is required');
    }

    // Company validations
    if (!companyData.tan) {
      errors.push('Company TAN is required for Form 16');
    }
    if (!companyData.pan) {
      errors.push('Company PAN is required');
    }

    // Salary validations
    if (!salaryData.basicSalary || salaryData.basicSalary <= 0) {
      errors.push('Basic salary is required');
    }

    // Warnings
    if (!employeeData.address) {
      warnings.push('Employee address is missing');
    }
    if (!companyData.address) {
      warnings.push('Company address is missing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate bulk Form 16 for multiple employees
   */
  async generateBulkForm16(employees, financialYear, companyData) {
    const results = [];
    const errors = [];

    for (const emp of employees) {
      try {
        const validation = this.validateForm16Data(emp.employeeData, emp.salaryData, companyData);
        
        if (!validation.isValid) {
          errors.push({
            employeeId: emp.employeeData.employeeId,
            employeeName: `${emp.employeeData.firstName} ${emp.employeeData.lastName}`,
            errors: validation.errors
          });
          continue;
        }

        const form16 = this.generateForm16(
          emp.employeeData,
          emp.salaryData,
          emp.investmentData || {},
          financialYear,
          companyData
        );

        results.push({
          employeeId: emp.employeeData.employeeId,
          employeeName: `${emp.employeeData.firstName} ${emp.employeeData.lastName}`,
          form16,
          status: 'success'
        });
      } catch (error) {
        errors.push({
          employeeId: emp.employeeData.employeeId,
          employeeName: `${emp.employeeData.firstName} ${emp.employeeData.lastName}`,
          error: error.message
        });
      }
    }

    return {
      success: results.length,
      failed: errors.length,
      results,
      errors
    };
  }
}

module.exports = new Form16GenerationService();
