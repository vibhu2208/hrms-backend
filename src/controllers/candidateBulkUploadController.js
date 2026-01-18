const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const { getTenantModel } = require('../utils/tenantModels');
const template = require('../utils/candidateBulkUploadTemplate');

/**
 * Parse Excel/CSV file and validate against template
 */
exports.validateBulkUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let rows = [];
    const errors = [];
    const warnings = [];

    // Parse file based on extension
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      rows = await parseExcelFile(filePath);
    } else if (fileExtension === '.csv') {
      rows = await parseCSVFile(filePath);
    } else {
      await fs.unlink(filePath).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Please upload Excel (.xlsx, .xls) or CSV file.'
      });
    }

    if (rows.length === 0) {
      await fs.unlink(filePath).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'File is empty or could not be parsed'
      });
    }

    // Normalize headers
    const headers = normalizeHeaders(rows[0]);
    const dataRows = rows.slice(1);

    // Validate headers
    const headerValidation = validateHeaders(headers);
    if (!headerValidation.isValid) {
      await fs.unlink(filePath).catch(() => {});
      return res.status(400).json({
        success: false,
        message: 'Invalid file headers',
        errors: headerValidation.errors,
        expectedHeaders: template.requiredFields
      });
    }

    // Validate each row
    const validatedRows = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
      
      const rowData = {};
      const rowErrors = [];
      const rowWarnings = [];

      // Map row data to normalized field names
      headers.forEach((header, index) => {
        const normalizedHeader = template.headerMapping[header.toLowerCase()] || header;
        rowData[normalizedHeader] = row[index] || '';
      });

      // Validate required fields
      for (const field of template.requiredFields) {
        if (!rowData[field] || String(rowData[field]).trim() === '') {
          rowErrors.push(`Row ${rowNumber}: ${field} is required`);
        }
      }

      // Validate field formats
      for (const [field, rules] of Object.entries(template.fieldRules)) {
        const value = rowData[field];
        
        if (value === undefined || value === null || value === '') {
          if (rules.required) {
            rowErrors.push(`Row ${rowNumber}: ${field} is required`);
          }
          continue;
        }

        const stringValue = String(value).trim();

        // Type validation
        if (rules.type === 'number') {
          const numValue = parseFloat(stringValue);
          if (isNaN(numValue)) {
            rowErrors.push(`Row ${rowNumber}: ${field} must be a number`);
          } else {
            rowData[field] = numValue;
            if (rules.min !== undefined && numValue < rules.min) {
              rowErrors.push(`Row ${rowNumber}: ${field} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && numValue > rules.max) {
              rowErrors.push(`Row ${rowNumber}: ${field} must be at most ${rules.max}`);
            }
          }
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(stringValue)) {
          rowErrors.push(`Row ${rowNumber}: ${field} format is invalid`);
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(stringValue.toLowerCase())) {
          rowWarnings.push(`Row ${rowNumber}: ${field} value "${stringValue}" is not in allowed values. Using default: ${rules.default || 'N/A'}`);
          rowData[field] = rules.default || stringValue;
        }
      }

      // Validate email format
      if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rowData.email).trim())) {
        rowErrors.push(`Row ${rowNumber}: Invalid email format`);
      }

      // Validate phone format
      if (rowData.phone && !/^[\d\s\-\+\(\)]+$/.test(String(rowData.phone).trim())) {
        rowWarnings.push(`Row ${rowNumber}: Phone number format may be invalid`);
      }

      // Process comma-separated fields
      if (rowData.skills && typeof rowData.skills === 'string') {
        rowData.skills = rowData.skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (rowData.preferredLocation && typeof rowData.preferredLocation === 'string') {
        rowData.preferredLocation = rowData.preferredLocation.split(',').map(l => l.trim()).filter(Boolean);
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validatedRows.push({
          rowNumber,
          data: rowData,
          warnings: rowWarnings
        });
        warnings.push(...rowWarnings);
      }
    }

    // Store validated data temporarily (in memory or file)
    // For now, we'll return it in the response and the frontend will send it back for import
    const validationResult = {
      totalRows: dataRows.length,
      validRows: validatedRows.length,
      invalidRows: dataRows.length - validatedRows.length,
      errors,
      warnings,
      validatedData: validatedRows.map(r => r.data),
      filePath: req.file.path, // Store file path for later import
      fileName: req.file.originalname
    };

    res.status(200).json({
      success: true,
      message: `Validation complete: ${validatedRows.length} valid rows, ${errors.length} errors found`,
      data: validationResult
    });

  } catch (error) {
    console.error('Error validating bulk upload:', error);
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Error validating file',
      error: error.message
    });
  }
};

/**
 * Import validated candidates in bulk
 */
exports.importBulkCandidates = async (req, res) => {
  try {
    const { validatedData, jobMapping } = req.body;

    if (!validatedData || !Array.isArray(validatedData) || validatedData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No validated data provided'
      });
    }

    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');
    const JobPosting = getTenantModel(req.tenant.connection, 'JobPosting');

    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    // Get all job postings for mapping
    const jobPostings = await JobPosting.find({ status: 'active' });
    const jobTitleMap = {};
    jobPostings.forEach(job => {
      jobTitleMap[job.title.toLowerCase()] = job._id;
      if (jobMapping && jobMapping[job.title]) {
        jobTitleMap[job.title.toLowerCase()] = jobMapping[job.title];
      }
    });

    for (const candidateData of validatedData) {
      try {
        // Check for duplicates
        const existingCandidate = await Candidate.findOne({
          $or: [
            { email: candidateData.email.toLowerCase().trim() },
            { phone: candidateData.phone.replace(/\D/g, '') }
          ]
        });

        if (existingCandidate) {
          results.duplicates.push({
            email: candidateData.email,
            reason: 'Candidate with this email or phone already exists'
          });
          continue;
        }

        // Map job title to job ID
        let jobId = null;
        if (candidateData.appliedFor) {
          const jobTitle = String(candidateData.appliedFor).toLowerCase().trim();
          jobId = jobTitleMap[jobTitle];
          
          if (!jobId && jobMapping && jobMapping[candidateData.appliedFor]) {
            jobId = jobMapping[candidateData.appliedFor];
          }
        }

        if (!jobId) {
          results.failed.push({
            email: candidateData.email,
            reason: `Job "${candidateData.appliedFor}" not found. Please ensure the job exists and is active.`
          });
          continue;
        }

        // Generate unique candidate code (handle race conditions)
        let candidateCode;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
          try {
            // Get the highest existing candidate code
            const lastCandidate = await Candidate.findOne({})
              .sort({ candidateCode: -1 })
              .select('candidateCode')
              .lean();
            
            if (lastCandidate && lastCandidate.candidateCode) {
              // Extract number from last code (e.g., "CAN00008" -> 8)
              const lastNumber = parseInt(lastCandidate.candidateCode.replace('CAN', '')) || 0;
              candidateCode = `CAN${String(lastNumber + 1 + attempts).padStart(5, '0')}`;
            } else {
              // No candidates exist, start from 1
              candidateCode = `CAN${String(1 + attempts).padStart(5, '0')}`;
            }
            
            // Check if this code already exists (race condition check)
            const existing = await Candidate.findOne({ candidateCode });
            if (existing) {
              attempts++;
              continue;
            }
            
            // Code is unique, use it
            break;
            
          } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
              // Fallback to timestamp-based code
              candidateCode = `CAN${Date.now().toString().slice(-8)}`;
              break;
            }
          }
        }

        // Create candidate
        const candidate = new Candidate({
          candidateCode,
          firstName: candidateData.firstName.trim(),
          lastName: candidateData.lastName.trim(),
          email: candidateData.email.toLowerCase().trim(),
          phone: candidateData.phone.trim(),
          alternatePhone: candidateData.alternatePhone?.trim() || null,
          currentLocation: candidateData.currentLocation?.trim() || null,
          preferredLocation: candidateData.preferredLocation || [],
          source: candidateData.source || 'other',
          appliedFor: jobId,
          experience: {
            years: candidateData.experienceYears || 0,
            months: candidateData.experienceMonths || 0
          },
          currentCompany: candidateData.currentCompany?.trim() || null,
          currentDesignation: candidateData.currentDesignation?.trim() || null,
          currentCTC: candidateData.currentCTC || null,
          expectedCTC: candidateData.expectedCTC || null,
          noticePeriod: candidateData.noticePeriod || null,
          skills: candidateData.skills || [],
          stage: candidateData.stage || 'applied',
          status: 'active',
          notes: candidateData.notes?.trim() || null
        });

        await candidate.save();

        results.success.push({
          email: candidate.email,
          candidateId: candidate._id,
          candidateCode: candidate.candidateCode
        });

      } catch (error) {
        results.failed.push({
          email: candidateData.email,
          reason: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import complete: ${results.success.length} imported, ${results.failed.length} failed, ${results.duplicates.length} duplicates`,
      data: results
    });

  } catch (error) {
    console.error('Error importing bulk candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing candidates',
      error: error.message
    });
  }
};

