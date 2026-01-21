const mongoose = require('mongoose');
const axios = require('axios');

async function testOffboardingDisplay() {
  try {
    console.log('🧪 Testing Offboarding Data Display...\n');

    // Start the backend server
    const { spawn } = require('child_process');
    const server = spawn('node', ['src/app.js'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      // Test the offboarding API
      console.log('📡 Testing offboarding API...');
      const response = await axios.get('http://localhost:5001/api/offboarding', {
        headers: {
          // Add any required headers here
        }
      });

      const offboardings = response.data.data || [];
      console.log(`📋 Found ${offboardings.length} offboarding records`);

      if (offboardings.length > 0) {
        offboardings.forEach((off, index) => {
          console.log(`\n--- Offboarding ${index + 1} ---`);
          console.log(`ID: ${off._id}`);
          console.log(`Status: ${off.status}`);

          if (off.employee) {
            console.log(`Employee Name: ${off.employee.firstName} ${off.employee.lastName}`);
            console.log(`Employee Email: ${off.employee.email}`);
            console.log(`Employee Code: ${off.employee.employeeCode}`);
            console.log(`Department: ${off.employee.department?.name || 'N/A'}`);

            const hasValidData = off.employee.firstName && off.employee.lastName && off.employee.email;
            console.log(`Data Valid: ${hasValidData ? '✅' : '❌'}`);
          } else {
            console.log('Employee: null ❌');
          }
        });
      }

      // Test individual offboarding detail
      if (offboardings.length > 0) {
        const firstOffboarding = offboardings[0];
        console.log(`\n📋 Testing individual offboarding detail for ID: ${firstOffboarding._id}`);

        const detailResponse = await axios.get(`http://localhost:5001/api/offboarding/${firstOffboarding._id}`);
        const detailData = detailResponse.data.data;

        if (detailData && detailData.employee) {
          console.log(`Detail Employee Name: ${detailData.employee.firstName} ${detailData.employee.lastName}`);
          console.log(`Detail Employee Email: ${detailData.employee.email}`);
          console.log('✅ Detail API working correctly');
        } else {
          console.log('❌ Detail API not returning employee data');
        }
      }

    } catch (apiError) {
      console.error('❌ API test failed:', apiError.message);
    }

    // Stop the server
    server.kill();

    console.log('\n🎉 Offboarding display test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOffboardingDisplay();