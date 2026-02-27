const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

/**
 * Email Service for HRMS
 * Handles all email communications including onboarding, notifications, etc.
 * Uses Gmail SMTP with app password for secure authentication
 */

/**
 * Generic email sending function
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'HRMS System'}" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || ''
    };

    const result = await sendEmailWithRetry(transporter, mailOptions);
    console.log(`✅ Email sent successfully to ${options.to}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};

// Create reusable transporter with timeout and retry configuration
const createTransporter = () => {
  // Check for Gmail configuration first
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    console.log('📧 Using Gmail SMTP configuration');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      },
      // Connection pooling for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeout configuration (critical for production)
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      // Security options
      secure: true,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      // Retry configuration
      retry: {
        maxRetries: 3,
        delay: 1000
      }
    });
  }
  
  // Fallback to custom SMTP configuration (for production environments like Render)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('📧 Using custom SMTP configuration');
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      // Connection pooling
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeout configuration
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        minVersion: 'TLSv1.2'
      }
    });
  }
  
  console.error('❌ Email configuration missing. Please set EMAIL_USER and EMAIL_APP_PASSWORD or SMTP credentials in .env file');
  return null;
};

// Helper function to send email with retry logic
const sendEmailWithRetry = async (transporter, mailOptions, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Sending email (attempt ${attempt}/${maxRetries}) to ${mailOptions.to}`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      lastError = error;
      console.error(`❌ Email send attempt ${attempt} failed:`, error.message);
      
      // Don't retry on authentication errors
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

/**
 * Send onboarding welcome email with employee credentials
 * @param {Object} options - Email options
 * @param {string} options.employeeName - Full name of the employee
 * @param {string} options.employeeEmail - Email address of the employee
 * @param {string} options.employeeId - Generated employee ID
 * @param {string} options.tempPassword - Temporary password (plain text, will be sent once)
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendOnboardingEmail = async ({
  employeeName,
  employeeEmail,
  employeeId,
  tempPassword,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    // Validate required fields
    if (!employeeName || !employeeEmail || !employeeId || !tempPassword) {
      throw new Error('Missing required fields for onboarding email');
    }

    // Email template with professional design
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px;
    }
    .credentials-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .credential-item {
      margin: 10px 0;
      padding: 8px 0;
    }
    .credential-label {
      font-weight: 600;
      color: #555;
      display: inline-block;
      width: 180px;
    }
    .credential-value {
      color: #333;
      font-family: 'Courier New', monospace;
      background: #fff;
      padding: 5px 10px;
      border-radius: 3px;
      display: inline-block;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .cta-button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .emoji {
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎉</div>
      <h1>Welcome to ${companyName}!</h1>
    </div>
    
    <div class="content">
      <p>Hi <strong>${employeeName}</strong>,</p>
      
      <p>Congratulations and welcome aboard! 🎊</p>
      
      <p>Your onboarding process is complete, and your employee account has been successfully created. We're thrilled to have you join our team!</p>
      
      <h3>Your Login Credentials</h3>
      
      <div class="credentials-box">
        <div class="credential-item">
          <span class="credential-label">Employee ID:</span>
          <span class="credential-value">${employeeId}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${employeeEmail}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Temporary Password:</span>
          <span class="credential-value">${tempPassword}</span>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ Important Security Notice:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>This is a temporary password sent only once</li>
          <li>You will be required to change your password on first login</li>
          <li>Never share your password with anyone</li>
          <li>Store this email securely and delete it after changing your password</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="cta-button">
          👉 Login to HRMS Portal
        </a>
      </p>
      
      <p>If you have any questions or need assistance, please don't hesitate to reach out to the HR team.</p>
      
      <p>We're excited to have you on the team!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HR Team</strong><br>
        ${companyName}
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from the HRMS system. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Plain text version for email clients that don't support HTML
    const textContent = `
Welcome to ${companyName}!

Hi ${employeeName},

Congratulations and welcome aboard!

Your onboarding process is complete, and your employee account has been successfully created.

Your Login Credentials:
- Employee ID: ${employeeId}
- Email: ${employeeEmail}
- Temporary Password: ${tempPassword}

IMPORTANT SECURITY NOTICE:
- This is a temporary password sent only once
- You will be required to change your password on first login
- Never share your password with anyone
- Store this email securely and delete it after changing your password

Please log in to the HRMS portal and change your password immediately.

If you have any questions or need assistance, please reach out to the HR team.

Best regards,
HR Team
${companyName}

---
This is an automated email from the HRMS system. Please do not reply to this email.
    `;

    // Email options
    const mailOptions = {
      from: {
        name: `${companyName} - HRMS`,
        address: process.env.EMAIL_USER
      },
      to: employeeEmail,
      subject: `🎉 Welcome to ${companyName} — Your Employee Account Details`,
      text: textContent,
      html: htmlContent,
      // High priority for important onboarding email
      priority: 'high'
    };

    // Send email with retry logic
    const info = await sendEmailWithRetry(transporter, mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: employeeEmail
    };

  } catch (error) {
    console.error('❌ Error sending onboarding email:', error);
    throw new Error(`Failed to send onboarding email: ${error.message}`);
  }
};

/**
 * Send notification email to HR when new employee account is created
 * @param {Object} options - Notification options
 * @param {string} options.employeeName - Full name of the employee
 * @param {string} options.employeeId - Generated employee ID
 * @param {string} options.department - Department name
 * @param {string} options.designation - Job designation
 * @param {string} options.hrEmail - HR email address (optional, uses default if not provided)
 * @returns {Promise<Object>} Email send result
 */
