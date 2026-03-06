const mongoose = require('mongoose');
require('dotenv').config();

// Direct connection to your database
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Simple Leave schema for direct access
const leaveSchema = new mongoose.Schema({}, { strict: false });
const Leave = mongoose.model('Leave', leaveSchema);

const quickFixNegativeDays = async () => {
  console.log('🚀 Quick Fix for Negative Days...\n');

  try {
    // Find all records with negative days or invalid dates
    const invalidLeaves = await Leave.find({
      $or: [
        { numberOfDays: { $lt: 0 } },
        { numberOfDays: 0 }
      ]
    });
    
    console.log(`Found ${invalidLeaves.length} records with negative/zero days\n`);

    for (const leave of invalidLeaves) {
      try {
        console.log(`🔧 Fixing leave ID: ${leave._id}`);
        console.log(`   Type: ${leave.leaveType}`);
        console.log(`   Current dates: ${leave.startDate} to ${leave.endDate}`);
        console.log(`   Current days: ${leave.numberOfDays}`);
        
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        
        // Simple fix: if end date is before start, swap them
        let fixedStartDate = leave.startDate;
        let fixedEndDate = leave.endDate;
        
        if (endDate < startDate) {
          fixedStartDate = leave.endDate;
          fixedEndDate = leave.startDate;
          console.log(`   🔄 Swapped dates to: ${fixedStartDate} to ${fixedEndDate}`);
        }
        
        // Calculate business days (simple version)
        const businessDays = calculateSimpleBusinessDays(fixedStartDate, fixedEndDate);
        const correctDays = leave.halfDay ? 0.5 : Math.max(1, businessDays);
        
        // Update the record
        await Leave.updateOne(
          { _id: leave._id },
          { 
            startDate: fixedStartDate,
            endDate: fixedEndDate,
            numberOfDays: correctDays
          }
        );
        
        console.log(`   ✅ Fixed: New days = ${correctDays}\n`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
    console.log('✅ Quick fix completed!');
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Simple business day calculator
const calculateSimpleBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let days = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

// Run the fix
quickFixNegativeDays();
