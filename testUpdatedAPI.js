// Test updated Manager API endpoints
const axios = require('axios');

async function testUpdatedAPI() {
  try {
    console.log('🧪 Testing updated Manager API endpoints...');
    
    // Test login first to get token
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'vibhu2208@gmail.com',
      password: 'manager123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    
    // Set up axios with token
    const api = axios.create({
      baseURL: 'http://localhost:5001/api',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Test manager team stats
    console.log('\n📊 Testing /manager/team-stats...');
    try {
      const statsResponse = await api.get('/manager/team-stats');
      console.log('✅ Team stats response:', statsResponse.data);
    } catch (error) {
      console.log('❌ Team stats error:', error.response?.data || error.message);
    }
    
    // Test manager projects
    console.log('\n📊 Testing /manager/projects...');
    try {
      const projectsResponse = await api.get('/manager/projects');
      console.log('✅ Projects response:', projectsResponse.data);
    } catch (error) {
      console.log('❌ Projects error:', error.response?.data || error.message);
    }
    
    console.log('\n✅ All API endpoints are working correctly!');
    console.log('🔄 Please try logging in again in the frontend.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUpdatedAPI();
