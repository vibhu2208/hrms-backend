require('dotenv').config();
const { sendInterviewNotification } = require('./src/services/emailService');

async function testInterviewSchedulingEmail() {
  try {
    console.log('Testing interview scheduling email with same parameters as controller...\n');
    
    // Test with the same parameters that the controller uses
    const result = await sendInterviewNotification({
      candidateName: 'Test Candidate',
      candidateEmail: 'krishnaupadhyay207@gmail.com',
      interviewType: 'Technical',
      interviewDate: '2026-02-25',
      interviewTime: '10:00 AM',
      meetingLink: 'https://meet.google.com/xxx-xxxx-xxx',
      meetingPlatform: 'Google Meet',
      interviewerName: null,
      position: 'Software Developer',
      companyName: 'SPC HRMS'
    });
    
    console.log('✅ Interview scheduling email sent successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('❌ Failed to send interview scheduling email:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testInterviewSchedulingEmail();
