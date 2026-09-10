/**
 * Fail fast when required production (or always-required) env vars are missing.
 * Call before DB connect / listen.
 */
function validateEnv() {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

  const required = ['MONGODB_URI', 'JWT_SECRET'];
  if (isProduction) {
    required.push('CORS_ORIGIN');
  }

  const missing = required.filter((name) => !process.env[name] || String(process.env[name]).trim() === '');

  if (missing.length) {
    console.error('❌ Missing required environment variable(s):', missing.join(', '));
    console.error('   Copy .env.example and set real values before starting the server.');
    process.exit(1);
  }

  if (isProduction) {
    const weakJwt = ['your_jwt_secret_here', 'your-secret-key-here', 'changeme'];
    if (weakJwt.includes(process.env.JWT_SECRET)) {
      console.error('❌ JWT_SECRET must be a strong unique value in production.');
      process.exit(1);
    }
    if (!process.env.REDIS_URL) {
      console.error('❌ REDIS_URL is required in production for token revocation / logout.');
      process.exit(1);
    }
    if (!process.env.FRONTEND_URL) {
      console.warn('⚠️  FRONTEND_URL not set — email links may be incorrect.');
    }
  }
}

module.exports = { validateEnv };
