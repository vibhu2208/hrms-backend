/**
 * Centralized API Configuration for Backend
 * Automatically detects environment and sets appropriate URLs and CORS origins
 */

const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  STAGING: 'staging',
  TEST: 'test'
};

// Detect current environment
const getCurrentEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv.toLowerCase();
};

// Backend URLs for different environments
const BACKEND_URLS = {
  [ENV.DEVELOPMENT]: `http://localhost:${process.env.PORT || 5000}`,
  [ENV.PRODUCTION]: process.env.BACKEND_URL || 'https://hrms-backend-xbz8.onrender.com',
  [ENV.STAGING]: process.env.BACKEND_URL || 'https://hrms-backend-xbz8.onrender.com',
  [ENV.TEST]: `http://localhost:${process.env.PORT || 5000}`
};

// Frontend URLs for different environments (for CORS)
const FRONTEND_URLS = {
  [ENV.DEVELOPMENT]: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  [ENV.PRODUCTION]: [
    process.env.FRONTEND_URL || 'https://hrms-frontend-blush.vercel.app',
    'https://hrms-frontend-blush.vercel.app'
  ],
  [ENV.STAGING]: [
    process.env.FRONTEND_URL || 'https://hrms-frontend-blush.vercel.app'
  ],
  [ENV.TEST]: [
    'http://localhost:5173'
  ]
};

// Get current environment
const currentEnv = getCurrentEnvironment();

// Get allowed CORS origins
const getAllowedOrigins = () => {
  const envOrigins = FRONTEND_URLS[currentEnv] || FRONTEND_URLS[ENV.DEVELOPMENT];
  
  // If CORS_ORIGIN is set in .env, add it to the list
  if (process.env.CORS_ORIGIN) {
    const customOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    return [...new Set([...envOrigins, ...customOrigins])];
  }
  
  return envOrigins;
};

// Export configuration
const config = {
  env: currentEnv,
  isDevelopment: currentEnv === ENV.DEVELOPMENT,
  isProduction: currentEnv === ENV.PRODUCTION,
  isStaging: currentEnv === ENV.STAGING,
  isTest: currentEnv === ENV.TEST,
  
  // Server Configuration
  port: parseInt(process.env.PORT || '5000', 10),
  backendUrl: BACKEND_URLS[currentEnv],
  
  // CORS Configuration
  allowedOrigins: getAllowedOrigins(),
  corsOptions: {
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
  },
  
  // Database Configuration
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_here',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // API Configuration
  apiPrefix: '/api',
  apiVersion: 'v1',
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: currentEnv === ENV.PRODUCTION ? 100 : 1000 // requests per windowMs
  }
};

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 Backend Configuration:', {
    environment: config.env,
    port: config.port,
    backendUrl: config.backendUrl,
    allowedOrigins: config.allowedOrigins,
    mongoUri: config.mongoUri.replace(/\/\/.*@/, '//***:***@') // Hide credentials
  });
}

module.exports = config;
