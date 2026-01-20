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
    const originalHeaders = rows[0];
    console.log('Original headers from file:', originalHeaders);
    console.log('Original headers count:', originalHeaders.length);

    const headers = normalizeHeaders(rows[0]);
    console.log('Normalized headers:', headers);
    console.log('Normalized headers count:', headers.length);

    // Check required fields mapping
    console.log('Required fields check:');
    template.requiredFields.forEach(field => {
      const headerIndex = headers.indexOf(field);
      console.log(`  ${field}: ${headerIndex >= 0 ? 'FOUND at index ' + headerIndex : 'NOT FOUND'}`);
    });

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
        const originalValue = row[index];
        rowData[header] = originalValue || '';
        console.log(`  Row ${rowNumber}, Field "${header}": "${originalValue}" (index ${index})`);
      });

      console.log(`Row ${rowNumber} complete data:`, rowData);

      // Validate required fields (using normalized field names)
      console.log(`Row ${rowNumber} - Validating required fields:`, template.requiredFields);
      for (const field of template.requiredFields) {
        // Convert camelCase to lowercase for matching normalized headers
        const normalizedField = field.toLowerCase();
        const fieldValue = rowData[normalizedField];
        const isEmpty = !fieldValue || String(fieldValue).trim() === '';

        console.log(`  Row ${rowNumber} - ${field} (checking ${normalizedField}): "${fieldValue}" (${isEmpty ? 'EMPTY' : 'OK'})`);

        if (isEmpty) {
          const actualValue = fieldValue || 'empty';
          const displayValue = actualValue === 'empty' ? 'empty' : `"${actualValue}"`;
          // Change from error to warning - allow empty fields for flexibility
          rowWarnings.push(`Row ${rowNumber}: ${field} is empty (${displayValue}) - will be saved as empty`);
        }
      }

      // Validate field formats (using normalized field names)
      for (const [field, rules] of Object.entries(template.fieldRules)) {
        const normalizedField = field.toLowerCase();
        const value = rowData[normalizedField];
        
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

      // Validate email format (warning instead of error)
      if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rowData.email).trim())) {
        rowWarnings.push(`Row ${rowNumber}: Email format may be invalid`);
      }

      // Validate phone format (warning instead of error)
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

    console.log('Import request received. validatedData length:', validatedData?.length);
    console.log('First few records sample:', validatedData?.slice(0, 2));

    if (!validatedData || !Array.isArray(validatedData) || validatedData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No validated data provided'
      });
    }

    const Candidate = getTenantModel(req.tenant.connection, 'Candidate');

    // Test if we can create candidates at all
    console.log('Testing candidate model...');

    try {
      const testCandidate = new Candidate({
        candidateCode: 'TEST001',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        appliedForTitle: 'Test Job',
        stage: 'applied',
        status: 'active'
      });
      await testCandidate.save();
      console.log('✅ Test candidate created successfully');
      // Clean up test candidate
      await Candidate.findOneAndDelete({ candidateCode: 'TEST001' });
      console.log('✅ Test candidate cleaned up');
    } catch (testError) {
      console.error('❌ Test candidate creation failed:', testError.message);
      return res.status(500).json({
        success: false,
        message: 'Database connection issue - cannot create candidates',
        error: testError.message
      });
    }

    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    console.log(`Starting import of ${validatedData.length} candidates...`);

    for (const candidateData of validatedData) {
      console.log(`🔄 Processing candidate ${candidateData.email}...`);

        // Check for duplicates
        const existingCandidate = await Candidate.findOne({
          $or: [
            { email: candidateData.email?.toLowerCase().trim() },
            { phone: String(candidateData.phone)?.replace(/\D/g, '') }
          ]
        });

        if (existingCandidate) {
          console.log(`Duplicate found for ${candidateData.email}: ${existingCandidate.firstName} ${existingCandidate.lastName}`);
          results.duplicates.push({
            email: candidateData.email,
            reason: 'Candidate with this email or phone already exists'
          });
          continue;
        }

        // Skip job validation - just use the job title as-is or set to null if empty
        let appliedForValue = null;
        if (candidateData.appliedfor && candidateData.appliedfor.trim()) {
          appliedForValue = candidateData.appliedfor.trim();
          console.log(`Using job title: "${appliedForValue}" for candidate ${candidateData.email}`);
        } else {
          console.log(`No job title provided for candidate ${candidateData.email}`);
        }

        // Generate unique candidate code (handle race conditions)
        let candidateCode;
        let attempts = 0;
        const maxAttempts = 20;

        console.log(`Generating candidate code for ${candidateData.email}...`);

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

            console.log(`Generated candidate code: ${candidateCode} (attempt ${attempts + 1})`);

            // Check if this code already exists (race condition check)
            const existing = await Candidate.findOne({ candidateCode });
            if (existing) {
              console.log(`Candidate code ${candidateCode} already exists, trying next...`);
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

        // Create candidate - handle empty fields gracefully
        const candidate = new Candidate({
          candidateCode,
          firstName: candidateData.firstname?.trim() || '',
          lastName: candidateData.lastname?.trim() || '',
          email: candidateData.email?.toLowerCase().trim() || '',
          phone: String(candidateData.phone)?.trim() || '',
          alternatePhone: candidateData.alternatephone ? String(candidateData.alternatephone).trim() : null,
          currentLocation: candidateData.currentlocation?.trim() || null,
          preferredLocation: candidateData.preferredlocation || [],
          source: candidateData.source?.trim().toLowerCase() || 'other',
          // appliedFor: appliedForValue, // Skip this - model expects ObjectId reference to JobPosting
          experience: {
            years: parseInt(candidateData.experienceyears) || 0,
            months: parseInt(candidateData.experiencemonths) || 0
          },
          currentCompany: candidateData.currentcompany?.trim() || null,
          currentDesignation: candidateData.currentdesignation?.trim() || null,
          currentCTC: candidateData.currentctc ? parseFloat(candidateData.currentctc) : null,
          expectedCTC: candidateData.expectedctc ? parseFloat(candidateData.expectedctc) : null,
          noticePeriod: candidateData.noticeperiod ? parseInt(candidateData.noticeperiod) : null,
          skills: candidateData.skills || [],
          stage: candidateData.stage?.trim() || 'applied',
          status: 'active',
          notes: candidateData.notes?.trim() || null,
          appliedForTitle: appliedForValue // Store job title as string
        });

        console.log(`About to save candidate object for ${candidateData.email}:`, {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          appliedFor: candidate.appliedFor,
          candidateCode: candidate.candidateCode
        });

        console.log(`Attempting to save candidate ${candidateData.email}...`);

        try {
          const savedCandidate = await candidate.save();

          console.log(`✅ Successfully created candidate: ${savedCandidate.email} (${savedCandidate.candidateCode})`);

          results.success.push({
            email: savedCandidate.email,
            candidateId: savedCandidate._id,
            candidateCode: savedCandidate.candidateCode
          });
        } catch (saveError) {
          console.error(`❌ Failed to save candidate ${candidateData.email}:`, saveError.message);
          console.error('❌ Full error object:', saveError);
          console.error('❌ Candidate data that failed:', {
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email,
            phone: candidate.phone,
            appliedFor: candidate.appliedFor,
            appliedForTitle: candidate.appliedForTitle,
            candidateCode: candidate.candidateCode
          });

          results.failed.push({
            email: candidateData.email,
            reason: `Database save failed: ${saveError.message}`
          });
          continue;
        }
    }

    console.log(`Import complete: ${results.success.length} imported, ${results.failed.length} failed, ${results.duplicates.length} duplicates`);

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
  console.log('🔄 Starting header normalization for', headers.length, 'headers');

  return headers.map((header, index) => {
    const original = String(header).trim();
    const normalized = original.toLowerCase();

    console.log(`  Header ${index + 1}: "${original}" -> normalized: "${normalized}"`);

    // First try exact mapping
    if (template.headerMapping[normalized]) {
      console.log(`    ✅ Exact match: "${original}" -> "${template.headerMapping[normalized]}"`);
      return template.headerMapping[normalized];
    }

    // Try to find partial matches (e.g., "first" should match "firstName")
    for (const [mappedHeader, fieldName] of Object.entries(template.headerMapping)) {
      if (normalized.includes(mappedHeader) || mappedHeader.includes(normalized)) {
        console.log(`    🔄 Partial match: "${original}" contains/similar to "${mappedHeader}" -> "${fieldName}"`);
        return fieldName;
      }
    }

    // Fallback: try to camelCase common patterns
    const camelCased = normalized
      .replace(/\s+/g, '') // remove spaces
      .replace(/_/g, '')   // remove underscores
      .replace(/-+/g, '')  // remove dashes
      .replace(/^[a-z]/, c => c.toLowerCase()) // ensure first letter lowercase
      .replace(/([a-z])([A-Z])/g, '$1$2'); // handle existing camelCase

    console.log(`    ⚠️ Fallback: "${original}" -> "${camelCased}" (no mapping found)`);
    return camelCased;
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
