const Employee = require('../models/Employee');
const Department = require('../models/Department');

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate phone format
const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

// Helper function to validate date format
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Helper function to find department by name or ID
const findDepartment = async (departmentValue) => {
  if (!departmentValue) return null;
  
  // Try to find by ID first
  let department = await Department.findById(departmentValue).catch(() => null);
  
  // If not found, try to find by name (case-insensitive)
  if (!department) {
    department = await Department.findOne({ 
      name: { $regex: new RegExp(`^${departmentValue}$`, 'i') } 
    });
  }
  
  return department;
};

// Validate a single employee record
const validateEmployeeRecord = async (record, rowIndex) => {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!record.firstName || record.firstName.trim() === '') {
    errors.push('First name is required');
  }
  if (!record.lastName || record.lastName.trim() === '') {
    errors.push('Last name is required');
  }
  if (!record.email || record.email.trim() === '') {
    errors.push('Email is required');
  } else if (!isValidEmail(record.email)) {
    errors.push('Invalid email format');
  }
  if (!record.phone || record.phone.trim() === '') {
    errors.push('Phone is required');
  } else if (!isValidPhone(record.phone)) {
    errors.push('Invalid phone format (should be 10-15 digits)');
  }
  if (!record.department || record.department.trim() === '') {
    errors.push('Department is required');
  }
  if (!record.designation || record.designation.trim() === '') {
    errors.push('Designation is required');
  }
  if (!record.joiningDate || record.joiningDate.trim() === '') {
    errors.push('Joining date is required');
  } else if (!isValidDate(record.joiningDate)) {
    errors.push('Invalid joining date format');
  }

  // Optional field validations
  if (record.dateOfBirth && !isValidDate(record.dateOfBirth)) {
    warnings.push('Invalid date of birth format, will be skipped');
  }

  // Validate gender enum
  if (record.gender && !['male', 'female', 'other', ''].includes(record.gender.toLowerCase())) {
    warnings.push('Invalid gender value, will be set to empty');
  }

  // Validate blood group enum
  const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''];
  if (record.bloodGroup && !validBloodGroups.includes(record.bloodGroup)) {
    warnings.push('Invalid blood group, will be skipped');
  }

  // Validate marital status enum
  const validMaritalStatus = ['single', 'married', 'divorced', 'widowed', ''];
  if (record.maritalStatus && !validMaritalStatus.includes(record.maritalStatus.toLowerCase())) {
    warnings.push('Invalid marital status, will be set to empty');
  }

  // Validate employment type enum
  const validEmploymentTypes = ['full-time', 'part-time', 'contract', 'intern'];
  if (record.employmentType && !validEmploymentTypes.includes(record.employmentType.toLowerCase())) {
    warnings.push('Invalid employment type, will be set to full-time');
  }

  // Validate status enum
  const validStatuses = ['active', 'inactive', 'terminated', 'on-leave'];
  if (record.status && !validStatuses.includes(record.status.toLowerCase())) {
    warnings.push('Invalid status, will be set to active');
  }

  // Check for duplicate email
  if (record.email) {
    const existingEmployee = await Employee.findOne({ email: record.email.toLowerCase() });
    if (existingEmployee) {
      errors.push(`Email already exists for employee: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
    }
  }

  // Check for duplicate employee code if provided
  if (record.employeeCode) {
    const existingCode = await Employee.findOne({ employeeCode: record.employeeCode });
    if (existingCode) {
      errors.push(`Employee code already exists: ${record.employeeCode}`);
    }
  }

  // Validate department exists
  if (record.department) {
    const department = await findDepartment(record.department);
    if (!department) {
      errors.push(`Department not found: ${record.department}`);
    }
  }

  return {
    rowIndex,
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Transform CSV/Excel record to employee schema format
const transformRecord = async (record) => {
  const department = await findDepartment(record.department);
  
  const employee = {
    firstName: record.firstName?.trim(),
    lastName: record.lastName?.trim(),
    email: record.email?.trim().toLowerCase(),
    phone: record.phone?.trim(),
    department: department?._id,
    designation: record.designation?.trim(),
    joiningDate: new Date(record.joiningDate),
    employmentType: record.employmentType?.toLowerCase() || 'full-time',
    status: record.status?.toLowerCase() || 'active',
  };

  // Optional employee code
  if (record.employeeCode && record.employeeCode.trim()) {
    employee.employeeCode = record.employeeCode.trim();
  }

  // Optional fields
  if (record.dateOfBirth && isValidDate(record.dateOfBirth)) {
    employee.dateOfBirth = new Date(record.dateOfBirth);
  }
  if (record.gender) {
    employee.gender = record.gender.toLowerCase();
  }
  if (record.bloodGroup) {
    employee.bloodGroup = record.bloodGroup;
  }
  if (record.maritalStatus) {
    employee.maritalStatus = record.maritalStatus.toLowerCase();
  }
  if (record.alternatePhone) {
    employee.alternatePhone = record.alternatePhone.trim();
  }

  // Address
  employee.address = {
    street: record.street || '',
    city: record.city || '',
    state: record.state || '',
    zipCode: record.zipCode || '',
    country: record.country || ''
  };

  // Salary
  employee.salary = {
    basic: parseFloat(record.basicSalary) || 0,
    hra: parseFloat(record.hra) || 0,
    allowances: parseFloat(record.allowances) || 0,
    deductions: parseFloat(record.deductions) || 0,
    total: (parseFloat(record.basicSalary) || 0) + 
           (parseFloat(record.hra) || 0) + 
           (parseFloat(record.allowances) || 0) - 
           (parseFloat(record.deductions) || 0)
  };

  // Bank Details
  employee.bankDetails = {
    accountNumber: record.accountNumber || '',
    bankName: record.bankName || '',
    ifscCode: record.ifscCode || '',
    accountHolderName: record.accountHolderName || '',
    branch: record.branch || ''
  };

  // Emergency Contact
  employee.emergencyContact = {
    name: record.emergencyContactName || '',
    relationship: record.emergencyContactRelationship || '',
    phone: record.emergencyContactPhone || ''
  };

  return employee;
};

// @desc    Validate bulk employee data
// @route   POST /api/employees/bulk/validate
// @access  Private (Admin, HR)
exports.validateBulkEmployees = async (req, res) => {
  try {
    const { employees } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No employee data provided'
      });
    }

    const validationResults = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const validation = await validateEmployeeRecord(employees[i], i + 1);
      validationResults.push({
        row: i + 1,
        data: employees[i],
        ...validation
      });

      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total: employees.length,
        valid: validCount,
        invalid: invalidCount,
        results: validationResults
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Bulk create employees
// @route   POST /api/employees/bulk/create
// @access  Private (Admin, HR)
exports.bulkCreateEmployees = async (req, res) => {
  try {
    const { employees } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No employee data provided'
      });
    }

    // Validate all records first
    const validationResults = [];
    const validRecords = [];
    let skippedCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const validation = await validateEmployeeRecord(employees[i], i + 1);
      
      if (validation.isValid) {
        validRecords.push(employees[i]);
      } else {
        skippedCount++;
        validationResults.push({
          row: i + 1,
          data: employees[i],
          errors: validation.errors
        });
      }
    }

    // Transform and create valid records
    const createdEmployees = [];
    const errors = [];

    for (let i = 0; i < validRecords.length; i++) {
      try {
        const transformedData = await transformRecord(validRecords[i]);
        const employee = await Employee.create(transformedData);
        createdEmployees.push(employee);
      } catch (error) {
        errors.push({
          row: i + 1,
          data: validRecords[i],
          error: error.message
        });
        skippedCount++;
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdEmployees.length} employees added successfully${skippedCount > 0 ? `, ${skippedCount} skipped due to validation errors` : ''}`,
      data: {
        created: createdEmployees.length,
        skipped: skippedCount,
        total: employees.length,
        employees: createdEmployees,
        errors: validationResults.concat(errors)
      }
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get sample CSV template
// @route   GET /api/employees/bulk/template
// @access  Private
exports.getTemplate = async (req, res) => {
  try {
    const sampleData = [
      {
        employeeCode: 'EMP00001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        dateOfBirth: '1990-01-15',
        gender: 'male',
        bloodGroup: 'O+',
        maritalStatus: 'married',
        alternatePhone: '9876543210',
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        department: 'Engineering',
        designation: 'Software Engineer',
        joiningDate: '2024-01-01',
        employmentType: 'full-time',
        status: 'active',
        basicSalary: '50000',
        hra: '10000',
        allowances: '5000',
        deductions: '2000',
        accountNumber: '1234567890',
        bankName: 'ABC Bank',
        ifscCode: 'ABCD0123456',
        accountHolderName: 'John Doe',
        branch: 'Main Branch',
        emergencyContactName: 'Jane Doe',
        emergencyContactRelationship: 'Spouse',
        emergencyContactPhone: '1112223333'
      }
    ];

    res.status(200).json({
      success: true,
      data: sampleData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
