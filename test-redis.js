const redis = require('redis');
require('dotenv').config();

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...\n');
  
  // Get Redis URL from environment or use default
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`📍 Redis URL: ${redisUrl}`);
  
  const client = redis.createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 5000,
    }
  });

  try {
    // Connect to Redis
    await client.connect();
    console.log('✅ Redis connected successfully!\n');
    
    // Test basic operations
    console.log('🧪 Testing Redis operations...');
    
    // Test PING
    const pingResult = await client.ping();
    console.log(`   PING → ${pingResult}`);
    
    // Test SET/GET
    await client.set('test:hrms', 'Redis is working! 🚀');
    const getValue = await client.get('test:hrms');
    console.log(`   SET/GET → ${getValue}`);
    
    // Test token blacklisting simulation
    const testToken = 'test_jwt_token_12345';
    await client.setEx(`blacklist:${testToken}`, 60, 'revoked');
    const isBlacklisted = await client.get(`blacklist:${testToken}`);
    console.log(`   Token Blacklist Test → ${isBlacklisted}`);
    
    // Test user blacklist simulation
    const testUserId = 'user_12345';
    await client.setEx(`user_revoked:${testUserId}`, 86400, new Date().toISOString());
    const isUserBlacklisted = await client.get(`user_revoked:${testUserId}`);
    console.log(`   User Blacklist Test → ${isUserBlacklisted}`);
    
    // Clean up test data
    await client.del('test:hrms');
    await client.del(`blacklist:${testToken}`);
    await client.del(`user_revoked:${testUserId}`);
    
    console.log('\n✅ All Redis tests passed!');
    console.log('🎉 Redis is ready for HRMS token blacklisting!');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Make sure Redis server is running');
    console.log('   2. Check if REDIS_URL in .env is correct');
    console.log('   3. Verify Redis is accessible on the specified port');
    console.log('   4. For Windows: Try Docker Redis if native installation fails');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused fix:');
      console.log('   - Start Redis service: net start redis');
      console.log('   - Or use Docker: docker run -d -p 6379:6379 redis:latest');
    }
    
    if (error.code === 'ECONNRESET' || error.message.includes('closed')) {
      console.log('\n💡 Connection reset fix:');
      console.log('   - Check Redis server status');
      console.log('   - Verify firewall settings');
    }
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

// Run the test
testRedisConnection();
