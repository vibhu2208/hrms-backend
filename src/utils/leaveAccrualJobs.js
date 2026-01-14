const cron = require('node-cron');
const Company = require('../models/Company');
const leaveAccrualService = require('../services/leaveAccrualService');

/**
 * Leave Accrual Scheduled Jobs
 * Automated accrual processing via cron jobs
 */

// Process monthly accrual on the 1st of each month at 2 AM
const processMonthlyAccrual = cron.schedule('0 2 1 * *', async () => {
  try {
    console.log('🔄 Running monthly leave accrual...');
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    // Get all active companies
    const companies = await Company.find({ isActive: true });

    const results = {
      total: companies.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const company of companies) {
      try {
        const result = await leaveAccrualService.processMonthlyAccrual(
          company._id.toString(),
          month,
          year
        );
        results.success++;
        console.log(`✅ Monthly accrual completed for ${company.name}: ${result.message}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          company: company.name,
          error: error.message
        });
        console.error(`❌ Monthly accrual failed for ${company.name}:`, error.message);
      }
    }

    console.log(`✅ Monthly accrual completed: ${results.success}/${results.total} companies`);
  } catch (error) {
    console.error('❌ Error in monthly accrual job:', error);
  }
}, {
  scheduled: false
});

// Process yearly accrual on January 1st at 3 AM
const processYearlyAccrual = cron.schedule('0 3 1 1 *', async () => {
  try {
    console.log('🔄 Running yearly leave accrual...');
    const currentDate = new Date();
    const year = currentDate.getFullYear();

    const companies = await Company.find({ isActive: true });

    const results = {
      total: companies.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const company of companies) {
      try {
        const result = await leaveAccrualService.processYearlyAccrual(
          company._id.toString(),
          year
        );
        results.success++;
        console.log(`✅ Yearly accrual completed for ${company.name}: ${result.message}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          company: company.name,
          error: error.message
        });
        console.error(`❌ Yearly accrual failed for ${company.name}:`, error.message);
      }
    }

    console.log(`✅ Yearly accrual completed: ${results.success}/${results.total} companies`);
  } catch (error) {
    console.error('❌ Error in yearly accrual job:', error);
  }
}, {
  scheduled: false
});

// Process carry forward on January 1st at 4 AM (after yearly accrual)
const processCarryForward = cron.schedule('0 4 1 1 *', async () => {
  try {
    console.log('🔄 Running carry forward processing...');
    const currentDate = new Date();
    const fromYear = currentDate.getFullYear() - 1;
    const toYear = currentDate.getFullYear();

    const companies = await Company.find({ isActive: true });

    const results = {
      total: companies.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const company of companies) {
      try {
        const result = await leaveAccrualService.processCarryForward(
          company._id.toString(),
          fromYear,
          toYear
        );
        results.success++;
        console.log(`✅ Carry forward completed for ${company.name}: ${result.message}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          company: company.name,
          error: error.message
        });
        console.error(`❌ Carry forward failed for ${company.name}:`, error.message);
      }
    }

    console.log(`✅ Carry forward completed: ${results.success}/${results.total} companies`);
  } catch (error) {
    console.error('❌ Error in carry forward job:', error);
  }
}, {
  scheduled: false
});

// Process carry forward expiry on the 1st of each month at 5 AM
const processCarryForwardExpiry = cron.schedule('0 5 1 * *', async () => {
  try {
    console.log('🔄 Running carry forward expiry check...');
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const companies = await Company.find({ isActive: true });

    const results = {
      total: companies.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const company of companies) {
      try {
        const result = await leaveAccrualService.processCarryForwardExpiry(
          company._id.toString(),
          year,
          month
        );
        results.success++;
        if (result.data.lapsed > 0) {
          console.log(`✅ Expiry processed for ${company.name}: ${result.data.lapsed} leaves lapsed`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          company: company.name,
          error: error.message
        });
        console.error(`❌ Expiry processing failed for ${company.name}:`, error.message);
      }
    }

    console.log(`✅ Carry forward expiry check completed: ${results.success}/${results.total} companies`);
  } catch (error) {
    console.error('❌ Error in carry forward expiry job:', error);
  }
}, {
  scheduled: false
});

// Start all accrual cron jobs
const startAccrualJobs = () => {
  processMonthlyAccrual.start();
  processYearlyAccrual.start();
  processCarryForward.start();
  processCarryForwardExpiry.start();
  console.log('✅ Leave accrual cron jobs started');
};

// Stop all accrual cron jobs
const stopAccrualJobs = () => {
  processMonthlyAccrual.stop();
  processYearlyAccrual.stop();
  processCarryForward.stop();
  processCarryForwardExpiry.stop();
  console.log('⏹️  Leave accrual cron jobs stopped');
};

module.exports = {
  startAccrualJobs,
  stopAccrualJobs,
  processMonthlyAccrual,
  processYearlyAccrual,
  processCarryForward,
  processCarryForwardExpiry
};


