const axios = require('axios');

async function testSendOfferAPI() {
  try {
    console.log('🧪 Testing Send Offer API call (simulating frontend)...');
    
    // This simulates the exact API call from frontend
    const testData = {
      templateId: '699f8e893d0bf98447d1b188', // Consultancy Offer Letter template
      clientName: 'International Agency',
      location: 'Patna (AIIMS)',
      employmentStartDate: '2025-12-31',
      contractEndDate: '2026-12-31',
      monthlySalary: '40000',
      projectName: 'Typhoid Fever Surveillance Project', // PROJECT NAME!
      additionalDetails: {
        designation: 'Lab Technician',
        benefits: 'Standard benefits package',
        hrName: 'Raj Kumar',
        hrDesignation: 'HR Manager'
      }
    };

    console.log('📤 Sending request to backend...');
    console.log('🎯 Project Name:', testData.projectName);
    
    // You'll need to replace this with a real onboarding ID and auth token
    // For now, this will show us the exact error structure
    const response = await axios.post('http://localhost:5001/api/onboarding/test-id/send-offer', testData, {
      headers: {
        'Authorization': 'Bearer YOUR_AUTH_TOKEN_HERE',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response:', response.data);
    
  } catch (error) {
    console.error('❌ API Test Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testSendOfferAPI();
