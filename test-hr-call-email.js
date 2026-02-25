require('dotenv').config();
const { sendInterviewNotification } = require('./src/services/emailService');

async function testHRCallEmail() {
  try {
    console.log('Testing HR Call interview email...\n');
    
    // Test with HR Call interview type
    const result = await sendInterviewNotification({
      candidateName: 'Test Candidate',
      candidateEmail: 'krishnaupadhyay207@gmail.com',
      interviewType: 'HR Call', // Exact type from your screenshot
      interviewDate: '2026-02-25',
      interviewTime: '11:00 AM',
      meetingLink: 'https://meet.google.com/xxx-xxxx-xxx',
      meetingPlatform: 'Google Meet',
      interviewerName: 'HR Manager',
      position: 'Software Developer',
      companyName: 'TechThrive System' // Same as in controller
    });
    
    console.log('✅ HR Call interview email sent successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('❌ Failed to send HR Call interview email:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testHRCallEmail();
