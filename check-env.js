// Simple script to check environment variables
require('dotenv').config();

console.log('Environment Variables Check:');
console.log('REDUCTO_API_KEY set:', !!process.env.REDUCTO_API_KEY);
console.log('REDUCTO_BASE_URL:', process.env.REDUCTO_BASE_URL);
console.log('REDUCTO_MAX_RETRIES:', process.env.REDUCTO_MAX_RETRIES);

if (process.env.REDUCTO_API_KEY) {
  console.log('API Key length:', process.env.REDUCTO_API_KEY.length);
  console.log('API Key starts with:', process.env.REDUCTO_API_KEY.substring(0, 10) + '...');
} else {
  console.log('❌ REDUCTO_API_KEY is not set!');
}