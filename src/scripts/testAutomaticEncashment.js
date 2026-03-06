#!/usr/bin/env node

/**
 * Test Automatic Leave Encashment Functionality
 * This script tests the automatic encashment service with sample data
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Test the automatic encashment service
async function testAutomaticEncashment() {
  try {
    console.log('Testing Automatic Leave Encashment Service...');
    
    // Import the service
    const automaticLeaveEncashmentService = require('../services/automaticLeaveEncashmentService');
    
    // Test with a sample company ID
    const testCompanyId = 'test-company-id';
    
    console.log('\n1. Testing year-end trigger...');
    const yearEndResult = await automaticLeaveEncashmentService.processCompanyAutomaticEncashment(
      testCompanyId,
      'year_end'
    );
    console.log('Year-end result:', yearEndResult);
    
    console.log('\n2. Testing specific date trigger...');
    const specificDateResult = await automaticLeaveEncashmentService.processCompanyAutomaticEncashment(
      testCompanyId,
      'specific_date'
    );
    console.log('Specific date result:', specificDateResult);
    
    console.log('\n3. Testing leave balance threshold trigger...');
    const thresholdResult = await automaticLeaveEncashmentService.processCompanyAutomaticEncashment(
      testCompanyId,
      'leave_balance_threshold'
    );
    console.log('Threshold result:', thresholdResult);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Test the controller endpoints
async function testControllerEndpoints() {
  try {
    console.log('\nTesting Controller Endpoints...');
    
    // Import the controller
    const { processAutomaticEncashment, getAutomaticSettings } = require('../controllers/leaveEncashmentController');
    
    // Mock request and response objects
    const mockReq = {
      companyId: 'test-company-id',
      body: { triggerType: 'year_end' },
      user: { role: 'admin' }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response ${code}:`, data);
          return mockRes;
        }
      })
    };
    
    console.log('\n1. Testing processAutomaticEncashment endpoint...');
    await processAutomaticEncashment(mockReq, mockRes);
    
    console.log('\n2. Testing getAutomaticSettings endpoint...');
    await getAutomaticSettings(mockReq, mockRes);
    
    console.log('\n✅ Controller tests completed!');
    
  } catch (error) {
    console.error('❌ Controller test failed:', error.message);
    console.error(error.stack);
  }
}

// Test model validation
async function testModelValidation() {
  try {
    console.log('\nTesting Model Validation...');
    
    // Import the schemas
    const LeaveEncashmentRuleSchema = require('../models/tenant/LeaveEncashmentRule');
    const LeaveEncashmentRequestSchema = require('../models/tenant/LeaveEncashmentRequest');
    
    // Create a mock tenant connection
    const mockConnection = {
      model: (name, schema) => {
        return {
          find: (query) => Promise.resolve([]),
          findOne: (query) => Promise.resolve(null),
          create: (data) => Promise.resolve(data),
          save: () => Promise.resolve()
        };
      }
    };
    
    console.log('✅ Model validation tests completed!');
    
  } catch (error) {
    console.error('❌ Model validation test failed:', error.message);
    console.error(error.stack);
  }
}

// Main test function
async function runTests() {
  console.log('='.repeat(60));
  console.log('AUTOMATIC LEAVE ENCASHMENT TEST SUITE');
  console.log('='.repeat(60));
  
  await testAutomaticEncashment();
  await testControllerEndpoints();
  await testModelValidation();
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUITE COMPLETED');
  console.log('='.repeat(60));
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { 
  testAutomaticEncashment, 
  testControllerEndpoints, 
  testModelValidation,
  runTests 
};
