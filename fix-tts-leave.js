const mongoose = require('mongoose');
require('dotenv').config();

const fixTTSLeave = async () => {
  console.log('🚀 Fixing TTS Leave Records...\n');

  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to main database');
    
    // Find TTS client
    const db = mongoose.connection.db;
    const ttsClient = await db.collection('clients').findOne({ name: 'TTS' });
    
    if (!ttsClient) {
      console.log('❌ TTS client not found');
      return;
    }
    
    console.log(`✅ Found TTS client: ${ttsClient._id}`);
    
    // Connect to TTS tenant database
    const tenantDbName = `tenant_${ttsClient._id}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    
    console.log(`📂 Accessing tenant database: ${tenantDbName}`);
    
    // Check for leaves collection
    const leavesCollection = tenantDb.collection('leaves');
    const totalLeaves = await leavesCollection.countDocuments();
    console.log(`📊 Total leave records: ${totalLeaves}`);
    
    // Find records with negative or zero days
    const invalidLeaves = await leavesCollection.find({
      $or: [
        { numberOfDays: { $lt: 0 } },
        { numberOfDays: 0 }
      ]
    }).toArray();
    
    console.log(`❌ Found ${invalidLeaves.length} records with negative/zero days\n`);
    
    for (const leave of invalidLeaves) {
      try {
        console.log(`🔧 Fixing leave ID: ${leave._id}`);
        console.log(`   Type: ${leave.leaveType}`);
        console.log(`   Current dates: ${leave.startDate} to ${leave.endDate}`);
        console.log(`   Current days: ${leave.numberOfDays}`);
        
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        
        // Fix dates if needed
        let fixedStartDate = leave.startDate;
        let fixedEndDate = leave.endDate;
        
        if (endDate < startDate) {
          fixedStartDate = leave.endDate;
          fixedEndDate = leave.startDate;
          console.log(`   🔄 Swapped dates to: ${fixedStartDate} to ${fixedEndDate}`);
        }
        
        // Calculate business days
        const businessDays = calculateBusinessDays(fixedStartDate, fixedEndDate);
        const correctDays = leave.halfDay ? 0.5 : Math.max(1, businessDays);
        
        // Update the record
        await leavesCollection.updateOne(
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
    
    // Verify the fix
    const remainingInvalid = await leavesCollection.countDocuments({
      $or: [
        { numberOfDays: { $lt: 0 } },
        { numberOfDays: 0 }
      ]
    });
    
    console.log(`✅ Fix completed! Remaining invalid records: ${remainingInvalid}`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Calculate business days (excluding weekends)
const calculateBusinessDays = (startDate, endDate) => {
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
fixTTSLeave();
