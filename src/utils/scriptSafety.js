/**
 * Guard destructive / seed scripts from running against production.
 * Usage at top of script (after dotenv):
 *   require('../src/utils/scriptSafety').assertSafeToMutate({ requireAllowFlag: true });
 */
function assertSafeToMutate(options = {}) {
  const {
    requireAllowFlag = false,
    allowFlag = 'ALLOW_SEED',
    label = 'this script'
  } = options;

  const env = (process.env.NODE_ENV || '').toLowerCase();
  if (env === 'production') {
    console.error(`❌ Refusing to run ${label} while NODE_ENV=production`);
    process.exit(1);
  }

  if (requireAllowFlag && process.env[allowFlag] !== '1') {
    console.error(`❌ Refusing to run ${label}. Re-run with ${allowFlag}=1 to confirm.`);
    process.exit(1);
  }
}

module.exports = { assertSafeToMutate };
