const redis = require('redis');
require('dotenv').config();

class RedisMonitor {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to Redis for monitoring\n');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message);
      process.exit(1);
    }
  }

  async getServerInfo() {
    try {
      const info = await this.client.info('server');
      console.log('🖥️  REDIS SERVER INFO:');
      console.log('=====================');
      
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('redis_version')) {
          console.log(`Version: ${line.split(':')[1]}`);
        }
        if (line.startsWith('uptime_in_seconds')) {
          const uptime = line.split(':')[1];
          console.log(`Uptime: ${uptime} seconds (${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m)`);
        }
        if (line.startsWith('connected_clients')) {
          console.log(`Connected Clients: ${line.split(':')[1]}`);
        }
        if (line.startsWith('process_id')) {
          console.log(`Process ID: ${line.split(':')[1]}`);
        }
      });
      console.log('');
    } catch (error) {
      console.error('❌ Error getting server info:', error.message);
    }
  }

  async getMemoryInfo() {
    try {
      const info = await this.client.info('memory');
      console.log('💾 MEMORY USAGE:');
      console.log('================');
      
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('used_memory_human')) {
          console.log(`Used Memory: ${line.split(':')[1]}`);
        }
        if (line.startsWith('used_memory_peak_human')) {
          console.log(`Peak Memory: ${line.split(':')[1]}`);
        }
        if (line.startsWith('maxmemory_policy')) {
          console.log(`Memory Policy: ${line.split(':')[1]}`);
        }
        if (line.startsWith('mem_fragmentation_ratio')) {
          console.log(`Fragmentation Ratio: ${line.split(':')[1]}`);
        }
      });
      console.log('');
    } catch (error) {
      console.error('❌ Error getting memory info:', error.message);
    }
  }

  async getStats() {
    try {
      const info = await this.client.info('stats');
      console.log('📊 PERFORMANCE STATS:');
      console.log('====================');
      
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('total_connections_received')) {
          console.log(`Total Connections: ${line.split(':')[1]}`);
        }
        if (line.startsWith('total_commands_processed')) {
          console.log(`Total Commands: ${line.split(':')[1]}`);
        }
        if (line.startsWith('instantaneous_ops_per_sec')) {
          console.log(`Operations/sec: ${line.split(':')[1]}`);
        }
        if (line.startsWith('keyspace_hits')) {
          console.log(`Cache Hits: ${line.split(':')[1]}`);
        }
        if (line.startsWith('keyspace_misses')) {
          console.log(`Cache Misses: ${line.split(':')[1]}`);
        }
        if (line.startsWith('expired_keys')) {
          console.log(`Expired Keys: ${line.split(':')[1]}`);
        }
        if (line.startsWith('evicted_keys')) {
          console.log(`Evicted Keys: ${line.split(':')[1]}`);
        }
        if (line.startsWith('rejected_connections')) {
          console.log(`Rejected Connections: ${line.split(':')[1]}`);
        }
      });
      console.log('');
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
    }
  }

  async getKeyspaceInfo() {
    try {
      const info = await this.client.info('keyspace');
      console.log('🔑 KEYSPACE INFO:');
      console.log('=================');
      
      const lines = info.split('\r\n');
      lines.forEach(line => {
        if (line.startsWith('db')) {
          const parts = line.split(':');
          const dbName = parts[0];
          const stats = parts[1];
          console.log(`${dbName}: ${stats}`);
        }
      });
      console.log('');
    } catch (error) {
      console.error('❌ Error getting keyspace info:', error.message);
    }
  }

  async getBlacklistedTokens() {
    try {
      const keys = await this.client.keys('blacklist:*');
      console.log('🚫 BLACKLISTED TOKENS:');
      console.log('=====================');
      console.log(`Total blacklisted tokens: ${keys.length}`);
      
      if (keys.length > 0) {
        console.log('Recent blacklisted tokens:');
        const sampleKeys = keys.slice(0, 5);
        for (const key of sampleKeys) {
          const ttl = await this.client.ttl(key);
          const value = await this.client.get(key);
          console.log(`  ${key}: ${value} (TTL: ${ttl}s)`);
        }
        if (keys.length > 5) {
          console.log(`  ... and ${keys.length - 5} more`);
        }
      }
      console.log('');
    } catch (error) {
      console.error('❌ Error getting blacklisted tokens:', error.message);
    }
  }

  async getRevokedUsers() {
    try {
      const keys = await this.client.keys('user_revoked:*');
      console.log('👤 REVOKED USERS:');
      console.log('=================');
      console.log(`Total revoked users: ${keys.length}`);
      
      if (keys.length > 0) {
        console.log('Revoked users:');
        const sampleKeys = keys.slice(0, 5);
        for (const key of sampleKeys) {
          const ttl = await this.client.ttl(key);
          const value = await this.client.get(key);
          console.log(`  ${key}: ${value} (TTL: ${ttl}s)`);
        }
        if (keys.length > 5) {
          console.log(`  ... and ${keys.length - 5} more`);
        }
      }
      console.log('');
    } catch (error) {
      console.error('❌ Error getting revoked users:', error.message);
    }
  }

  async monitorRealtime() {
    console.log('🔍 REAL-TIME MONITORING (Press Ctrl+C to stop):');
    console.log('================================================');
    
    let commandCount = 0;
    const monitorInterval = setInterval(async () => {
      try {
        const stats = await this.client.info('stats');
        const lines = stats.split('\r\n');
        const opsPerSec = lines.find(line => line.startsWith('instantaneous_ops_per_sec'))?.split(':')[1] || '0';
        const totalCommands = lines.find(line => line.startsWith('total_commands_processed'))?.split(':')[1] || '0';
        
        if (totalCommands !== commandCount) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] Ops/sec: ${opsPerSec}, Total Commands: ${totalCommands}`);
          commandCount = totalCommands;
        }
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    }, 2000);

    process.on('SIGINT', () => {
      clearInterval(monitorInterval);
      console.log('\n✅ Monitoring stopped');
      this.disconnect();
      process.exit(0);
    });
  }

  async disconnect() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

async function main() {
  const monitor = new RedisMonitor();
  await monitor.connect();

  const command = process.argv[2] || 'full';

  switch (command) {
    case 'server':
      await monitor.getServerInfo();
      break;
    case 'memory':
      await monitor.getMemoryInfo();
      break;
    case 'stats':
      await monitor.getStats();
      break;
    case 'keyspace':
      await monitor.getKeyspaceInfo();
      break;
    case 'blacklist':
      await monitor.getBlacklistedTokens();
      break;
    case 'users':
      await monitor.getRevokedUsers();
      break;
    case 'monitor':
      await monitor.monitorRealtime();
      return; // Don't disconnect in monitor mode
    case 'full':
    default:
      await monitor.getServerInfo();
      await monitor.getMemoryInfo();
      await monitor.getStats();
      await monitor.getKeyspaceInfo();
      await monitor.getBlacklistedTokens();
      await monitor.getRevokedUsers();
      break;
  }

  await monitor.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RedisMonitor;
