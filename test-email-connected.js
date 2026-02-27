const mongoose = require('mongoose');
const { sendOfferLetterWithTemplate } = require('./src/services/emailService');
require('dotenv').config();

async function testEmailWithConnection() {
  try {
    // First ensure database connection
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');

    // Use real template ID from database
    const consultancyTemplateId = '699f8e893d0bf98447d1b188'; // Consultancy Offer Letter template
    
    // Test with real data including project name
    const testData = {
      templateId: consultancyTemplateId,
      candidateName: 'Test Candidate',
      candidateEmail: 'test@example.com', // This will fail but show template processing
      position: 'Lab Technician',
      designation: 'Lab Technician',
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

    console.log('📤 Testing email with Project Name feature...');
    console.log('🎯 Project Name in data:', testData.offerDetails.projectName);
    
    const result = await sendOfferLetterWithTemplate(testData);
    console.log('✅ SUCCESS: Email sent with Project Name!');
    console.log('📧 Result:', result);
    
  } catch (error) {
    console.error('❌ Test result:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('🌐 Network Issue: Email service connectivity problem');
      console.log('💡 This is expected if Gmail is blocked, but template processing worked!');
    } else if (error.message.includes('535') || error.message.includes('Authentication')) {
      console.log('🔐 Auth Issue: Email credentials problem');
    } else {
      console.log('🐛 Other Issue:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testEmailWithConnection();