const sendHRNotification = async ({
  employeeName,
  employeeId,
  department,
  designation,
  hrEmail
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.warn('Email transporter not configured, skipping HR notification');
      return { success: false, message: 'Email not configured' };
    }

    const recipientEmail = hrEmail || process.env.EMAIL_USER;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: white; margin-top: 20px; border-radius: 5px; }
    .info-item { margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✅ New Employee Account Created</h2>
    </div>
    <div class="content">
      <p>A new employee account has been successfully created in the HRMS system.</p>
      <div class="info-item"><strong>Employee Name:</strong> ${employeeName}</div>
      <div class="info-item"><strong>Employee ID:</strong> ${employeeId}</div>
      <div class="info-item"><strong>Department:</strong> ${department}</div>
      <div class="info-item"><strong>Designation:</strong> ${designation}</div>
      <div class="info-item"><strong>Created On:</strong> ${new Date().toLocaleString()}</div>
      <p style="margin-top: 20px;">The employee has been sent their login credentials via email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'HRMS System',
        address: process.env.EMAIL_USER
      },
      to: recipientEmail,
      subject: `✅ New Employee Account Created - ${employeeName}`,
      html: htmlContent
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);
    
    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('❌ Error sending HR notification:', error);
    // Don't throw error for HR notification failure - it's not critical
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send interview notification email to candidate
 * @param {Object} options - Email options
 * @param {string} options.candidateName - Full name of the candidate
 * @param {string} options.candidateEmail - Email address of the candidate
 * @param {string} options.interviewType - Type of interview (Technical, HR, etc.)
 * @param {string} options.interviewDate - Date of interview
 * @param {string} options.interviewTime - Time of interview
 * @param {string} options.meetingLink - Meeting link (Google Meet, Zoom, etc.)
 * @param {string} options.meetingPlatform - Platform name
 * @param {string} options.interviewerName - Name of interviewer (optional)
 * @param {string} options.position - Position applied for
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendInterviewNotification = async ({
  candidateName,
  candidateEmail,
  interviewType,
  interviewDate,
  interviewTime,
  meetingLink,
  meetingPlatform,
  interviewerName,
  position,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    // Validate required fields
    if (!candidateName || !candidateEmail || !interviewDate) {
      throw new Error('Missing required fields for interview notification');
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .interview-details {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .detail-item {
      margin: 12px 0;
      padding: 8px 0;
    }
    .detail-label {
      font-weight: 600;
      color: #555;
      display: inline-block;
      width: 150px;
    }
    .detail-value {
      color: #333;
    }
    .meeting-link {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .tips {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Interview Scheduled</h1>
    </div>
    
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      
      <p>Thank you for your interest in the <strong>${position}</strong> position at ${companyName}.</p>
      
      <p>We are pleased to invite you for an interview. Please find the details below:</p>
      
      <div class="interview-details">
        <div class="detail-item">
          <span class="detail-label">Interview Type:</span>
          <span class="detail-value"><strong>${interviewType}</strong></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Date:</span>
          <span class="detail-value"><strong>${new Date(interviewDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</strong></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Time:</span>
          <span class="detail-value"><strong>${interviewTime || 'To be confirmed'}</strong></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Platform:</span>
          <span class="detail-value"><strong>${meetingPlatform || 'To be confirmed'}</strong></span>
        </div>
        ${interviewerName ? `
        <div class="detail-item">
          <span class="detail-label">Interviewer:</span>
          <span class="detail-value"><strong>${interviewerName}</strong></span>
        </div>
        ` : ''}
      </div>
      
      ${meetingLink ? `
      <p style="text-align: center;">
        <a href="${meetingLink}" class="meeting-link">
          🔗 Join Interview
        </a>
      </p>
      ` : ''}
      
      <div class="tips">
        <strong>📝 Interview Tips:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Join the meeting 5 minutes early</li>
          <li>Ensure stable internet connection</li>
          <li>Test your camera and microphone beforehand</li>
          <li>Keep your resume and documents ready</li>
          <li>Choose a quiet, well-lit location</li>
        </ul>
      </div>
      
      <p>If you have any questions or need to reschedule, please contact us as soon as possible.</p>
      
      <p>We look forward to speaking with you!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HR Team</strong><br>
        ${companyName}
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from the HRMS system.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Interview Scheduled - ${companyName}

Dear ${candidateName},

Thank you for your interest in the ${position} position at ${companyName}.

We are pleased to invite you for an interview.

Interview Details:
- Type: ${interviewType}
- Date: ${new Date(interviewDate).toLocaleDateString()}
- Time: ${interviewTime || 'To be confirmed'}
- Platform: ${meetingPlatform || 'To be confirmed'}
${interviewerName ? `- Interviewer: ${interviewerName}` : ''}
${meetingLink ? `- Meeting Link: ${meetingLink}` : ''}

Interview Tips:
- Join the meeting 5 minutes early
- Ensure stable internet connection
- Test your camera and microphone beforehand
- Keep your resume and documents ready
- Choose a quiet, well-lit location

If you have any questions or need to reschedule, please contact us as soon as possible.

We look forward to speaking with you!

Best regards,
HR Team
${companyName}
    `;

    const mailOptions = {
      from: {
        name: `${companyName} - HRMS`,
        address: process.env.EMAIL_USER
      },
      to: candidateEmail,
      subject: `📅 Interview Scheduled - ${interviewType} for ${position}`,
      text: textContent,
      html: htmlContent,
      priority: 'high'
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: candidateEmail
    };

  } catch (error) {
    console.error('❌ Error sending interview notification:', error);
    throw new Error(`Failed to send interview notification: ${error.message}`);
  }
};

/**
 * Verify email configuration
 * @returns {Promise<boolean>} True if email is configured correctly
 */
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return false;
    }

    await transporter.verify();
    return true;
  } catch (error) {
    console.error('❌ Email service verification failed:', error.message);
    return false;
  }
};

/**
 * Send application received confirmation email
 */
const sendApplicationReceivedEmail = async ({
  candidateName,
  candidateEmail,
  position,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .highlight-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Application Received</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>Thank you for applying for the <strong>${position}</strong> position at ${companyName}.</p>
      <div class="highlight-box">
        <p><strong>✅ Your application has been successfully received!</strong></p>
        <p>Our recruitment team will review your application and get back to you soon.</p>
      </div>
      <p><strong>What's Next?</strong></p>
      <ul>
        <li>Our team will review your application</li>
        <li>Shortlisted candidates will be contacted for interviews</li>
        <li>You'll receive updates via email</li>
      </ul>
      <p>We appreciate your interest in joining our team!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `✅ Application Received - ${position}`,
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending application email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send interview scheduled notification email
 */
const sendInterviewScheduledEmail = async ({
  candidateName,
  candidateEmail,
  position,
  interviewDate,
  interviewTime,
  interviewType,
  interviewLocation,
  interviewerName,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #e0e7ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .detail-item { margin: 12px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .detail-label { font-weight: 600; color: #555; }
    .detail-value { color: #333; margin-top: 5px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Interview Scheduled</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="info-box">
        <p><strong>Your interview has been scheduled!</strong></p>
        <p>We are pleased to invite you for an interview for the <strong>${position}</strong> position at ${companyName}.</p>
      </div>
      <h3>Interview Details:</h3>
      <div class="detail-item">
        <div class="detail-label">📅 Date:</div>
        <div class="detail-value">${interviewDate}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">⏰ Time:</div>
        <div class="detail-value">${interviewTime}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">📍 Type:</div>
        <div class="detail-value">${interviewType}</div>
      </div>
      ${interviewLocation ? `<div class="detail-item"><div class="detail-label">📍 Location:</div><div class="detail-value">${interviewLocation}</div></div>` : ''}
      ${interviewerName ? `<div class="detail-item"><div class="detail-label">👤 Interviewer:</div><div class="detail-value">${interviewerName}</div></div>` : ''}
      <p><strong>Please arrive 10 minutes early and bring:</strong></p>
      <ul>
        <li>Updated resume</li>
        <li>Valid ID proof</li>
        <li>Any relevant certificates</li>
      </ul>
      <p>If you need to reschedule, please contact us as soon as possible.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `📅 Interview Scheduled - ${position} at ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending interview scheduled email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send interview reminder email
 */
const sendInterviewReminderEmail = async ({
  candidateName,
  candidateEmail,
  position,
  interviewDate,
  interviewTime,
  interviewType,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .reminder-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Interview Reminder</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="reminder-box">
        <p><strong>⏰ Reminder: Your interview is coming up!</strong></p>
        <p>This is a friendly reminder about your upcoming interview for the <strong>${position}</strong> position at ${companyName}.</p>
        <p><strong>Date:</strong> ${interviewDate}<br>
        <strong>Time:</strong> ${interviewTime}<br>
        <strong>Type:</strong> ${interviewType}</p>
      </div>
      <p>Please ensure you are prepared and arrive on time. We look forward to meeting you!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `⏰ Interview Reminder - ${position} Tomorrow`,
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending interview reminder email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send interview cancelled notification email
 */
const sendInterviewCancelledEmail = async ({
  candidateName,
  candidateEmail,
  position,
  reason,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .alert-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Interview Cancelled</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="alert-box">
        <p><strong>We regret to inform you that your interview has been cancelled.</strong></p>
        <p>Position: <strong>${position}</strong></p>
        ${reason ? `<p>Reason: ${reason}</p>` : ''}
      </div>
      <p>We apologize for any inconvenience this may cause. We will contact you if we wish to reschedule or if any other opportunities arise.</p>
      <p>Thank you for your interest in ${companyName}.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `Interview Cancelled - ${position} at ${companyName}`,
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending interview cancelled email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send shortlisted notification email
 */
const sendShortlistedEmail = async ({
  candidateName,
  candidateEmail,
  position,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations! You're Shortlisted</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="success-box">
        <p><strong>🎉 Great News!</strong></p>
        <p>We are pleased to inform you that you have been shortlisted for the <strong>${position}</strong> position at ${companyName}.</p>
      </div>
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>You will be contacted soon to schedule an interview</li>
        <li>Please keep your phone and email accessible</li>
        <li>Prepare your documents and portfolio</li>
      </ul>
      <p>We look forward to meeting you!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `🎉 You're Shortlisted - ${position} at ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending shortlisted email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send interview completed notification
 */
const sendInterviewCompletedEmail = async ({
  candidateName,
  candidateEmail,
  interviewType,
  position,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Interview Completed</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>Thank you for attending the <strong>${interviewType}</strong> for the <strong>${position}</strong> position at ${companyName}.</p>
      <div class="info-box">
        <p><strong>What's Next?</strong></p>
        <p>Our team is currently reviewing your interview performance. We will get back to you with the next steps soon.</p>
      </div>
      <p>We appreciate the time you took to interview with us and your interest in joining our team.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `Thank You - ${interviewType} Completed`,
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending interview completed email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send offer extended email
 */
const sendOfferExtendedEmail = async ({
  candidateName,
  candidateEmail,
  position,
  joiningDate,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .offer-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offer letter</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="offer-box">
        <p><strong>🎊 Congratulations!</strong></p>
        <p>We are delighted to extend an offer for the <strong>${position}</strong> position at ${companyName}.</p>
        ${joiningDate ? `<p><strong>Proposed Joining Date:</strong> ${new Date(joiningDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
      </div>
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Please review the offer letter attached or sent separately</li>
        <li>Contact us if you have any questions</li>
        <li>Confirm your acceptance at your earliest convenience</li>
      </ul>
      <p>We are excited about the possibility of you joining our team!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `🎊 Offer Letter - ${position} at ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending offer email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send offer letter using selected template with variable replacement
 * @param {Object} options - Email options
 * @param {string} options.templateId - Template ID to use
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.candidateEmail - Candidate email
 * @param {string} options.position - Position/Job title
 * @param {string} options.designation - Designation
 * @param {number} options.ctc - Annual CTC
 * @param {Date} options.joiningDate - Joining date
 * @param {Object} options.offerDetails - Offer details for template variables
 * @param {string} options.companyName - Company name
 */
const sendOfferLetterWithTemplate = async ({
  templateId,
  candidateName,
  candidateEmail,
  position,
  designation,
  ctc,
  joiningDate,
  offerDetails = {},
  companyName = 'SPC Management Services PVT Ltd.'
}) => {
  try {
    // Get OfferTemplate model (global, not tenant-specific)
    const OfferTemplate = require('../models/OfferTemplate');
    
    // Check database connection state
    if (mongoose.connection.readyState !== 1) {
      console.log('🔌 Database not connected (state:', mongoose.connection.readyState, '), connecting...');
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Database connected for email service');
      } catch (dbError) {
        console.error('❌ Failed to connect to database:', dbError.message);
        throw new Error(`Database connection failed: ${dbError.message}`);
      }
    } else {
      console.log('✅ Database already connected');
    }
    
    // Find the template
    console.log('🔍 Looking for template with ID:', templateId);
    const template = await OfferTemplate.findById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }
    console.log('✅ Template found:', template.name);

    // Replace template variables with actual values
    let htmlContent = template.content;
    let subjectContent = template.subject;

    // Define all possible variables with defaults
    const variables = {
      candidateName: candidateName || 'Candidate',
      position: position || designation || 'Position',
      designation: designation || position || 'Designation',
      ctc: ctc || 0,
      annualCTC: ctc || 0,
      monthlySalary: offerDetails.monthlySalary || 0,
      basic: offerDetails.basic || 0,
      hra: offerDetails.hra || 0,
      allowances: offerDetails.allowances || 0,
      joiningDate: joiningDate ? new Date(joiningDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : 'To be determined',
      contractStartDate: offerDetails.contractStartDate || joiningDate || 'To be determined',
      contractEndDate: offerDetails.contractEndDate || 'To be determined',
      clientName: offerDetails.clientName || 'Client Organization',
      location: offerDetails.location || 'Work Location',
      projectName: offerDetails.projectName || 'Project Name',
      benefits: offerDetails.benefits || 'Standard benefits package',
      contractExtensionInfo: offerDetails.contractExtensionInfo || 'Contract extension terms to be discussed',
      hrName: offerDetails.hrName || 'HR Team',
      hrDesignation: offerDetails.hrDesignation || 'HR Manager',
      expiryDate: offerDetails.expiryDate || '3 days from receipt of this email',
      currentDate: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      companyName: companyName,
      ...offerDetails // Include any additional custom variables
    };

    // Replace variables in both content and subject
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const value = variables[key];
      htmlContent = htmlContent.replace(regex, value);
      subjectContent = subjectContent.replace(regex, value);
    });

    // Send the email
    console.log('📧 Creating email transporter...');
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');
    console.log('✅ Email transporter created');

    const mailOptions = {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: subjectContent,
      html: htmlContent,
      priority: 'high'
    };
    
    console.log('📤 Sending email to:', candidateEmail);
    console.log('📋 Subject:', subjectContent);
    console.log('📋 From:', mailOptions.from);
    
    await sendEmailWithRetry(transporter, mailOptions);

    console.log(`✅ Offer letter sent using template "${template.name}" to ${candidateEmail}`);
    
    return { 
      success: true, 
      templateId: template._id,
      templateName: template.name,
      recipient: candidateEmail
    };
  } catch (error) {
    console.error('❌ Error sending offer letter with template:', error);
    throw new Error(`Failed to send offer letter with template: ${error.message}`);
  }
};

/**
 * Send rejection email
 */
const sendRejectionEmail = async ({
  candidateName,
  candidateEmail,
  position,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f8f9fa; border-left: 4px solid #6b7280; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Application Update</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>Thank you for your interest in the <strong>${position}</strong> position at ${companyName} and for taking the time to interview with us.</p>
      <div class="info-box">
        <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
      </div>
      <p>We appreciate your interest in ${companyName} and encourage you to apply for future opportunities that match your skills and experience.</p>
      <p>We wish you all the best in your job search and future endeavors.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `Application Update - ${position}`,
      html: htmlContent
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send company admin credentials email
 * @param {Object} options - Email options
 * @param {string} options.companyName - Name of the company
 * @param {string} options.adminEmail - Admin email address
 * @param {string} options.adminPassword - Auto-generated password
 * @param {string} options.loginUrl - Login URL for the company
 * @returns {Promise<Object>} Email send result
 */
const sendCompanyAdminCredentials = async ({
  companyName,
  adminEmail,
  adminPassword,
  loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    // Validate required fields
    if (!companyName || !adminEmail || !adminPassword) {
      throw new Error('Missing required fields for company admin credentials email');
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-message {
      background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%);
      border-radius: 8px;
      padding: 25px;
      margin: 25px 0;
      text-align: center;
    }
    .welcome-message h2 {
      margin: 0 0 10px 0;
      color: #667eea;
      font-size: 24px;
    }
    .credentials-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 25px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .credentials-box h3 {
      margin-top: 0;
      color: #667eea;
    }
    .credential-item {
      margin: 15px 0;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .credential-item:last-child {
      border-bottom: none;
    }
    .credential-label {
      font-weight: 600;
      color: #555;
      display: block;
      margin-bottom: 5px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .credential-value {
      color: #1f2937;
      font-family: 'Courier New', monospace;
      background: #fff;
      padding: 10px 15px;
      border-radius: 4px;
      display: block;
      font-size: 16px;
      border: 1px solid #e5e7eb;
      word-break: break-all;
    }
    .warning-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .warning-box strong {
      color: #856404;
    }
    .warning-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .warning-box li {
      margin: 8px 0;
      color: #856404;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 6px;
      margin: 25px 0;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .features-box {
      background: #f8f9fa;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .features-box h3 {
      margin-top: 0;
      color: #333;
    }
    .features-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .features-box li {
      margin: 8px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 25px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .emoji {
      font-size: 32px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎉</div>
      <h1>Welcome to HRMS Platform!</h1>
      <p>Your company account has been created</p>
    </div>
    
    <div class="content">
      <div class="welcome-message">
        <h2>🏢 ${companyName}</h2>
        <p>Your HRMS account is now active and ready to use!</p>
      </div>
      
      <p>Dear Administrator,</p>
      
      <p>Congratulations! Your company has been successfully onboarded to our HRMS platform. We're excited to have <strong>${companyName}</strong> join our growing community of organizations streamlining their HR operations.</p>
      
      <div class="credentials-box">
        <h3>🔐 Your Administrator Login Credentials</h3>
        
        <div class="credential-item">
          <span class="credential-label">Company Name</span>
          <span class="credential-value">${companyName}</span>
        </div>
        
        <div class="credential-item">
          <span class="credential-label">Admin Email</span>
          <span class="credential-value">${adminEmail}</span>
        </div>
        
        <div class="credential-item">
          <span class="credential-label">Temporary Password</span>
          <span class="credential-value">${adminPassword}</span>
        </div>
        
        <div class="credential-item">
          <span class="credential-label">Login URL</span>
          <span class="credential-value">${loginUrl}/login</span>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ Important Security Notice:</strong>
        <ul>
          <li>This is a <strong>temporary password</strong> sent only once via this email</li>
          <li>You will be <strong>required to change your password</strong> upon first login</li>
          <li><strong>Never share</strong> your password with anyone</li>
          <li>Store this email securely and <strong>delete it after</strong> changing your password</li>
          <li>If you didn't request this account, please contact our support team immediately</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${loginUrl}/login" class="cta-button">
          🚀 Login to Your HRMS Dashboard
        </a>
      </p>
      
      <div class="features-box">
        <h3>✨ What You Can Do Next:</h3>
        <ul>
          <li>📊 Set up your company profile and preferences</li>
          <li>👥 Add departments and designations</li>
          <li>🆕 Create employee accounts and manage your team</li>
          <li>📋 Configure HR policies and workflows</li>
          <li>📈 Access analytics and reports</li>
          <li>⚙️ Customize system settings to match your needs</li>
        </ul>
      </div>
      
      <p><strong>Need Help?</strong></p>
      <p>If you have any questions or need assistance getting started, our support team is here to help. Feel free to reach out to us anytime.</p>
      
      <p>We're committed to making your HR management experience smooth and efficient!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HRMS Support Team</strong><br>
        <a href="mailto:${process.env.EMAIL_USER}" style="color: #667eea; text-decoration: none;">${process.env.EMAIL_USER}</a>
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from the HRMS system. Please do not reply to this email.</p>
      <p>For support, contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color: #667eea;">${process.env.EMAIL_USER}</a></p>
      <p>&copy; ${new Date().getFullYear()} HRMS Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Welcome to HRMS Platform!

Company: ${companyName}

Dear Administrator,

Congratulations! Your company has been successfully onboarded to our HRMS platform.

YOUR ADMINISTRATOR LOGIN CREDENTIALS:
- Company Name: ${companyName}
- Admin Email: ${adminEmail}
- Temporary Password: ${adminPassword}
- Login URL: ${loginUrl}/login

IMPORTANT SECURITY NOTICE:
- This is a temporary password sent only once via this email
- You will be required to change your password upon first login
- Never share your password with anyone
- Store this email securely and delete it after changing your password
- If you didn't request this account, please contact our support team immediately

WHAT YOU CAN DO NEXT:
- Set up your company profile and preferences
- Add departments and designations
- Create employee accounts and manage your team
- Configure HR policies and workflows
- Access analytics and reports
- Customize system settings to match your needs

Need Help?
If you have any questions or need assistance getting started, our support team is here to help.

Best regards,
HRMS Support Team
${process.env.EMAIL_USER}

---
This is an automated email from the HRMS system. Please do not reply to this email.
    `;

    const mailOptions = {
      from: {
        name: 'HRMS Platform',
        address: process.env.EMAIL_USER
      },
      to: adminEmail,
      subject: `🎉 Welcome to HRMS - ${companyName} Account Created`,
      text: textContent,
      html: htmlContent,
      priority: 'high'
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: adminEmail
    };

  } catch (error) {
    console.error('❌ Error sending company admin credentials email:', error);
    throw new Error(`Failed to send company admin credentials email: ${error.message}`);
  }
};

/**
 * Send welcome email to new employee
 */
const sendWelcomeEmail = async ({
  employeeName,
  employeeEmail,
  employeeId,
  department,
  position,
  joiningDate,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .welcome-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .info-item { margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to ${companyName}!</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="welcome-box">
        <p><strong>🎊 Welcome aboard!</strong></p>
        <p>We are thrilled to have you join our team at ${companyName}. Your skills and experience will be a great addition to our organization.</p>
      </div>
      <h3>Your Details:</h3>
      <div class="info-item"><strong>Employee ID:</strong> ${employeeId}</div>
      <div class="info-item"><strong>Position:</strong> ${position}</div>
      <div class="info-item"><strong>Department:</strong> ${department}</div>
      ${joiningDate ? `<div class="info-item"><strong>Joining Date:</strong> ${new Date(joiningDate).toLocaleDateString()}</div>` : ''}
      <p><strong>What's Next:</strong></p>
      <ul>
        <li>Check your email for login credentials</li>
        <li>Complete your profile in the HRMS portal</li>
        <li>Review company policies and guidelines</li>
        <li>Meet your team and manager</li>
      </ul>
      <p>If you have any questions, please don't hesitate to reach out to the HR team.</p>
      <p>We look forward to working with you!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `🎉 Welcome to ${companyName}!`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send document request email with upload portal link
 * @param {Object} options - Email options
 * @param {string} options.candidateName - Full name of the candidate
 * @param {string} options.candidateEmail - Email address of the candidate
 * @param {string} options.position - Position/role
 * @param {string} options.uploadUrl - Public upload portal URL with token
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendDocumentRequestEmail = async ({
  candidateName,
  candidateEmail,
  position,
  uploadUrl,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px;
    }
    .info-box {
      background: #dbeafe;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .cta-button {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 15px 40px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: 600;
      font-size: 16px;
    }
    .document-list {
      background: #f8f9fa;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .document-list ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .document-list li {
      margin: 8px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .emoji {
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">📄</div>
      <h1>Document Submission Required</h1>
    </div>
    
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      
      <p>We are pleased to inform you that your onboarding process for the <strong>${position}</strong> position at ${companyName} is progressing well.</p>
      
      <div class="info-box">
        <p><strong>📋 Action Required: Submit Your Documents</strong></p>
        <p>To proceed with your onboarding, we need you to upload the required documents through our secure document portal.</p>
      </div>
      
      <div class="document-list">
        <h3>📎 Required Documents:</h3>
        <ul>
          <li>Aadhaar Card (both sides)</li>
          <li>PAN Card</li>
          <li>Educational Certificates</li>
          <li>Address Proof</li>
          <li>Bank Account Details (cancelled cheque or passbook)</li>
          <li>Passport-size Photograph</li>
          <li>Previous Employment Documents (if applicable)</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${uploadUrl}" class="cta-button">
          📤 Upload Documents Now
        </a>
      </p>
      
      <p><strong>Important Notes:</strong></p>
      <ul>
        <li>All documents should be clear and legible</li>
        <li>Accepted formats: PDF, JPG, PNG</li>
        <li>Maximum file size: 10MB per document</li>
        <li>This link is secure and unique to you</li>
      </ul>
      
      <p>If you face any issues or have questions, please don't hesitate to contact our HR team.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HR Team</strong><br>
        ${companyName}
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from the HRMS system. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Document Submission Required

Dear ${candidateName},

We are pleased to inform you that your onboarding process for the ${position} position at ${companyName} is progressing well.

Action Required: Submit Your Documents
To proceed with your onboarding, we need you to upload the required documents through our secure document portal.

Required Documents:
- Aadhaar Card (both sides)
- PAN Card
- Educational Certificates
- Address Proof
- Bank Account Details (cancelled cheque or passbook)
- Passport-size Photograph
- Previous Employment Documents (if applicable)

Upload Link: ${uploadUrl}

Important Notes:
- All documents should be clear and legible
- Accepted formats: PDF, JPG, PNG
- Maximum file size: 10MB per document
- This link is secure and unique to you

If you face any issues or have questions, please contact our HR team.

Best regards,
HR Team
${companyName}

---
This is an automated email from the HRMS system. Please do not reply to this email.
    `;

    const mailOptions = {
      from: {
        name: `${companyName} - HRMS`,
        address: process.env.EMAIL_USER
      },
      to: candidateEmail,
      subject: `📄 Document Submission Required - ${position} at ${companyName}`,
      text: textContent,
      html: htmlContent,
      priority: 'high'
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: candidateEmail
    };

  } catch (error) {
    console.error('❌ Error sending document request email:', error);
    throw new Error(`Failed to send document request email: ${error.message}`);
  }
};

/**
 * Send joining date confirmation email to candidate
 * @param {Object} options - Email options
 * @param {string} options.candidateName - Full name of the candidate
 * @param {string} options.candidateEmail - Email address of the candidate
 * @param {string} options.position - Position/role
 * @param {string} options.joiningDate - Joining date
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendJoiningDateConfirmationEmail = async ({
  candidateName,
  candidateEmail,
  position,
  joiningDate,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      throw new Error('Email transporter not configured');
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px;
    }
    .info-box {
      background: #d1fae5;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .date-box {
      background: #f8f9fa;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
      text-align: center;
    }
    .date-display {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
      margin: 10px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .emoji {
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎉</div>
      <h1>Joining Date Confirmed!</h1>
    </div>
    
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      
      <p>We are delighted to confirm your joining details for the <strong>${position}</strong> position at ${companyName}.</p>
      
      <div class="info-box">
        <p><strong>✅ Your onboarding process is almost complete!</strong></p>
        <p>We look forward to welcoming you to our team.</p>
      </div>
      
      <div class="date-box">
        <h3>📅 Your Joining Date</h3>
        <div class="date-display">${new Date(joiningDate).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>
      
      <p><strong>What to expect on your first day:</strong></p>
      <ul>
        <li>Orientation and introduction to the team</li>
        <li>IT setup and account access</li>
        <li>Documentation verification</li>
        <li>Office and facilities tour</li>
      </ul>
      
      <p><strong>What to bring:</strong></p>
      <ul>
        <li>Original documents for verification</li>
        <li>ID proof (Aadhar/PAN/Passport)</li>
        <li>Passport-size photographs</li>
      </ul>
      
      <p>If you have any questions or need to reschedule, please contact our HR team immediately.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>HR Team</strong><br>
        ${companyName}
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated email from the HRMS system. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: `${companyName} - HRMS`,
        address: process.env.EMAIL_USER
      },
      to: candidateEmail,
      subject: `🎉 Joining Date Confirmed - ${position} at ${companyName}`,
      text: `
Joining Date Confirmed - ${companyName}

Dear ${candidateName},

We are delighted to confirm your joining details for the ${position} position at ${companyName}.

Your onboarding process is almost complete! We look forward to welcoming you to our team.

📅 Your Joining Date: ${new Date(joiningDate).toLocaleDateString()}

What to expect on your first day:
- Orientation and introduction to the team
- IT setup and account access
- Documentation verification
- Office and facilities tour

What to bring:
- Original documents for verification
- ID proof (Aadhar/PAN/Passport)
- Passport-size photographs

If you have any questions or need to reschedule, please contact our HR team immediately.

Best regards,
HR Team
${companyName}
      `,
      html: htmlContent,
      priority: 'high'
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      recipient: candidateEmail
    };

  } catch (error) {
    console.error('❌ Error sending joining date confirmation email:', error);
    throw new Error(`Failed to send joining date confirmation email: ${error.message}`);
  }
};

/**
 * Send IT notification for new employee setup
 * @param {Object} options - Email options
 * @param {string} options.employeeName - Full name of the employee
 * @param {string} options.employeeEmail - Email address of the employee
 * @param {string} options.position - Position/role
 * @param {string} options.department - Department name
 * @param {string} options.joiningDate - Joining date
 * @param {string} options.itEmail - IT department email (optional)
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendITNotification = async ({
  employeeName,
  employeeEmail,
  position,
  department,
  joiningDate,
  itEmail,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.warn('Email transporter not configured, skipping IT notification');
      return { success: false, message: 'Email not configured' };
    }

    const recipientEmail = itEmail || process.env.IT_EMAIL || process.env.EMAIL_USER;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: white; margin-top: 20px; border-radius: 5px; }
    .info-item { margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 3px; }
    .urgent { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🔧 IT Setup Required - New Employee</h2>
    </div>
    <div class="content">
      <p>A new employee will be joining soon and requires IT setup.</p>
      <div class="urgent">
        <strong>⚠️ Action Required:</strong> Please prepare the following IT resources before the joining date.
      </div>
      <div class="info-item"><strong>Employee Name:</strong> ${employeeName}</div>
      <div class="info-item"><strong>Email:</strong> ${employeeEmail}</div>
      <div class="info-item"><strong>Position:</strong> ${position}</div>
      <div class="info-item"><strong>Department:</strong> ${department}</div>
      <div class="info-item"><strong>Joining Date:</strong> ${new Date(joiningDate).toLocaleDateString()}</div>
      
      <h3>IT Setup Checklist:</h3>
      <ul>
        <li>Create user accounts and email</li>
        <li>Prepare laptop/desktop and accessories</li>
        <li>Configure system access and permissions</li>
        <li>Set up development tools and software</li>
        <li>Prepare network credentials</li>
        <li>Configure communication tools (Slack, Teams, etc.)</li>
      </ul>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'HRMS System',
        address: process.env.EMAIL_USER
      },
      to: recipientEmail,
      subject: `🔧 IT Setup Required - ${employeeName} joining on ${new Date(joiningDate).toLocaleDateString()}`,
      html: htmlContent
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);
    
    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('❌ Error sending IT notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send Facilities notification for new employee
 * @param {Object} options - Email options
 * @param {string} options.employeeName - Full name of the employee
 * @param {string} options.position - Position/role
 * @param {string} options.department - Department name
 * @param {string} options.joiningDate - Joining date
 * @param {string} options.facilitiesEmail - Facilities department email (optional)
 * @param {string} options.companyName - Company name (optional)
 * @returns {Promise<Object>} Email send result
 */
const sendFacilitiesNotification = async ({
  employeeName,
  position,
  department,
  joiningDate,
  facilitiesEmail,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.warn('Email transporter not configured, skipping Facilities notification');
      return { success: false, message: 'Email not configured' };
    }

    const recipientEmail = facilitiesEmail || process.env.FACILITIES_EMAIL || process.env.EMAIL_USER;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: white; margin-top: 20px; border-radius: 5px; }
    .info-item { margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 3px; }
    .urgent { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🏢 Facilities Setup Required - New Employee</h2>
    </div>
    <div class="content">
      <p>A new employee will be joining soon and requires facilities setup.</p>
      <div class="urgent">
        <strong>⚠️ Action Required:</strong> Please prepare the following facilities before the joining date.
      </div>
      <div class="info-item"><strong>Employee Name:</strong> ${employeeName}</div>
      <div class="info-item"><strong>Position:</strong> ${position}</div>
      <div class="info-item"><strong>Department:</strong> ${department}</div>
      <div class="info-item"><strong>Joining Date:</strong> ${new Date(joiningDate).toLocaleDateString()}</div>
      
      <h3>Facilities Setup Checklist:</h3>
      <ul>
        <li>Allocate workspace/desk</li>
        <li>Prepare chair and ergonomic setup</li>
        <li>Arrange access card/ID badge</li>
        <li>Prepare welcome kit and stationery</li>
        <li>Coordinate parking/access permissions</li>
        <li>Set up locker and storage if needed</li>
        <li>Prepare induction materials</li>
      </ul>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'HRMS System',
        address: process.env.EMAIL_USER
      },
      to: recipientEmail,
      subject: `🏢 Facilities Setup Required - ${employeeName} joining on ${new Date(joiningDate).toLocaleDateString()}`,
      html: htmlContent
    };

    const info = await sendEmailWithRetry(transporter, mailOptions);
    
    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('❌ Error sending Facilities notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send document rejection/re-submission email
 */
const sendDocumentRejectionEmail = async ({
  candidateName,
  candidateEmail,
  documentName,
  rejectionReason,
  uploadUrl,
  rejectedDocuments = []
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const rejectedDocsList = rejectedDocuments.map(doc => 
      `<li><strong>${doc.documentType.replace(/_/g, ' ').toUpperCase()}</strong>: ${doc.reason}</li>`
    ).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .rejected-docs { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Document Re-submission Required</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="alert-box">
        <p>Thank you for submitting your onboarding documents. After careful review, we need you to re-submit some documents to proceed with your onboarding.</p>
      </div>
      <div class="rejected-docs">
        <p><strong>Documents requiring re-submission:</strong></p>
        <ul>
          ${rejectedDocsList}
        </ul>
      </div>
      <p><strong>What you need to do:</strong></p>
      <ol>
        <li>Review the reasons mentioned above for each document</li>
        <li>Prepare corrected/updated versions of the documents</li>
        <li>Click the button below to re-upload the documents</li>
        <li>Ensure documents are clear, complete, and meet the specified requirements</li>
      </ol>
      <div style="text-align: center;">
        <a href="${uploadUrl}" class="cta-button">Re-Upload Documents</a>
      </div>
      <p><strong>Important Guidelines:</strong></p>
      <ul>
        <li>Ensure all documents are clear and readable</li>
        <li>Upload documents in the correct format (PDF, JPG, PNG)</li>
        <li>Make sure all required information is visible</li>
        <li>Double-check document accuracy before uploading</li>
      </ul>
      <p>If you have any questions or need assistance, please don't hesitate to contact our HR team.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} HRMS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: 'HRMS - Document Verification', address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: '📄 Action Required: Re-submit Onboarding Documents',
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending document rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send offer letter with document upload link
 */
const sendOfferLetterWithDocumentLink = async ({
  candidateName,
  candidateEmail,
  position,
  joiningDate,
  uploadUrl,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .offer-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .document-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎊 Congratulations!</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${candidateName}</strong>,</p>
      <div class="offer-box">
        <p><strong>🎊 We are delighted to extend an offer!</strong></p>
        <p>We are pleased to offer you the <strong>${position}</strong> position at ${companyName}.</p>
        ${joiningDate ? `<p><strong>Proposed Joining Date:</strong> ${new Date(joiningDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
      </div>
      
      <div class="document-box">
        <p><strong>📄 Next Step: Upload Your Documents</strong></p>
        <p>To complete your onboarding process, please upload the required documents using the secure link below:</p>
        <div style="text-align: center;">
          <a href="${uploadUrl}" class="cta-button">Upload Your Documents</a>
        </div>
        <p style="margin-top: 15px;"><strong>Required Documents:</strong></p>
        <ul>
          <li>Educational/Qualification Certificates</li>
          <li>Aadhaar Card</li>
          <li>PAN Card</li>
          <li>Experience Letters (if applicable)</li>
          <li>Latest Resume</li>
          <li>Passport-size Photograph</li>
          <li>Address Proof</li>
          <li>Bank Account Details</li>
        </ul>
        <p><em>Please upload all documents within 7 days to ensure a smooth onboarding process.</em></p>
      </div>

      <p><strong>What's Next:</strong></p>
      <ol>
        <li>Review the offer letter (attached or sent separately)</li>
        <li>Upload all required documents using the link above</li>
        <li>Confirm your acceptance at your earliest convenience</li>
        <li>Contact us if you have any questions</li>
      </ol>
      
      <p>We are excited about the possibility of you joining our team!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
      <p style="margin-top: 10px; font-size: 12px;">This is an automated email. Please do not reply directly to this message.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: candidateEmail,
      subject: `🎊 Offer Letter & Document Upload - ${position} at ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending document request email:', error);
    throw new Error(`Failed to send document request email: ${error.message}`);
  }
};

/**
 * Send offboarding initiated email to employee
 */
const sendOffboardingInitiatedEmail = async ({
  employeeName,
  employeeEmail,
  lastWorkingDate,
  resignationType,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offboarding Process Initiated</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="info-box">
        <p><strong>📋 Offboarding Process Started</strong></p>
        <p>Your offboarding process has been initiated at ${companyName}.</p>
        <p><strong>Last Working Date:</strong> ${new Date(lastWorkingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Resignation Type:</strong> ${resignationType}</p>
      </div>
      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>You will receive notifications for each stage of the offboarding process</li>
        <li>Please complete the exit interview when scheduled</li>
        <li>Return all company assets and complete clearance formalities</li>
        <li>Ensure all pending work is handed over properly</li>
      </ol>
      <p>HR will guide you through each step of this process. Please reach out if you have any questions.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Offboarding Process Initiated - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending offboarding initiated email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send exit interview scheduled email
 */
const sendExitInterviewScheduledEmail = async ({
  employeeName,
  employeeEmail,
  scheduledDate,
  interviewerName,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .interview-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Exit Interview Scheduled</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="interview-box">
        <p><strong>📋 Exit Interview Scheduled</strong></p>
        <p>Your exit interview has been scheduled as part of the offboarding process.</p>
        <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${interviewerName ? `<p><strong>Interviewer:</strong> ${interviewerName}</p>` : ''}
      </div>
      <p><strong>About Exit Interview:</strong></p>
      <ul>
        <li>This is a confidential conversation about your experience at ${companyName}</li>
        <li>Your feedback helps us improve our workplace and processes</li>
        <li>Please be open and honest about your experience</li>
        <li>The interview typically takes 30-45 minutes</li>
      </ul>
      <p>Please ensure you attend this important meeting. If you need to reschedule, please contact HR at least 24 hours in advance.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Exit Interview Scheduled - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending exit interview scheduled email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send asset return reminder email
 */
const sendAssetReturnReminderEmail = async ({
  employeeName,
  employeeEmail,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .asset-box { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💻 Asset Return Reminder</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="asset-box">
        <p><strong>📦 Asset Return Required</strong></p>
        <p>As part of your offboarding process, please return all company assets and property.</p>
      </div>
      <p><strong>Items to Return:</strong></p>
      <ul>
        <li>Laptop/Computer and accessories</li>
        <li>Mobile phone (if provided)</li>
        <li>Company ID card/access cards</li>
        <li>Keys (office, desk, etc.)</li>
        <li>Documents and files</li>
        <li>Any other company property</li>
      </ul>
      <p><strong>Return Process:</strong></p>
      <ol>
        <li>Contact IT department for equipment return</li>
        <li>Ensure all data is backed up from your devices</li>
        <li>Clear personal data from company devices</li>
        <li>Get acknowledgment receipt for returned items</li>
      </ol>
      <p>Please complete this process before your last working day to ensure smooth final settlement.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Asset Return Reminder - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending asset return reminder email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send clearance process email
 */
const sendClearanceProcessEmail = async ({
  employeeName,
  employeeEmail,
  department,
  cleared,
  notes,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${cleared ? '#10b981' : '#f59e0b'} 0%, ${cleared ? '#059669' : '#d97706'} 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .clearance-box { background: ${cleared ? '#d1fae5' : '#fef3c7'}; border-left: 4px solid ${cleared ? '#10b981' : '#f59e0b'}; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${cleared ? '✅' : '⏳'} ${department} Clearance ${cleared ? 'Completed' : 'Pending'}</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="clearance-box">
        <p><strong>${cleared ? '✅' : '⏳'} ${department} Department Status</strong></p>
        <p>Your clearance from the ${department} department is <strong>${cleared ? 'completed' : 'pending'}</strong>.</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      </div>
      ${cleared ? `
        <p><strong>Great! Your ${department} clearance is complete.</strong></p>
        <p>Please proceed with other department clearances if pending.</p>
      ` : `
        <p><strong>Action Required:</strong></p>
        <p>Please complete the clearance process with the ${department} department at the earliest.</p>
        <p>Contact the concerned department to understand any pending requirements.</p>
      `}
      <p><strong>Departments for Clearance:</strong></p>
      <ul>
        <li>HR Department</li>
        <li>Finance Department</li>
        <li>IT Department</li>
        <li>Admin Department</li>
      </ul>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `${department} Clearance ${cleared ? 'Completed' : 'Pending'} - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending clearance process email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send final settlement email
 */
const sendFinalSettlementEmail = async ({
  employeeName,
  employeeEmail,
  amount,
  paymentStatus,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .settlement-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Final Settlement Process</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="settlement-box">
        <p><strong>💰 Final Settlement Details</strong></p>
        <p>Your final settlement has been processed as part of the offboarding completion.</p>
        ${amount ? `<p><strong>Settlement Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>` : ''}
        <p><strong>Payment Status:</strong> ${paymentStatus}</p>
      </div>
      <p><strong>Settlement Includes:</strong></p>
      <ul>
        <li>Final month's salary</li>
        <li>Leave encashment (if applicable)</li>
        <li>Other dues/benefits</li>
        <li>Deductions (if any)</li>
      </ul>
      <p><strong>Important Notes:</strong></p>
      <ul>
        <li>The amount will be credited to your registered bank account</li>
        <li>Please update your bank details if there have been any changes</li>
        <li>Contact finance department for any settlement-related queries</li>
      </ul>
      <p>Thank you for your contributions to ${companyName}. We wish you the very best in your future endeavors!</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Final Settlement Processed - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending final settlement email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send offboarding completed email
 */
const sendOffboardingCompletedEmail = async ({
  employeeName,
  employeeEmail,
  companyName = 'Our Company'
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .completion-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Offboarding Completed</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="completion-box">
        <p><strong>✅ Offboarding Process Completed</strong></p>
        <p>Your offboarding process has been successfully completed at ${companyName}.</p>
      </div>
      <p><strong>Process Summary:</strong></p>
      <ul>
        <li>✅ Exit discussion completed</li>
        <li>✅ Assets returned</li>
        <li>✅ Documentation completed</li>
        <li>✅ All department clearances obtained</li>
        <li>✅ Final settlement processed</li>
      </ul>
      <p><strong>Final Documents:</strong></p>
      <ul>
        <li>Experience certificate will be sent to your registered email</li>
        <li>Relieving letter will be provided</li>
        <li>Form 16 and other tax documents will be shared</li>
  </ul>
      <p>Thank you for being a valuable part of ${companyName}. Your contributions have been appreciated, and we wish you tremendous success in your future career!</p>
      <p>Please stay in touch. You're always welcome to visit or connect with us professionally.</p>
      <p style="margin-top: 30px;">Wishing you all the very best,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Offboarding Completed - Thank You from ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error sending offboarding completed email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send documentation stage email
 */
const sendDocumentationStageEmail = async ({
  employeeName,
  employeeEmail,
  clearanceStatus,
  companyName = 'Our Company'
}) => {
  try {
    console.log('📧 sendDocumentationStageEmail: Sending email to', employeeEmail);
    console.log('📧 sendDocumentationStageEmail: Clearance status:', clearanceStatus);
    
    const transporter = createTransporter();
    if (!transporter) throw new Error('Email transporter not configured');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .doc-box { background: #ecfeff; border-left: 4px solid #06b6d4; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .clearance-item { margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 4px; }
    .clearance-completed { border-left: 4px solid #10b981; }
    .clearance-pending { border-left: 4px solid #f59e0b; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Documentation & Clearance Stage</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <div class="doc-box">
        <p><strong>📋 Documentation & Clearance Process</strong></p>
        <p>You have reached the documentation and clearance stage of your offboarding process. Please complete the following department clearances:</p>
      </div>
      
      <p><strong>Department Clearance Status:</strong></p>
      ${Object.entries(clearanceStatus || {}).map(([dept, status]) => `
        <div class="clearance-item ${status.cleared ? 'clearance-completed' : 'clearance-pending'}">
          <strong>${dept.charAt(0).toUpperCase() + dept.slice(1)} Department:</strong> 
          ${status.cleared ? '✅ Completed' : '⏳ Pending'}
          ${status.notes ? `<br><small>Notes: ${status.notes}</small>` : ''}
        </div>
      `).join('')}
      
      <p><strong>Required Actions:</strong></p>
      <ul>
        <li>Visit each department to complete clearance formalities</li>
        <li>Return all company assets and documents</li>
        <li>Settle any pending dues or advances</li>
        <li>Complete exit interview if not already done</li>
        <li>Update your contact information for future correspondence</li>
      </ul>
      
      <p><strong>Important Documents to Collect:</strong></p>
      <ul>
        <li>Experience Certificate</li>
        <li>Relieving Letter</li>
        <li>Form 16 (Tax Document)</li>
        <li>PF and ESIC statements (if applicable)</li>
      </ul>
      
      <p>Please coordinate with the HR department to ensure all clearances are completed smoothly. Each department will provide you with specific instructions for their clearance process.</p>
      
      <p style="margin-top: 30px;">Best regards,<br><strong>HR Team</strong><br>${companyName}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await sendEmailWithRetry(transporter, {
      from: { name: `${companyName} - HRMS`, address: process.env.EMAIL_USER },
      to: employeeEmail,
      subject: `Documentation & Clearance Stage - ${companyName}`,
      html: htmlContent,
      priority: 'high'
    });

    console.log('✅ sendDocumentationStageEmail: Email sent successfully to', employeeEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending documentation stage email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail, // Generic email function
  sendOnboardingEmail,
  sendHRNotification,
  sendInterviewNotification,
  sendInterviewScheduledEmail,
  sendInterviewReminderEmail,
  sendInterviewCancelledEmail,
  sendShortlistedEmail,
  sendInterviewCompletedEmail,
  sendOfferExtendedEmail,
  sendOfferLetterWithTemplate,
  sendOfferLetterWithDocumentLink,
  sendDocumentRequestEmail,
  sendJoiningDateConfirmationEmail,
  sendITNotification,
  sendFacilitiesNotification,
  sendRejectionEmail,
  sendApplicationReceivedEmail,
  verifyEmailConfig,
  sendDocumentRejectionEmail,
  sendCompanyAdminCredentials,
  // Offboarding email functions
  sendOffboardingInitiatedEmail,
  sendExitInterviewScheduledEmail,
  sendAssetReturnReminderEmail,
  sendClearanceProcessEmail,
  sendFinalSettlementEmail,
  sendOffboardingCompletedEmail,
  sendDocumentationStageEmail
};
