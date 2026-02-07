/**
 * Test Simple Dashboard Response
 */

const axios = require('axios');

async function testSimpleDashboard() {
  try {
    console.log('🧪 Testing Simple Dashboard...');
    
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
      
      // Test a simple endpoint first
      console.log('\n📊 Step 2: Test simple health endpoint...');
      try {
        const healthResponse = await axios.get(`${baseURL}/health`);
        console.log('✅ Health endpoint works:', healthResponse.data.message);
      } catch (error) {
        console.log('❌ Health endpoint failed:', error.message);
      }
      
      // Test regular dashboard
      console.log('\n📊 Step 3: Test regular dashboard...');
      try {
        const dashboardResponse = await axios.get(`${baseURL}/api/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Regular dashboard works!');
        console.log('📊 Dashboard has:', Object.keys(dashboardResponse.data).join(', '));
        
      } catch (error) {
        console.log('❌ Regular dashboard failed:', error.response?.data?.message);
      }
      
      // Test SPC dashboard
      console.log('\n📊 Step 4: Test SPC Dashboard...');
      try {
        const spcResponse = await axios.get(`${baseURL}/api/spc/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ SPC Dashboard works!');
        console.log('📊 SPC Dashboard Data:', spcResponse.data);
        
      } catch (error) {
        console.log('❌ SPC Dashboard failed:');
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

testSimpleDashboard();
