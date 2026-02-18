const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Use test email service for development to bypass Gmail issues
let emailService;

// Check if we should use test mode
if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER && !process.env.SMTP_HOST) {
  console.log('📧 Using TEST email service (development mode)');
  emailService = require('./email-test');
} else {
  console.log('📧 Using REAL email service (production mode)');
  console.log('📧 Email configuration:', {
    hasSmtpHost: !!process.env.SMTP_HOST,
    hasSmtpUser: !!process.env.SMTP_USER,
    hasEmailUser: !!process.env.EMAIL_USER,
    nodeEnv: process.env.NODE_ENV
  });
  
  class EmailService {
    constructor() {
      this.transporter = null;
      this.isTestMode = false;
      this.initializeTransporter();
    }

    async initializeTransporter() {
      // Use Gmail configuration only
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        console.log('📧 Using Gmail SMTP configuration');
        try {
          this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_APP_PASSWORD
            }
          });
          
          // Test the connection
          await this.transporter.verify();
          console.log('✅ Gmail SMTP connection verified');
        } catch (error) {
          console.error('❌ Gmail SMTP connection failed:', error.message);
          console.log('📧 Falling back to TEST mode due to Gmail failure');
          this.fallbackToTestMode();
        }
      } else {
        console.warn('⚠️  Gmail credentials not found. Using TEST mode.');
        this.fallbackToTestMode();
      }
    }

    fallbackToTestMode() {
      this.isTestMode = true;
      const testService = require('./email-test');
      this.generateResetToken = testService.generateResetToken;
      this.generateResetTokenExpiry = testService.generateResetTokenExpiry;
      this.sendPasswordResetEmail = testService.sendPasswordResetEmail;
      this.sendPasswordResetConfirmationEmail = testService.sendPasswordResetConfirmationEmail;
      console.log('📧 Switched to TEST email service');
    }

    generateResetToken() {
      return crypto.randomBytes(32).toString('hex');
    }

    generateResetTokenExpiry() {
      return new Date(Date.now() + 15 * 60 * 1000);
    }

    async sendPasswordResetEmail(email, resetToken, companyName = null) {
      if (!this.transporter) {
        console.warn('⚠️  Email transporter not configured');
        return false;
      }

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: `"${companyName || 'HRMS System'}" <${process.env.EMAIL_USER || 'noreply@hrms.com'}>`,
        to: email,
        subject: 'Password Reset Request - HRMS System',
        html: this.getPasswordResetTemplate(email, resetUrl, companyName)
      };

      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('📧 Password reset email sent to:', email);
        return result;
      } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        throw error;
      }
    }

    async sendPasswordResetConfirmationEmail(email, companyName = null) {
      if (!this.transporter) {
        console.warn('⚠️  Email transporter not configured');
        return false;
      }

      const mailOptions = {
        from: `"${companyName || 'HRMS System'}" <${process.env.EMAIL_USER || 'noreply@hrms.com'}>`,
        to: email,
        subject: 'Password Reset Successful - HRMS System',
        html: this.getPasswordResetConfirmationTemplate(email, companyName)
      };

      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('📧 Password reset confirmation email sent to:', email);
        return result;
      } catch (error) {
        console.error('❌ Error sending password reset confirmation email:', error);
        throw error;
      }
    }

    async sendProjectApprovalNotification(managerEmail, projectDetails, companyName = null) {
      if (!this.transporter) {
        console.warn('⚠️  Email transporter not configured');
        return false;
      }

      const mailOptions = {
        from: `"${companyName || 'HRMS System'}" <${process.env.EMAIL_USER || 'noreply@hrms.com'}>`,
        to: managerEmail,
        subject: `Project Approved: ${projectDetails.name}`,
        html: this.getProjectApprovalTemplate(managerEmail, projectDetails, companyName)
      };

      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('📧 Project approval notification sent to:', managerEmail);
        return result;
      } catch (error) {
        console.error('❌ Error sending project approval notification:', error);
        throw error;
      }
    }

    async sendProjectRejectionNotification(managerEmail, projectDetails, companyName = null) {
      if (!this.transporter) {
        console.warn('⚠️  Email transporter not configured');
        return false;
      }

      const mailOptions = {
        from: `"${companyName || 'HRMS System'}" <${process.env.EMAIL_USER || 'noreply@hrms.com'}>`,
        to: managerEmail,
        subject: `Project Rejected: ${projectDetails.name}`,
        html: this.getProjectRejectionTemplate(managerEmail, projectDetails, companyName)
      };

      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('📧 Project rejection notification sent to:', managerEmail);
        return result;
      } catch (error) {
        console.error('❌ Error sending project rejection notification:', error);
        throw error;
      }
    }

    async sendProjectSubmissionNotification(adminEmail, projectDetails, companyName = null) {
      if (!this.transporter) {
        console.warn('⚠️  Email transporter not configured');
        return false;
      }

      const mailOptions = {
        from: `"${companyName || 'HRMS System'}" <${process.env.EMAIL_USER || 'noreply@hrms.com'}>`,
        to: adminEmail,
        subject: `New Project Pending Approval: ${projectDetails.name}`,
        html: this.getProjectSubmissionTemplate(adminEmail, projectDetails, companyName)
      };

      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('📧 Project submission notification sent to:', adminEmail);
        return result;
      } catch (error) {
        console.error('❌ Error sending project submission notification:', error);
        throw error;
      }
    }

    getPasswordResetTemplate(email, resetUrl, companyName) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - ${companyName || 'HRMS'}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a password reset request for your account: <strong>${email}</strong></p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p>This link expires in 15 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>`;
    }

    getPasswordResetConfirmationTemplate(email, companyName) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful - ${companyName || 'HRMS'}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2>Password Reset Successful</h2>
    <p>Hello,</p>
    <p>Your password has been successfully reset for: <strong>${email}</strong></p>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login">Login</a></p>
  </div>
</body>
</html>`;
    }

    getProjectApprovalTemplate(managerEmail, projectDetails, companyName) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Approved - ${companyName || 'HRMS'}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2>✅ Project Approved</h2>
    <p>Hello,</p>
    <p>Great news! Your project has been approved and is now active.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3>${projectDetails.name}</h3>
      <p><strong>Project Code:</strong> ${projectDetails.projectCode}</p>
      <p><strong>Client:</strong> ${projectDetails.client?.name || 'N/A'}</p>
      <p><strong>Start Date:</strong> ${new Date(projectDetails.startDate).toLocaleDateString()}</p>
      ${projectDetails.endDate ? `<p><strong>End Date:</strong> ${new Date(projectDetails.endDate).toLocaleDateString()}</p>` : ''}
      <p><strong>Team Members:</strong> ${projectDetails.teamMembers?.length || 0}</p>
    </div>
    <p>You can now start managing this project and assign tasks to your team.</p>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee/manager/projects" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Project</a></p>
  </div>
