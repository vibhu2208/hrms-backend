/**
 * Live smoke checks — hit liveness + readiness endpoints.
 * Usage:
 *   node scripts/smoke-live.js
 *   SMOKE_BASE_URL=https://api.example.com node scripts/smoke-live.js
 */
const http = require('http');
const https = require('https');

const base = (process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5001}`).replace(/\/$/, '');

function get(path) {
  const url = new URL(path, base + '/');
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function main() {
  console.log(`🔍 Smoke against ${base}`);
  const live = await get('/health');
  if (live.status !== 200) {
    throw new Error(`/health returned ${live.status}: ${live.body}`);
  }
  console.log('✅ /health OK');

  const ready = await get('/health/ready');
  if (ready.status !== 200) {
    throw new Error(`/health/ready returned ${ready.status}: ${ready.body}`);
  }
  console.log('✅ /health/ready OK');
  console.log('🎉 Smoke passed');
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err.message);
  process.exit(1);
});
