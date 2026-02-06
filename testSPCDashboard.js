/**
 * Test SPC Dashboard Directly
 */

const axios = require('axios');

async function testSPCDashboard() {
  try {
    console.log('🧪 Testing SPC Dashboard Directly...');
    
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
      
      if (!token || !user) {
        console.log('❌ Invalid login response structure');
        console.log('   Full response:', JSON.stringify(loginResponse.data, null, 2));
        return;
      }
      
      console.log('✅ Login successful');
      console.log(`👤 User: ${user.email} (${user.role})`);
      console.log(`🔑 Token: ${token.substring(0, 50)}...`);
      
      // Test dashboard
      console.log('\n📊 Step 2: Test SPC Dashboard...');
      try {
        const dashboardResponse = await axios.get(`${baseURL}/api/spc/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Dashboard successful!');
        console.log('📊 Dashboard Data:');
        console.log(JSON.stringify(dashboardResponse.data, null, 2));
        
      } catch (error) {
        console.log('❌ Dashboard failed:');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data?.message);
        console.log('   Full Response:', JSON.stringify(error.response?.data, null, 2));
      }
      
    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSPCDashboard();
