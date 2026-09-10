require('dotenv').config();

const { validateEnv } = require('./config/validateEnv');
validateEnv();

const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  /* Node < 17 */
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const connectDB = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const { protect } = require('./middlewares/auth');
const apiConfig = require('./config/api.config');

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
const agreementTemplateRoutes = require('./routes/agreementTemplateRoutes');
const employeeDashboardRoutes = require('./routes/employeeDashboard');
const candidateDocumentRoutes = require('./routes/candidateDocumentRoutes');
const userRoutes = require('./routes/userRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const testRoutes = require('./routes/testRoutes');
const managerRoutes = require('./routes/managerRoutes');
const spcManagerRoutes = require('./routes/spcManagerRoutes');
const resumePoolRoutes = require('./routes/resumePoolRoutes');
const jobDescriptionRoutes = require('./routes/jobDescriptionRoutes');
const workScheduleRoutes = require('./routes/workScheduleRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const biometricRoutes = require('./routes/biometricRoutes');
const sapRoutes = require('./routes/sapRoutes');
const leaveAccrualRoutes = require('./routes/leaveAccrualRoutes');
const leaveManagementRoutes = require('./routes/leaveManagementRoutes');
const approvalWorkflowRoutes = require('./routes/approvalWorkflowRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const employeeProfileRoutes = require('./routes/employeeProfileRoutes');
const leaveEncashmentRoutes = require('./routes/leaveEncashmentRoutes');
const publicDocumentUploadRoutes = require('./routes/publicDocumentUploadRoutes');
const documentVerificationRoutes = require('./routes/documentVerificationRoutes');
const hrActivityHistoryRoutes = require('./routes/hrActivityHistoryRoutes');
const contractRoutes = require('./routes/contractRoutes');
const spcProjectRoutes = require('./routes/spcProjectRoutesSimple');

// Connect to database
connectDB();

// Start cron jobs for alerts
const { startCronJobs } = require('./utils/cronJobs');
startCronJobs();

const app = express();

app.set('etag', false);
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Middleware - Use centralized CORS configuration
app.use(cors(apiConfig.corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: apiConfig.rateLimit.windowMs,
  max: apiConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiConfig.isProduction ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiConfig.isProduction ? 60 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/public/', publicLimiter);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route (liveness)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HRMS API is running',
    timestamp: new Date().toISOString()
  });
});

// Readiness: verifies MongoDB connectivity
app.get('/health/ready', async (req, res) => {
  const mongoose = require('mongoose');
  const health = {
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    const state = mongoose.connection.readyState;
    if (state === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      health.checks.database = 'ok';
    } else {
      health.checks.database = state === 2 ? 'connecting' : 'down';
      health.status = 'degraded';
      health.success = false;
    }
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
    health.success = false;
  }

  res.status(health.success ? 200 : 503).json(health);
});

// Authenticated file serving (replaces public /uploads static)
const fileRoutes = require('./routes/fileRoutes');
app.use('/api/files', fileRoutes);

// Public API Routes (no authentication required)
app.use('/api/public/jobs', publicJobRoutes);
app.use('/api/public/document-upload', publicDocumentUploadRoutes);
app.use('/api/candidate-documents', publicLimiter, candidateDocumentRoutes);

// Protected API Routes (tenant isolation handled within route files)
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/leave-accrual', leaveAccrualRoutes);
app.use('/api/leave-management', leaveManagementRoutes);
app.use('/api/approval', approvalWorkflowRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/employee/profile', employeeProfileRoutes);
app.use('/api/leave-encashment', leaveEncashmentRoutes);
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
app.use('/api/agreement-templates', agreementTemplateRoutes);
app.use('/api/employee', employeeDashboardRoutes);
app.use('/api/user', userRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/spc-manager', spcManagerRoutes);
if (!apiConfig.isProduction) {
  app.use('/api/test', testRoutes);
}
app.use('/api/resume-pool', resumePoolRoutes);
app.use('/api/document-verification', documentVerificationRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/hr-activity-history', hrActivityHistoryRoutes);
app.use('/api/spc', spcProjectRoutes);
if (apiConfig.isDevelopment) {
  console.log('🔧 SPC Routes mounted at /api/spc');
}

// Optional frontend calls — empty stub behind auth
app.get('/api/tasks/my-tasks', protect, (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

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
