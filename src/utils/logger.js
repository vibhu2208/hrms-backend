const winston = require('winston');

// Create logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hrms-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Security event logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'hrms-security' },
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = {
  logger,
  securityLogger,
  logSecurityEvent: (event, details) => {
    securityLogger.info({
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  },
  logAuthEvent: (action, userId, details = {}) => {
    logger.info({
      event: 'auth',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};
