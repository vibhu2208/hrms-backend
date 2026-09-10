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
  [ENV.DEVELOPMENT]: `http://localhost:${process.env.PORT || 5001}`,
  [ENV.PRODUCTION]: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`,
  [ENV.STAGING]: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`,
  [ENV.TEST]: `http://localhost:${process.env.PORT || 5001}`
};

// Frontend URLs for different environments (for CORS)
const FRONTEND_URLS = {
  [ENV.DEVELOPMENT]: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080'
  ],
  [ENV.PRODUCTION]: [],
  [ENV.STAGING]: [],
  [ENV.TEST]: [
    'http://localhost:5173'
  ]
};

// Get current environment
const currentEnv = getCurrentEnvironment();

/**
 * Allowed origins = explicit env list only in production/staging.
 * Development keeps local defaults + optional CORS_ORIGIN extras.
 */
const getAllowedOrigins = () => {
  const fromEnv = [];
  if (process.env.CORS_ORIGIN) {
    fromEnv.push(...process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean));
  }
  if (process.env.FRONTEND_URL) {
    fromEnv.push(process.env.FRONTEND_URL.trim());
  }

  if (currentEnv === ENV.PRODUCTION || currentEnv === ENV.STAGING) {
    return [...new Set(fromEnv)];
  }

  const envOrigins = FRONTEND_URLS[currentEnv] || FRONTEND_URLS[ENV.DEVELOPMENT];
  return [...new Set([...envOrigins, ...fromEnv])];
};

// Export configuration
const config = {
  env: currentEnv,
  isDevelopment: currentEnv === ENV.DEVELOPMENT,
  isProduction: currentEnv === ENV.PRODUCTION,
  isStaging: currentEnv === ENV.STAGING,
  isTest: currentEnv === ENV.TEST,
  
  // Server Configuration
  port: parseInt(process.env.PORT || '5001', 10),
  backendUrl: BACKEND_URLS[currentEnv],
  
  // CORS Configuration
  allowedOrigins: getAllowedOrigins(),
  corsOptions: {
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow non-browser clients (Postman, server-to-server, health probes)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // Dev-only convenience: any localhost origin
      if (currentEnv === ENV.DEVELOPMENT && origin.startsWith('http://localhost')) {
        return callback(null, true);
      }
      
      console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
      console.warn(`   Allowed origins: ${allowedOrigins.join(', ') || '(none configured)'}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'cache-control', 
      'Cache-Control',
      'pragma',
      'Pragma',
      'expires',
      'Expires',
      'last-modified',
      'If-Modified-Since',
      'If-None-Match',
      'ETag',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'User-Agent',
      'Referer',
      'Origin',
      'X-Requested-With'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
  },
  
  // Database Configuration
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms',
  
  // JWT Configuration — no weak production default (validateEnv enforces JWT_SECRET)
  jwtSecret: process.env.JWT_SECRET || (currentEnv === ENV.PRODUCTION ? undefined : 'dev_only_jwt_secret'),
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

console.log('🔧 Backend Configuration:', {
  environment: config.env,
  port: config.port,
  backendUrl: config.backendUrl,
  allowedOrigins: config.allowedOrigins,
  nodeEnv: process.env.NODE_ENV,
  corsOriginEnv: process.env.CORS_ORIGIN,
  frontendUrlEnv: process.env.FRONTEND_URL
});

if (config.isDevelopment) {
  console.log('📊 Database:', config.mongoUri.replace(/\/\/.*@/, '//***:***@'));
}

module.exports = config;
