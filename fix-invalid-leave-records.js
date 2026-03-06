const mongoose = require('mongoose');
require('dotenv').config();

// Import the Leave model
const Leave = require('./src/models/Leave');

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixInvalidLeaveRecords = async () => {
  console.log('🔧 Fixing Invalid Leave Records...\n');

  try {
    // Find all leave records
    const allLeaves = await Leave.find({});
    console.log(`Found ${allLeaves.length} total leave records\n`);

    let fixedCount = 0;
    let invalidCount = 0;

    for (const leave of allLeaves) {
      try {
        // Check if dates are valid
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        
        // Clear time for accurate comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < startDate) {
          console.log(`❌ Invalid leave record ID: ${leave._id}`);
          console.log(`   Employee: ${leave.employee}`);
          console.log(`   Leave Type: ${leave.leaveType}`);
          console.log(`   Invalid Date Range: ${leave.startDate} to ${leave.endDate}`);
          console.log(`   Current numberOfDays: ${leave.numberOfDays}`);
          
          invalidCount++;
          
          // Option 1: Swap the dates (if it seems like a data entry error)
          // Option 2: Delete the record (if it's completely invalid)
          // Option 3: Set to single day (start date)
          
          // For now, let's fix by swapping dates if it makes sense, or set to start date
          let fixedStartDate, fixedEndDate;
          
          // If the end date is much earlier than start date, likely a data entry error
          const daysDiff = Math.abs((endDate - startDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 365) {
            // Probably a year entry error, just use start date
            fixedStartDate = leave.startDate;
            fixedEndDate = leave.startDate;
            console.log(`   Fix: Setting to single day (${leave.startDate})`);
          } else {
            // Swap the dates
            fixedStartDate = leave.endDate;
            fixedEndDate = leave.startDate;
            console.log(`   Fix: Swapping dates to ${fixedStartDate} to ${fixedEndDate}`);
          }
          
          // Calculate correct number of days
          const validation = Leave.validateLeaveDates(fixedStartDate, fixedEndDate);
          const correctNumberOfDays = leave.halfDay ? 0.5 : validation.businessDays;
          
          // Update the record
          await Leave.findByIdAndUpdate(leave._id, {
            startDate: fixedStartDate,
            endDate: fixedEndDate,
            numberOfDays: correctNumberOfDays
          });
          
          console.log(`   ✅ Fixed: New numberOfDays = ${correctNumberOfDays}\n`);
          fixedCount++;
        } else {
          // Check if numberOfDays is correct
          const validation = Leave.validateLeaveDates(leave.startDate, leave.endDate);
          const correctNumberOfDays = leave.halfDay ? 0.5 : validation.businessDays;
          
          if (leave.numberOfDays !== correctNumberOfDays) {
            console.log(`⚠️  Incorrect numberOfDays for leave ID: ${leave._id}`);
            console.log(`   Date Range: ${leave.startDate} to ${leave.endDate}`);
            console.log(`   Current numberOfDays: ${leave.numberOfDays}`);
            console.log(`   Correct numberOfDays: ${correctNumberOfDays}`);
            
            // Update the numberOfDays
            await Leave.findByIdAndUpdate(leave._id, {
              numberOfDays: correctNumberOfDays
            });
            
            console.log(`   ✅ Fixed numberOfDays\n`);
            fixedCount++;
          }
        }
        
      } catch (error) {
        console.log(`❌ Error processing leave ${leave._id}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total records: ${allLeaves.length}`);
    console.log(`   Invalid date ranges: ${invalidCount}`);
    console.log(`   Records fixed: ${fixedCount}`);
    console.log(`   Valid records: ${allLeaves.length - fixedCount}`);
    
  } catch (error) {
    console.error('❌ Fix process failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Run the fix
fixInvalidLeaveRecords();
