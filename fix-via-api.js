const axios = require('axios');

const fixViaAPI = async () => {
  try {
    console.log('🔧 Attempting to fix superadmin via running server...');
    
    // Since we can't directly access Atlas, let's create a temporary endpoint
    // First, let's check if we can reach the server
    const healthCheck = await axios.get('http://localhost:5001/api/auth/me', {
      timeout: 5001
    }).catch(err => {
      if (err.response && err.response.status === 401) {
        console.log('✅ Server is running (got expected 401 for unauthorized request)');
        return { status: 'server_running' };
      }
      throw err;
    });

    console.log('✅ Server is accessible');
    
    // Since we can't create an API endpoint easily, let's try a different approach
    console.log('\n💡 Alternative Solution:');
    console.log('Since your server is connected to Atlas, we need to either:');
    console.log('1. Update the Atlas database directly through MongoDB Compass');
    console.log('2. Or temporarily modify your server to use local MongoDB');
    
    console.log('\n🔧 Quick Fix Options:');
    console.log('Option 1: Use MongoDB Compass');
    console.log('- Connect to your Atlas cluster');
    console.log('- Navigate to hrms database > users collection');
    console.log('- Delete the existing superadmin user');
    console.log('- Create a new user with:');
    console.log('  {');
    console.log('    "email": "vaibhavsingh5373@gmail.com",');
    console.log('    "password": "admin123",');
    console.log('    "role": "superadmin",');
    console.log('    "isActive": true,');
    console.log('    "authProvider": "local"');
    console.log('  }');
    
    console.log('\nOption 2: Temporarily use local MongoDB');
    console.log('- Stop your server');
    console.log('- Change MONGO_URI in .env to: mongodb://127.0.0.1:27017/hrms');
    console.log('- Start server again');
    console.log('- Login (we already fixed the local database)');
    console.log('- Change back to Atlas later');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

fixViaAPI();
