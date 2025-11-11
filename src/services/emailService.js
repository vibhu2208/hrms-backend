const nodemailer = require('nodemailer');

/**
 * Email Service for HRMS
 * Handles all email communications including onboarding, notifications, etc.
 * Uses Gmail SMTP with app password for secure authentication
 */

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

module.exports = {
  sendOnboardingEmail,
  sendHRNotification,
  sendInterviewNotification,
  sendApplicationReceivedEmail,
  sendShortlistedEmail,
  sendInterviewCompletedEmail,
  sendOfferExtendedEmail,
  sendRejectionEmail,
  sendCompanyAdminCredentials,
  verifyEmailConfig
};