/**
 * Download template file
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Candidates');

    // Add headers
    const headers = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'appliedFor',
      'alternatePhone',
      'currentLocation',
      'preferredLocation',
      'source',
      'experienceYears',
      'experienceMonths',
      'currentCompany',
      'currentDesignation',
      'currentCTC',
      'expectedCTC',
      'noticePeriod',
      'skills',
      'stage',
      'notes'
    ];

    worksheet.addRow(headers);

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add example row
    worksheet.addRow([
      'John',
      'Doe',
      'john.doe@example.com',
      '9876543210',
      'Senior Full Stack Developer',
      '9876543211',
      'Mumbai',
      'Mumbai, Pune',
      'linkedin',
      '5',
      '6',
      'Tech Corp',
      'Senior Developer',
      '800000',
      '1000000',
      '30',
      'Node.js, React, MongoDB',
      'applied',
      'Referred by employee'
    ]);

    // Set column widths
    worksheet.columns.forEach((column, index) => {
      column.width = 20;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=candidate_bulk_upload_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: error.message
    });
  }
};

// Helper functions

async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  const rows = [];
  
  worksheet.eachRow((row, rowNumber) => {
    const rowData = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData.push(cell.value || '');
    });
    rows.push(rowData);
  });
  
  return rows;
}

async function parseCSVFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  const rows = [];
  for (const line of lines) {
    // Simple CSV parsing (handles quoted values)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value
    
    rows.push(values);
  }
  
  return rows;
}

function normalizeHeaders(headers) {
  return headers.map(header => {
    const normalized = String(header).trim().toLowerCase();
    return template.headerMapping[normalized] || normalized;
  });
}

function validateHeaders(headers) {
  const errors = [];
  const normalizedHeaders = headers.map(h => h.toLowerCase());
  
  for (const requiredField of template.requiredFields) {
    if (!normalizedHeaders.includes(requiredField.toLowerCase())) {
      errors.push(`Missing required column: ${requiredField}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
