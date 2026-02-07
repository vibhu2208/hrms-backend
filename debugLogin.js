// Debug login flow
const axios = require('axios');

async function debugLogin() {
  try {
    console.log('🔍 Debugging login flow...');
    
    // Test login
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'vibhu2208@gmail.com',
      password: 'manager123'
    });
    
    console.log('📋 Login response:', {
      success: loginResponse.data.success,
      message: loginResponse.data.message,
      user: loginResponse.data.data.user,
      token: loginResponse.data.data.token ? 'Present' : 'Missing'
    });
    
    if (loginResponse.data.success) {
      const user = loginResponse.data.data.user;
      console.log('👤 User info:');
      console.log('  - Email:', user.email);
      console.log('  - Role:', user.role);
      console.log('  - Name:', user.firstName + ' ' + user.lastName);
      console.log('  - Active:', user.isActive);
      
      // Test manager API
      const token = loginResponse.data.data.token;
      const api = axios.create({
        baseURL: 'http://localhost:5001/api',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('\n🧪 Testing manager API access...');
      try {
        const statsResponse = await api.get('/manager/team-stats');
        console.log('✅ Manager API works:', statsResponse.data.success);
      } catch (error) {
        console.log('❌ Manager API error:', error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugLogin();