</body>
</html>`;
    }

    getProjectRejectionTemplate(managerEmail, projectDetails, companyName) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Rejected - ${companyName || 'HRMS'}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2>❌ Project Rejected</h2>
    <p>Hello,</p>
    <p>Your project request has been rejected. Please review the feedback below and make necessary adjustments.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3>${projectDetails.name}</h3>
      <p><strong>Project Code:</strong> ${projectDetails.projectCode}</p>
      <p><strong>Client:</strong> ${projectDetails.client?.name || 'N/A'}</p>
      <div style="background-color: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
        <strong>Rejection Reason:</strong><br>
        ${projectDetails.rejectionReason || 'No specific reason provided'}
      </div>
    </div>
    <p>You may modify the project details and submit it again for approval.</p>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee/manager/projects" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Projects</a></p>
  </div>
</body>
</html>`;
    }

    getProjectSubmissionTemplate(adminEmail, projectDetails, companyName) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Project Pending Approval - ${companyName || 'HRMS'}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2>📋 New Project Pending Approval</h2>
    <p>Hello,</p>
    <p>A new project has been submitted and is awaiting your approval.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3>${projectDetails.name}</h3>
      <p><strong>Project Code:</strong> ${projectDetails.projectCode}</p>
      <p><strong>Submitted by:</strong> ${projectDetails.submittedBy?.firstName || 'Unknown'} ${projectDetails.submittedBy?.lastName || ''}</p>
      <p><strong>Client:</strong> ${projectDetails.client?.name || 'N/A'}</p>
      <p><strong>Start Date:</strong> ${new Date(projectDetails.startDate).toLocaleDateString()}</p>
      ${projectDetails.endDate ? `<p><strong>End Date:</strong> ${new Date(projectDetails.endDate).toLocaleDateString()}</p>` : ''}
      <p><strong>Priority:</strong> ${projectDetails.priority?.toUpperCase() || 'MEDIUM'}</p>
      <p><strong>Team Members:</strong> ${projectDetails.teamMembers?.length || 0}</p>
    </div>
    <p>Please review the project details and approve or reject the request.</p>
    <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/administration/project-approval" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Project</a></p>
  </div>
</body>
</html>`;
    }

    async verifyTransporter() {
      if (!this.transporter) {
        return false;
      }

      try {
        await this.transporter.verify();
        console.log('✅ Email transporter is ready');
        return true;
      } catch (error) {
        console.error('❌ Email transporter verification failed:', error);
        return false;
      }
    }
  }

  emailService = new EmailService();
}

module.exports = emailService;