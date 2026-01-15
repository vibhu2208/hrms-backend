/**
 * Payroll Anomaly Detection Service
 * Detects unusual patterns in payroll data
 */

class PayrollAnomalyService {
  /**
   * Detect anomalies in payroll data
   */
  async detectAnomalies(payrollData, previousPayrollData = []) {
    const anomalies = [];
    
    // Create a map of previous payroll for quick lookup
    const previousMap = new Map();
    previousPayrollData.forEach(emp => {
      previousMap.set(emp.employeeId.toString(), emp);
    });

    for (const employee of payrollData) {
      const previous = previousMap.get(employee.employeeId.toString());
      
      // 1. Salary Spike Detection (> 20% change)
      if (previous && previous.netSalary) {
        const percentageChange = ((employee.netSalary - previous.netSalary) / previous.netSalary) * 100;
        
        if (Math.abs(percentageChange) > 20) {
          anomalies.push({
            employeeId: employee.employeeId,
            employeeEmail: employee.email,
            employeeName: employee.name,
            anomalyType: 'salary_spike',
            description: `Net salary ${percentageChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentageChange).toFixed(2)}%`,
            severity: this.getSeverity(Math.abs(percentageChange)),
            previousValue: previous.netSalary,
            currentValue: employee.netSalary,
            percentageChange: percentageChange,
            resolved: false
          });
        }
      }
      
      // 2. Negative Pay Detection
      if (employee.netSalary < 0) {
        anomalies.push({
          employeeId: employee.employeeId,
          employeeEmail: employee.email,
          employeeName: employee.name,
          anomalyType: 'negative_pay',
          description: `Net salary is negative: ₹${employee.netSalary}`,
          severity: 'critical',
          currentValue: employee.netSalary,
          resolved: false
        });
      }
      
      // 3. Missing Critical Data
      if (!employee.grossSalary || employee.grossSalary === 0) {
        anomalies.push({
          employeeId: employee.employeeId,
          employeeEmail: employee.email,
          employeeName: employee.name,
          anomalyType: 'missing_data',
          description: 'Gross salary is missing or zero',
          severity: 'high',
          resolved: false
        });
      }
      
      // 4. Unusual Deductions (> 50% of gross salary)
      if (employee.totalDeductions && employee.grossSalary) {
        const deductionPercentage = (employee.totalDeductions / employee.grossSalary) * 100;
        
        if (deductionPercentage > 50) {
          anomalies.push({
            employeeId: employee.employeeId,
            employeeEmail: employee.email,
            employeeName: employee.name,
            anomalyType: 'unusual_deduction',
            description: `Deductions are ${deductionPercentage.toFixed(2)}% of gross salary`,
            severity: deductionPercentage > 80 ? 'critical' : 'high',
            currentValue: employee.totalDeductions,
            percentageChange: deductionPercentage,
            resolved: false
          });
        }
      }
      
      // 5. Excessive Overtime (> 60 hours in a month)
      if (employee.overtimeHours && employee.overtimeHours > 60) {
        anomalies.push({
          employeeId: employee.employeeId,
          employeeEmail: employee.email,
          employeeName: employee.name,
          anomalyType: 'overtime_excessive',
          description: `Overtime hours: ${employee.overtimeHours} hours`,
          severity: employee.overtimeHours > 100 ? 'high' : 'medium',
          currentValue: employee.overtimeHours,
          resolved: false
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Get severity based on percentage change
   */
  getSeverity(percentageChange) {
    if (percentageChange > 100) return 'critical';
    if (percentageChange > 50) return 'high';
    if (percentageChange > 30) return 'medium';
    return 'low';
  }

  /**
   * Validate payroll data before processing
   */
  async validatePayroll(payrollData) {
    const errors = [];
    const warnings = [];
    
    for (const employee of payrollData) {
      // Required fields validation
      if (!employee.employeeId) {
        errors.push(`Missing employee ID for ${employee.name || 'unknown employee'}`);
      }
      
      if (!employee.grossSalary || employee.grossSalary < 0) {
        errors.push(`Invalid gross salary for ${employee.name}: ${employee.grossSalary}`);
      }
      
      // Logical validations
      if (employee.netSalary > employee.grossSalary) {
        warnings.push(`Net salary exceeds gross salary for ${employee.name}`);
      }
      
      if (employee.totalDeductions < 0) {
        errors.push(`Negative deductions for ${employee.name}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate payroll summary
   */
  calculateSummary(payrollData) {
    return {
      totalEmployees: payrollData.length,
      totalGrossSalary: payrollData.reduce((sum, emp) => sum + (emp.grossSalary || 0), 0),
      totalDeductions: payrollData.reduce((sum, emp) => sum + (emp.totalDeductions || 0), 0),
      totalNetSalary: payrollData.reduce((sum, emp) => sum + (emp.netSalary || 0), 0),
      averageGrossSalary: payrollData.length > 0 
        ? payrollData.reduce((sum, emp) => sum + (emp.grossSalary || 0), 0) / payrollData.length 
        : 0,
      averageNetSalary: payrollData.length > 0 
        ? payrollData.reduce((sum, emp) => sum + (emp.netSalary || 0), 0) / payrollData.length 
        : 0
    };
  }
}

module.exports = new PayrollAnomalyService();
