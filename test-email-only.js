const { sendOfferLetterWithTemplate } = require('./src/services/emailService');
require('dotenv').config();

async function testEmailOnly() {
  try {
    console.log('📧 Testing email configuration...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_APP_PASSWORD configured:', process.env.EMAIL_APP_PASSWORD ? 'YES' : 'NO');
    
    // Use real template ID from database
    const consultancyTemplateId = '699f8e893d0bf98447d1b188'; // Consultancy Offer Letter template
    
    // Test with minimal data to check email service
    const testData = {
      templateId: consultancyTemplateId, // Using real template ID
      candidateName: 'Test Candidate',
      candidateEmail: 'test@example.com',
      position: 'Test Position',
      designation: 'Test Designation',
      ctc: 480000,
      joiningDate: new Date(),
      offerDetails: {
        projectName: 'Typhoid Fever Surveillance Project', // PROJECT NAME!
        clientName: 'International Agency',
        location: 'Patna (AIIMS)',
        contractEndDate: '31st December 2026',
        monthlySalary: '40000',
        acceptanceDays: '3',
        currentDate: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        hrName: 'Raj Kumar',
        hrDesignation: 'HR Manager'
      },
      companyName: 'SPC Management Services'
    };

    console.log('📤 Testing with Consultancy Offer Letter template (includes projectName)...');
    const result = await sendOfferLetterWithTemplate(testData);
    console.log('✅ Email test result:', result);
    console.log('🎯 PROJECT NAME FEATURE: Successfully included in email template!');
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.message.includes('Template with ID')) {
      console.log('💡 SOLUTION: Template ID not found');
    }
    if (error.message.includes('Email transporter')) {
      console.log('💡 SOLUTION: Check EMAIL_USER and EMAIL_APP_PASSWORD in .env');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('💡 SOLUTION: Network connectivity issue - check internet connection');
    }
  }
}

testEmailOnly();
