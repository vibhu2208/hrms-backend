require('dotenv').config();
const { sendInterviewScheduledEmail } = require('./src/services/emailService');

async function testInterviewEmail() {
  try {
    console.log('Testing interview email configuration...\n');
    
    // Check environment variables
    console.log('Environment variables:');
    console.log('  EMAIL_USER:', process.env.EMAIL_USER);
    console.log('  EMAIL_APP_PASSWORD:', process.env.EMAIL_APP_PASSWORD ? '***' + process.env.EMAIL_APP_PASSWORD.slice(-4) : 'undefined');
    console.log('  FRONTEND_URL:', process.env.FRONTEND_URL);
    
    // Test email sending
    const result = await sendInterviewScheduledEmail({
      candidateName: 'Test Candidate',
      candidateEmail: 'krishnaupadhyay207@gmail.com', // Change this to your test email
      interviewType: 'Technical',
      interviewDate: '2026-02-25',
      interviewTime: '10:00 AM',
      meetingLink: 'https://meet.google.com/xxx-xxxx-xxx',
      meetingPlatform: 'Google Meet',
      interviewerName: 'John Doe',
      position: 'Software Developer',
      companyName: 'SPC HRMS'
    });
    
    console.log('\n✅ Interview email sent successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('\n❌ Failed to send interview email:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testInterviewEmail();
