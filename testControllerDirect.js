/**
 * Test Controller Directly
 */

const mongoose = require('mongoose');

async function testControllerDirect() {
  try {
    console.log('🧪 Testing Controller Directly...');
    
    // Mock request object
    const mockReq = {
      user: {
        userId: '696bfa999239d1cecdf311a7',
        userRole: 'company_admin',
        email: 'admin@company.com'
      }
    };
    
    // Mock response object
    let responseData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          responseData = { status: code, data };
          console.log('📊 Response:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    // Import and test the controller
    const SPCProjectController = require('./src/controllers/spcProjectController');
    
    console.log('🔍 Testing getUserDashboard...');
    await SPCProjectController.getUserDashboard(mockReq, mockRes);
    
    if (responseData && responseData.data.success) {
      console.log('✅ Controller test successful!');
    } else {
      console.log('❌ Controller test failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testControllerDirect();
