// Test SPC Manager API endpoints
const axios = require('axios');

async function testSPCAPI() {
  try {
    console.log('🧪 Testing SPC Manager API endpoints...');
    
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
    
    // Test SPC manager team stats
    console.log('\n📊 Testing /spc-manager/team-stats...');
    try {
      const statsResponse = await api.get('/spc-manager/team-stats');
      console.log('✅ Team stats response:', statsResponse.data);
    } catch (error) {
      console.log('❌ Team stats error:', error.response?.data || error.message);
    }
    
    // Test SPC manager projects
    console.log('\n📊 Testing /spc-manager/projects...');
    try {
      const projectsResponse = await api.get('/spc-manager/projects');
      console.log('✅ Projects response:', projectsResponse.data);
    } catch (error) {
      console.log('❌ Projects error:', error.response?.data || error.message);
    }
    
    // Test regular manager team stats for comparison
    console.log('\n📊 Testing /manager/team-stats...');
    try {
      const regularStatsResponse = await api.get('/manager/team-stats');
      console.log('✅ Regular manager team stats response:', regularStatsResponse.data);
    } catch (error) {
      console.log('❌ Regular manager team stats error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSPCAPI();
