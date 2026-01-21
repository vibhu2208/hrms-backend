require('dotenv').config();

// Global error handlers to prevent crashes
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit - allow server to continue running
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  // Only exit for critical errors
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${apiConfig.port} is already in use.`);
    console.error(`Please ensure no other process is using port ${apiConfig.port}`);
    console.error(`Or set a different PORT environment variable.\n`);
    process.exit(1);
  }
});

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const apiConfig = require('./config/api.config');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const assetRoutes = require('./routes/assetRoutes');
const jobPostingRoutes = require('./routes/jobPostingRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const offboardingRoutes = require('./routes/offboardingRoutes');
const tenantOffboardingRoutes = require('./routes/tenant/offboardingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientRoutes = require('./routes/clientRoutes');
const projectRoutes = require('./routes/projectRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const documentRoutes = require('./routes/documentRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const exitProcessRoutes = require('./routes/exitProcessRoutes');
const reportRoutes = require('./routes/reportRoutes');
const aiAnalysisRoutes = require('./routes/aiAnalysisRoutes');
const publicJobRoutes = require('./routes/publicJobRoutes');
const talentPoolRoutes = require('./routes/talentPoolRoutes');
const offerTemplateRoutes = require('./routes/offerTemplateRoutes');
const employeeDashboardRoutes = require('./routes/employeeDashboard');
const candidateDocumentRoutes = require('./routes/candidateDocumentRoutes');
const userRoutes = require('./routes/userRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const testRoutes = require('./routes/testRoutes');
const managerRoutes = require('./routes/managerRoutes');
const resumePoolRoutes = require('./routes/resumePoolRoutes');
const jobDescriptionRoutes = require('./routes/jobDescriptionRoutes');
const workScheduleRoutes = require('./routes/workScheduleRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const biometricRoutes = require('./routes/biometricRoutes');
const sapRoutes = require('./routes/sapRoutes');
const leaveAccrualRoutes = require('./routes/leaveAccrualRoutes');
const leaveManagementRoutes = require('./routes/leaveManagementRoutes');
const approvalWorkflowRoutes = require('./routes/approvalWorkflowRoutes');
const employeeProfileRoutes = require('./routes/employeeProfileRoutes');
const leaveEncashmentRoutes = require('./routes/leaveEncashmentRoutes');
const advancedReportsRoutes = require('./routes/advancedReportsRoutes');
const publicDocumentUploadRoutes = require('./routes/publicDocumentUploadRoutes');
const documentVerificationRoutes = require('./routes/documentVerificationRoutes');

// Import tenant middleware
const { tenantMiddleware } = require('./middlewares/tenantMiddleware');

// Connect to database
connectDB();

// Start cron jobs for alerts
const { startCronJobs } = require('./utils/cronJobs');
startCronJobs();

const app = express();

app.set('etag', false);

// Middleware - Use centralized CORS configuration
app.use(cors(apiConfig.corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HRMS API is running',
    timestamp: new Date().toISOString()
  });
});

// Static file serving for uploads
const uploadsPath = path.join(__dirname, '../uploads');
const resumesPath = path.join(uploadsPath, 'resumes');
console.log('📁 Uploads directory path:', uploadsPath);
console.log('📁 Resumes directory path:', resumesPath);

// Serve resume files with proper headers and CORS
app.use('/uploads/resumes', (req, res, next) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(resumesPath, {
  setHeaders: (res, filePath) => {
    // Set appropriate content type
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline'); // Display in browser instead of download
    }
    // Cache control
    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
  dotfiles: 'allow',
  index: false
}));

// Serve other uploads
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  },
  dotfiles: 'allow',
  index: false
}));

// Public API Routes (no authentication required)
app.use('/api/public/jobs', publicJobRoutes);
app.use('/api/public/document-upload', publicDocumentUploadRoutes);
app.use('/api/candidate-documents', candidateDocumentRoutes);

// Protected API Routes (tenant isolation handled within route files)
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/leave-accrual', leaveAccrualRoutes);
app.use('/api/leave-management', leaveManagementRoutes);
app.use('/api/approval', approvalWorkflowRoutes);
app.use('/api/employee/profile', employeeProfileRoutes);
app.use('/api/leave-encashment', leaveEncashmentRoutes);
app.use('/api/reports', advancedReportsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/work-schedule', workScheduleRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/sap', sapRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/jobs', jobPostingRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/offboarding', offboardingRoutes);
app.use('/api/tenant/offboarding', tenantOffboardingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/job-descriptions', jobDescriptionRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/exit-process', exitProcessRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai-analysis', aiAnalysisRoutes);
app.use('/api/talent-pool', talentPoolRoutes);
app.use('/api/offer-templates', offerTemplateRoutes);
app.use('/api/employee', employeeDashboardRoutes);
app.use('/api/user', userRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/test', testRoutes);
app.use('/api/resume-pool', resumePoolRoutes);
app.use('/api/document-verification', documentVerificationRoutes);

// Error handler (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(apiConfig.port, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${apiConfig.env} mode on port ${apiConfig.port}`);
  console.log(`📡 API Base URL: ${apiConfig.backendUrl}`);
  console.log(`🌐 Allowed Origins: ${apiConfig.allowedOrigins.join(', ')}`);
});

module.exports = app;
