/**
 * Test API Connection and SPC Endpoints
 */

const axios = require('axios');

async function testAPIConnection() {
  try {
    console.log('🧪 Testing API Connection...');
    
    const baseURL = 'http://localhost:5001'; // Updated to match server port
    
    // Test 1: Check if server is running
    console.log('\n📡 Step 1: Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/health`);
      console.log('✅ Server is running:', healthResponse.data.message);
    } catch (error) {
      console.log('❌ Server is not running or not accessible');
      console.log('   Error:', error.message);
      console.log('   Please start your backend server with: npm start');
      return;
    }
    
    // Test 2: Test authentication
    console.log('\n🔐 Step 2: Testing authentication...');
    try {
      const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'admin@company.com',
        password: 'password123' // Updated with correct password
      });
      
      if (loginResponse.data.success) {
        console.log('✅ Authentication successful');
        const token = loginResponse.data.token || loginResponse.data.data?.token;
        if (!token) {
          console.log('❌ No token found in response');
          console.log('   Response data:', JSON.stringify(loginResponse.data, null, 2));
          return;
        }
        console.log(`🔑 Token received: ${token.substring(0, 50)}...`);
        console.log(`👤 User role: ${loginResponse.data.user?.role || loginResponse.data.data?.user?.role}`);
        console.log(`👤 User email: ${loginResponse.data.user?.email || loginResponse.data.data?.user?.email}`);
        
        // Test 3: Test SPC dashboard endpoint
        console.log('\n📊 Step 3: Testing SPC dashboard endpoint...');
        try {
          const dashboardResponse = await axios.get(`${baseURL}/api/spc/dashboard`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (dashboardResponse.data.success) {
            console.log('✅ SPC dashboard endpoint working');
            console.log(`   Projects: ${dashboardResponse.data.data.projects?.length || 0}`);
            console.log(`   Team Members: ${dashboardResponse.data.data.teamMembers?.length || 0}`);
          } else {
            console.log('❌ SPC dashboard returned error:', dashboardResponse.data.message);
          }
        } catch (error) {
          console.log('❌ SPC dashboard endpoint failed:');
          console.log('   Error:', error.response?.data?.message || error.message);
          console.log('   Status:', error.response?.status);
          console.log('   Response:', JSON.stringify(error.response?.data, null, 2));
          
          if (error.response?.status === 404) {
            console.log('   💡 This might mean the SPC routes are not properly loaded');
          } else if (error.response?.status === 403) {
            console.log('   💡 This might mean the user does not have permission');
          } else if (error.response?.status === 401) {
            console.log('   💡 This might mean authentication is failing for SPC routes');
          }
        }
        
        // Test 4: Test projects endpoint
        console.log('\n📋 Step 4: Testing projects endpoint...');
        try {
          const projectsResponse = await axios.get(`${baseURL}/api/spc/projects`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (projectsResponse.data.success) {
            console.log('✅ Projects endpoint working');
            console.log(`   Projects found: ${projectsResponse.data.data?.length || 0}`);
          } else {
            console.log('❌ Projects endpoint returned error:', projectsResponse.data.message);
          }
        } catch (error) {
          console.log('❌ Projects endpoint failed:');
          console.log('   Error:', error.response?.data?.message || error.message);
          console.log('   Status:', error.response?.status);
        }
        
      } else {
        console.log('❌ Authentication failed:', loginResponse.data.message);
      }
    } catch (error) {
      console.log('❌ Authentication endpoint failed:');
      console.log('   Error:', error.response?.data?.message || error.message);
      console.log('   Status:', error.response?.status);
    }
    
    console.log('\n🎉 API Connection Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAPIConnection();
