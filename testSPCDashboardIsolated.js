/**
 * Test SPC Dashboard Isolated (no cron jobs)
 */

const axios = require('axios');

async function testSPCDashboardIsolated() {
  try {
    console.log('🧪 Testing SPC Dashboard Isolated...');
    
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
      
      // Test SPC dashboard with a timeout to avoid cron job interference
      console.log('\n📊 Step 2: Test SPC Dashboard...');
      try {
        const dashboardResponse = await axios.get(`${baseURL}/api/spc/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 second timeout
        });
        
        console.log('✅ SPC Dashboard successful!');
        console.log('📊 Dashboard Data:');
        console.log(JSON.stringify(dashboardResponse.data, null, 2));
        
      } catch (error) {
        console.log('❌ SPC Dashboard failed:');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data?.message);
        
        if (error.response?.data?.error && error.response.data.error.includes('companyId')) {
          console.log('🔍 This is the companyId error we need to fix!');
        }
        
        console.log('   Full Response:', JSON.stringify(error.response?.data, null, 2));
      }
      
    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSPCDashboardIsolated();
