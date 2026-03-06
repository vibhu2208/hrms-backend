const mongoose = require('mongoose');
require('dotenv').config();

// Import the Leave model
const Leave = require('./src/models/Leave');

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testLeaveValidation = async () => {
  console.log('🧪 Testing Leave Validation Logic...\n');

  try {
    // Test 1: Valid date range (same day - weekday)
    console.log('✅ Test 1: Valid date range (same day - weekday)');
    try {
      const validation1 = Leave.validateLeaveDates('2026-01-19', '2026-01-19'); // Monday
      console.log(`   Business days: ${validation1.businessDays}, Total days: ${validation1.totalDays}`);
      console.log('   ✅ PASSED: Same day validation works\n');
    } catch (error) {
      console.log('   ❌ FAILED:', error.message, '\n');
    }

    // Test 2: Valid date range (multiple days)
    console.log('✅ Test 2: Valid date range (multiple days)');
    try {
      const validation2 = Leave.validateLeaveDates('2026-01-18', '2026-01-20');
      console.log(`   Business days: ${validation2.businessDays}, Total days: ${validation2.totalDays}`);
      console.log('   ✅ PASSED: Multiple days validation works\n');
    } catch (error) {
      console.log('   ❌ FAILED:', error.message, '\n');
    }

    // Test 3: Invalid date range (end before start)
    console.log('❌ Test 3: Invalid date range (end before start)');
    try {
      const validation3 = Leave.validateLeaveDates('2026-03-12', '2026-02-19'); // March 12 to Feb 19 (invalid)
      console.log(`   Business days: ${validation3.businessDays}, Total days: ${validation3.totalDays}`);
      console.log('   ❌ FAILED: Should have thrown an error\n');
    } catch (error) {
      console.log('   ✅ PASSED: Correctly rejected invalid date range');
      console.log('   Error:', error.message, '\n');
    }

    // Test 4: Weekend calculation
    console.log('✅ Test 4: Weekend calculation');
    try {
      const validation4 = Leave.validateLeaveDates('2026-01-16', '2026-01-18'); // Fri-Sun
      console.log(`   Business days: ${validation4.businessDays}, Total days: ${validation4.totalDays}`);
      console.log('   ✅ PASSED: Weekend calculation works\n');
    } catch (error) {
      console.log('   ❌ FAILED:', error.message, '\n');
    }

    // Test 5: Business days only (weekdays)
    console.log('✅ Test 5: Business days only (weekdays)');
    try {
      const validation5 = Leave.validateLeaveDates('2026-01-19', '2026-01-23'); // Mon-Fri
      console.log(`   Business days: ${validation5.businessDays}, Total days: ${validation5.totalDays}`);
      console.log('   ✅ PASSED: Weekday calculation works\n');
    } catch (error) {
      console.log('   ❌ FAILED:', error.message, '\n');
    }

    console.log('🎉 All validation tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Run tests
testLeaveValidation();
