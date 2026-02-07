/**
 * Test with Debug Output
 */

const axios = require('axios');

async function testWithDebug() {
  try {
    console.log('🧪 Testing with Debug Output...');
    
    const baseURL = 'http://localhost:5001';
    
    // Login as admin
    console.log('\n🔐 Step 1: Login as admin...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@company.com',
      password: 'password123'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.token || loginResponse.data.data?.token;
      const user = loginResponse.data.user || loginResponse.data.data?.user;
      
      console.log('✅ Login successful');
      console.log(`👤 User: ${user.email} (${user.role})`);
      
      // Test SPC dashboard with debug
      console.log('\n📊 Step 2: Test SPC Dashboard...');
      console.log('🔍 Check server console for debug output...');
      
      try {
        const dashboardResponse = await axios.get(`${baseURL}/api/spc/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });
        
        console.log('✅ SPC Dashboard successful!');
        console.log('📊 Dashboard Data:');
        console.log(JSON.stringify(dashboardResponse.data, null, 2));
        
      } catch (error) {
        console.log('❌ SPC Dashboard failed:');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data?.message);
        
        if (error.response?.data?.error) {
          console.log('🔍 Error details:', error.response.data.error);
        }
        
        console.log('   Full Response:', JSON.stringify(error.response?.data, null, 2));
        
        // Check if we can see the debug output in the server
        console.log('\n🔍 Please check the server console for debug output starting with "🔍 getUserDashboard called"');
      }
      
    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWithDebug();
