/**
 * Test Email Configuration - Bypasses real email sending for development
 * This allows password reset functionality to work without email setup
 */

const crypto = require('crypto');

class TestEmailService {
  constructor() {
    this.resetTokens = new Map(); // Store tokens in memory for testing
  }

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateResetTokenExpiry() {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }

  async sendPasswordResetEmail(email, resetToken, companyName = null) {
    // Store token for testing
    this.resetTokens.set(email, {
      token: resetToken,
      expiry: new Date(Date.now() + 15 * 60 * 1000),
      companyName
    });

    console.log('📧 [TEST MODE] Password reset email would be sent to:', email);
    console.log('🔗 [TEST MODE] Reset link would be:', `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`);
    console.log('⏰ [TEST MODE] Link expires in: 15 minutes');
    
    return true;
  }

  async sendPasswordResetConfirmationEmail(email, companyName = null) {
    console.log('📧 [TEST MODE] Password reset confirmation would be sent to:', email);
    return true;
  }

  async verifyTransporter() {
    console.log('📧 [TEST MODE] Using test email service (no real emails sent)');
    return true;
  }

  // Test method to get stored token
  getStoredToken(email) {
    return this.resetTokens.get(email);
  }

  // Test method to clear stored tokens
  clearStoredToken(email) {
    this.resetTokens.delete(email);
  }
}

// Create singleton instance
const testEmailService = new TestEmailService();

module.exports = testEmailService;
