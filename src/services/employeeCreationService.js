/**
 * Employee Creation Service
 * Handles conversion of onboarding candidates to employees
 */

const { getTenantModel } = require('../utils/tenantModels');
const { getTenantConnection } = require('../config/database.config');
const TenantUserSchema = require('../models/tenant/TenantUser');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('./emailService');

class EmployeeCreationService {
  /**
   * Complete onboarding and create employee record
   * @param {String} onboardingId - Onboarding record ID
   * @param {Object} tenantConnection - Tenant database connection
   * @param {Object} additionalData - Additional employee data
   */
  async completeOnboardingAndCreateEmployee(onboardingId, tenantConnection, additionalData = {}) {
    try {
      const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
      const TenantUser = tenantConnection.model('User', TenantUserSchema);
      
      // Get onboarding record
      const onboarding = await Onboarding.findById(onboardingId)
        .populate('applicationId')
        .populate('department');
      
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      // Check if all documents are verified
      if (onboarding.documents && onboarding.documents.length > 0) {
        const unverifiedDocs = onboarding.documents.filter(doc => doc.status !== 'verified');
        if (unverifiedDocs.length > 0) {
          throw new Error('All documents must be verified before completing onboarding');
        }
      }

      console.log(`🔄 Creating employee from onboarding: ${onboarding.candidateName}`);

      // Generate employee code
      const employeeCode = await this.generateEmployeeCode(tenantConnection);

      // Generate temporary password
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create employee user account
      const employeeData = {
        email: onboarding.candidateEmail,
        password: hashedPassword,
        firstName: onboarding.candidateName.split(' ')[0],
        lastName: onboarding.candidateName.split(' ').slice(1).join(' ') || '',
        phone: onboarding.candidatePhone,
        role: 'employee',
        employeeCode: employeeCode,
        designation: onboarding.position,
        department: onboarding.department?._id || onboarding.department,
        departmentId: onboarding.department?._id || onboarding.department,
        joiningDate: onboarding.joiningDate || new Date(),
        isActive: true,
        isFirstLogin: true,
        mustChangePassword: true,
        // Salary details from offer
        salary: {
          basic: onboarding.offer?.salary?.basic || 0,
          hra: onboarding.offer?.salary?.hra || 0,
          allowances: onboarding.offer?.salary?.allowances || 0,
          total: onboarding.offer?.offeredCTC || 0
        },
        // Additional data
        ...additionalData
      };

      // Create user account
      const employee = await TenantUser.create(employeeData);

      console.log(`✅ Employee created: ${employee.email} (${employeeCode})`);

      // Update onboarding status
      onboarding.status = 'completed';
      onboarding.candidateId = employee._id;
      onboarding.completedAt = new Date();
      
      // Add to timeline
      if (!onboarding.timeline) {
        onboarding.timeline = [];
      }
      onboarding.timeline.push({
        stage: 'completed',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        notes: 'Onboarding completed - Employee record created'
      });

      await onboarding.save();

      // Send welcome email with credentials
      await this.sendWelcomeEmail(employee, tempPassword, onboarding);

      return {
        success: true,
        employee,
        employeeCode,
        tempPassword, // Only for logging/admin view
        onboarding
      };
    } catch (error) {
      console.error('❌ Error creating employee from onboarding:', error);
      throw error;
    }
  }

  /**
   * Generate unique employee code
   */
  async generateEmployeeCode(tenantConnection) {
    const TenantUser = tenantConnection.model('User', TenantUserSchema);
    
    // Get count of existing employees
    const employeeCount = await TenantUser.countDocuments({ role: { $in: ['employee', 'manager'] } });
    
    // Generate code: EMP + 4-digit number
    const codeNumber = (employeeCount + 1).toString().padStart(4, '0');
    const employeeCode = `EMP${codeNumber}`;
    
    // Check if code already exists
    const existing = await TenantUser.findOne({ employeeCode });
    if (existing) {
      // If exists, use timestamp to make it unique
      return `EMP${Date.now().toString().slice(-6)}`;
    }
    
    return employeeCode;
  }

  /**
   * Generate temporary password
   */
  generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Send welcome email with credentials
   */
  async sendWelcomeEmail(employee, tempPassword, onboarding) {
    try {
      const emailData = {
        to: employee.email,
        subject: 'Welcome to the Team! Your Account Details',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome ${employee.firstName}!</h2>
            
            <p>Congratulations on completing your onboarding! We're excited to have you join our team.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1F2937;">Your Account Details</h3>
              <p style="margin: 10px 0;"><strong>Employee Code:</strong> ${employee.employeeCode}</p>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${employee.email}</p>
              <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #E5E7EB; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
              <p style="margin: 10px 0;"><strong>Position:</strong> ${employee.designation}</p>
              <p style="margin: 10px 0;"><strong>Joining Date:</strong> ${new Date(employee.joiningDate).toLocaleDateString()}</p>
            </div>
            
            <div style="background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0;">
              <p style="margin: 0;"><strong>⚠️ Important:</strong> Please change your password upon first login for security purposes.</p>
            </div>
            
            <h3>Next Steps:</h3>
            <ol>
              <li>Log in to the HRMS portal using your email and temporary password</li>
              <li>Change your password immediately</li>
              <li>Complete your profile information</li>
              <li>Review company policies and guidelines</li>
            </ol>
            
            <p style="margin-top: 30px;">If you have any questions or need assistance, please don't hesitate to contact HR.</p>
            
            <p>Best regards,<br>HR Team</p>
          </div>
        `
      };

      await sendEmail(emailData);
      console.log(`📧 Welcome email sent to ${employee.email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error.message);
      // Don't throw - email failure shouldn't stop employee creation
    }
  }

  /**
   * Bulk complete onboarding for multiple candidates
   */
  async bulkCompleteOnboarding(onboardingIds, tenantConnection) {
    const results = [];
    const errors = [];

    for (const id of onboardingIds) {
      try {
        const result = await this.completeOnboardingAndCreateEmployee(id, tenantConnection);
        results.push({
          onboardingId: id,
          employeeCode: result.employeeCode,
          email: result.employee.email,
          status: 'success'
        });
      } catch (error) {
        errors.push({
          onboardingId: id,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      completed: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * Validate onboarding completion readiness
   */
  async validateOnboardingCompletion(onboardingId, tenantConnection) {
    const Onboarding = getTenantModel(tenantConnection, 'Onboarding');
    const onboarding = await Onboarding.findById(onboardingId);

    if (!onboarding) {
      return { valid: false, errors: ['Onboarding record not found'] };
    }

    const errors = [];
    const warnings = [];

    // Check required fields
    if (!onboarding.candidateEmail) errors.push('Candidate email is required');
    if (!onboarding.candidateName) errors.push('Candidate name is required');
    if (!onboarding.position) errors.push('Position is required');
    if (!onboarding.department) errors.push('Department is required');

    // Check documents
    if (onboarding.documents && onboarding.documents.length > 0) {
      const unverifiedDocs = onboarding.documents.filter(doc => doc.status !== 'verified');
      if (unverifiedDocs.length > 0) {
        errors.push(`${unverifiedDocs.length} document(s) not verified`);
      }
    } else {
      warnings.push('No documents uploaded');
    }

    // Check joining date
    if (!onboarding.joiningDate) {
      warnings.push('Joining date not set');
    }

    // Check offer details
    if (!onboarding.offer || !onboarding.offer.offeredCTC) {
      warnings.push('Offer details incomplete');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = new EmployeeCreationService();
