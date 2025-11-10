const axios = require('axios');

const testLoginAPI = async () => {
  try {
    console.log('🧪 Testing login API endpoint...');
    
    const loginData = {
      email: 'vaibhavsingh5373@gmail.com',
      password: 'admin123'
    };

    console.log('📧 Email:', loginData.email);
    console.log('🔑 Password:', loginData.password);
    console.log('🌐 Testing endpoint: http://localhost:5000/api/auth/login');

    const response = await axios.post('http://localhost:5000/api/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('\n✅ Login API Response:');
    console.log('📊 Status:', response.status);
    console.log('✅ Success:', response.data.success);
    console.log('📝 Message:', response.data.message);
    console.log('🎭 User Role:', response.data.data?.user?.role);
    console.log('🆔 User ID:', response.data.data?.user?.id);
    console.log('🔑 Token Present:', !!response.data.data?.token);

  } catch (error) {
    console.log('\n❌ Login API Error:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🚫 Connection refused - Backend server is not running');
      console.log('💡 Please start the backend server with: npm start or node server.js');
    } else if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📝 Error Message:', error.response.data?.message || 'Unknown error');
      console.log('📋 Full Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('🔥 Network Error:', error.message);
    }
  }
};

testLoginAPI();
