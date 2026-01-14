/**
 * Historical Leave Data Migration Utility
 * Migrates historical leave data from CSV/Excel files
 * Usage: node src/scripts/migrateLeaveHistory.js <companyId> <filePath>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { getTenantConnection } = require('../config/database.config');
const LeaveBalanceSchema = require('../models/tenant/LeaveBalance');
const TenantUserSchema = require('../models/tenant/TenantUser');

/**
 * Validate leave history record
 */
function validateRecord(record, rowNum) {
  const errors = [];
  const warnings = [];

  if (!record['Employee Email'] && !record['Employee Code']) {
    errors.push(`Row ${rowNum}: Employee Email or Employee Code is required`);
  }

  if (!record['Year']) {
    errors.push(`Row ${rowNum}: Year is required`);
  } else {
    const year = parseInt(record['Year']);
    if (isNaN(year) || year < 2000 || year > 2100) {
      errors.push(`Row ${rowNum}: Invalid year`);
    }
  }

  if (!record['Leave Type']) {
    errors.push(`Row ${rowNum}: Leave Type is required`);
  }

  const validLeaveTypes = [
    'Personal Leave', 'Sick Leave', 'Casual Leave', 'Comp Offs',
    'Floater Leave', 'Marriage Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'
  ];
  if (record['Leave Type'] && !validLeaveTypes.includes(record['Leave Type'])) {
    errors.push(`Row ${rowNum}: Invalid leave type: ${record['Leave Type']}`);
  }

  if (record['Total'] !== undefined && isNaN(parseFloat(record['Total']))) {
    errors.push(`Row ${rowNum}: Invalid total value`);
  }

  if (record['Consumed'] !== undefined && isNaN(parseFloat(record['Consumed']))) {
    errors.push(`Row ${rowNum}: Invalid consumed value`);
  }

  if (record['Carried Forward'] !== undefined && isNaN(parseFloat(record['Carried Forward']))) {
    warnings.push(`Row ${rowNum}: Invalid carried forward value, will be set to 0`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Migrate leave history from file
 */
async function migrateLeaveHistory(companyId, filePath) {
  let tenantConnection = null;

  try {
    console.log(`📊 Starting leave history migration for company: ${companyId}`);
    console.log(`📁 File: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read Excel/CSV file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      throw new Error('No data found in file');
    }

    console.log(`📋 Found ${data.length} records to process`);

    // Get tenant connection
    tenantConnection = await getTenantConnection(companyId);
    const LeaveBalance = tenantConnection.model('LeaveBalance', LeaveBalanceSchema);
    const TenantUser = tenantConnection.model('User', TenantUserSchema);

    const results = {
      total: data.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: []
    };

    // Process each record
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const rowNum = i + 2; // Excel row number (assuming header is row 1)

      try {
        // Validate record
        const validation = validateRecord(record, rowNum);
        if (!validation.valid) {
          results.failed++;
          results.errors.push(...validation.errors);
          continue;
        }
        if (validation.warnings.length > 0) {
          results.warnings.push(...validation.warnings);
        }

        // Find employee
        let employee = null;
        if (record['Employee Email']) {
          employee = await TenantUser.findOne({
            email: record['Employee Email'].toLowerCase().trim(),
            isActive: true
          });
        } else if (record['Employee Code']) {
          // Note: Employee code might need to be stored in a different field
          // This is a placeholder - adjust based on your schema
          employee = await TenantUser.findOne({
            employeeCode: record['Employee Code'].trim(),
            isActive: true
          });
        }

        if (!employee) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: `Employee not found: ${record['Employee Email'] || record['Employee Code']}`
          });
          continue;
        }

        const year = parseInt(record['Year']);
        const leaveType = record['Leave Type'].trim();
        const total = parseFloat(record['Total']) || 0;
        const consumed = parseFloat(record['Consumed']) || 0;
        const carriedForward = parseFloat(record['Carried Forward']) || 0;
        const accrued = total - carriedForward;

        // Check if balance already exists
        const existingBalance = await LeaveBalance.findOne({
          employeeEmail: employee.email,
          year: year,
          leaveType: leaveType
        });

        if (existingBalance) {
          // Update existing balance
          existingBalance.total = total;
          existingBalance.consumed = consumed;
          existingBalance.accrued = accrued;
          existingBalance.carriedForward = carriedForward;
          existingBalance.available = total - consumed;

          // Add migration note to history
          if (!existingBalance.accrualHistory) {
            existingBalance.accrualHistory = [];
          }
          existingBalance.accrualHistory.push({
            accrualDate: new Date(year, 0, 1),
            amount: accrued,
            type: 'adjustment',
            notes: `Migrated from historical data`
          });

          await existingBalance.save();
          results.success++;
        } else {
          // Create new balance
          const balance = new LeaveBalance({
            employeeId: employee._id,
            employeeEmail: employee.email,
            year: year,
            leaveType: leaveType,
            total: total,
            consumed: consumed,
            accrued: accrued,
            carriedForward: carriedForward,
            available: total - consumed,
            lastAccrualDate: new Date(year, 0, 1),
            accrualHistory: [{
              accrualDate: new Date(year, 0, 1),
              amount: accrued,
              type: 'adjustment',
              notes: `Migrated from historical data`
            }]
          });

          await balance.save();
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          error: error.message
        });
      }
    }

    if (tenantConnection) await tenantConnection.close();

    console.log(`\n✅ Migration completed:`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Success: ${results.success}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Skipped: ${results.skipped}`);

    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach(err => console.log(`   - ${err.row ? `Row ${err.row}: ` : ''}${err.error}`));
    }

    if (results.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      results.warnings.forEach(warn => console.log(`   - ${warn}`));
    }

    return results;
  } catch (error) {
    if (tenantConnection) await tenantConnection.close();
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node migrateLeaveHistory.js <companyId> <filePath>');
    console.error('Example: node migrateLeaveHistory.js 507f1f77bcf86cd799439011 ./leave-history.xlsx');
    process.exit(1);
  }

  const [companyId, filePath] = args;

  // Connect to database
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to database');
      return migrateLeaveHistory(companyId, filePath);
    })
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateLeaveHistory, validateRecord };


