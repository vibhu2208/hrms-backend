/**
 * Database Configuration for Multi-Tenant HRMS
 * 
 * Architecture:
 * 1. hrms_global - Main database for super admin, companies registry
 * 2. tenant_{companyId} - One database per company with all collections
 */

const mongoose = require('mongoose');

// Global database connection (for super admin and company registry)
let globalConnection = null;

// Cache for tenant connections
const tenantConnections = new Map();

/**
 * Connect to Global Database (hrms_global)
 */
const connectGlobalDB = async () => {
  try {
    if (globalConnection && globalConnection.readyState === 1) {
      return globalConnection;
    }

    // Extract base URI and append database name
    const baseUri = process.env.MONGODB_URI.split('?')[0]; // Remove query params
    const queryParams = process.env.MONGODB_URI.split('?')[1] || 'retryWrites=true&w=majority';
    
    // Remove any existing database name and add hrms_global
    const uriWithoutDb = baseUri.replace(/\/[^/]*$/, '');
    const globalDbUri = `${uriWithoutDb}/hrms_global?${queryParams}`;
    
    console.log('🔗 Connecting to:', globalDbUri.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    globalConnection = await mongoose.createConnection(globalDbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000, // Increased timeout
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });

    // Wait for connection to be ready before returning
    await new Promise((resolve, reject) => {
      if (globalConnection.readyState === 1) {
        resolve();
      } else {
        globalConnection.once('open', resolve);
        globalConnection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      }
    });

    console.log('✅ Connected to Global Database (hrms_global)');
    return globalConnection;
  } catch (error) {
    console.error('❌ Global DB Connection Error:', error.message);
    console.error('💡 Troubleshooting:');
    console.error('   1. Check if MongoDB Atlas cluster is running');
    console.error('   2. Verify network access (IP whitelist)');
    console.error('   3. Check if credentials are correct');
    console.error('   4. Try accessing from MongoDB Compass');
    throw new Error(`Failed to connect to global database: ${error.message}`);
  }
};

/**
 * Get or Create Tenant Database Connection
 * @param {string} companyIdOrDbName - Company ID or full database name (e.g., 'tenant_xxx')
 * @returns {Connection} Mongoose connection to tenant database
 */
const getTenantConnection = async (companyIdOrDbName) => {
  try {
    // Determine the actual database name
    // If it already starts with 'tenant_', use it as-is
    // Otherwise, add the 'tenant_' prefix
    const tenantDbName = companyIdOrDbName.startsWith('tenant_') 
      ? companyIdOrDbName 
      : `tenant_${companyIdOrDbName}`;
    
    // Check if connection already exists and is active
    if (tenantConnections.has(tenantDbName)) {
      const connection = tenantConnections.get(tenantDbName);
      if (connection.readyState === 1) {
        return connection;
      }
      // If connection is dead, remove it
      tenantConnections.delete(tenantDbName);
    }
    
    const baseUri = process.env.MONGODB_URI.split('?')[0];
    const queryParams = process.env.MONGODB_URI.split('?')[1] || 'retryWrites=true&w=majority';
    const uriWithoutDb = baseUri.replace(/\/[^/]*$/, '');
    const tenantDbUri = `${uriWithoutDb}/${tenantDbName}?${queryParams}`;

    const connection = await mongoose.createConnection(tenantDbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });

    // Wait for connection to be ready before returning
    await new Promise((resolve, reject) => {
      if (connection.readyState === 1) {
        resolve();
      } else {
        connection.once('open', resolve);
        connection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      }
    });

    // Cache the connection using the database name as key
    tenantConnections.set(tenantDbName, connection);
    
    console.log(`✅ Connected to Tenant Database: ${tenantDbName}`);
    return connection;
  } catch (error) {
    console.error(`❌ Tenant DB Connection Error for ${companyIdOrDbName}:`, error);
    throw error;
  }
};

/**
 * Close a specific tenant connection
 * @param {string} companyId - Company ID
 */
const closeTenantConnection = async (companyId) => {
  const tenantDbName = companyId.startsWith('tenant_') ? companyId : `tenant_${companyId}`;
  
  if (tenantConnections.has(tenantDbName)) {
    const connection = tenantConnections.get(tenantDbName);
    if (connection.readyState === 1) {
      await connection.close();
      console.log(`🔌 Closed tenant connection: ${tenantDbName}`);
    }
    tenantConnections.delete(tenantDbName);
  }
};

/**
 * Close all tenant connections
 */
const closeAllTenantConnections = async () => {
  const closePromises = [];
  for (const [tenantDbName, connection] of tenantConnections.entries()) {
    if (connection.readyState === 1) {
      closePromises.push(connection.close());
    }
  }
  
  try {
    await Promise.all(closePromises);
    tenantConnections.clear();
    console.log('🔌 All tenant connections closed');
  } catch (error) {
    console.error('⚠️  Error closing tenant connections:', error);
    tenantConnections.clear(); // Clear cache even if some connections fail to close
  }
};

/**
 * Close global connection
 */
const closeGlobalConnection = async () => {
  if (globalConnection && globalConnection.readyState === 1) {
    await globalConnection.close();
    globalConnection = null;
    console.log('🔌 Closed global connection');
  }
};

/**
 * Get Global Connection (lazy load)
 */
const getGlobalConnection = async () => {
  if (!globalConnection || globalConnection.readyState !== 1) {
    return await connectGlobalDB();
  }
  return globalConnection;
};

/**
 * Initialize Tenant Database with all required collections
 * @param {string} companyId - Company ID
 */
const initializeTenantDatabase = async (companyId) => {
  try {
    const connection = await getTenantConnection(companyId);
    
    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      if (connection.readyState === 1) {
        resolve();
      } else {
        connection.once('open', resolve);
        connection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      }
    });
    
    // Define all collections that should exist in tenant DB
    const collections = [
      'users',
      'departments',
      'designations',
      'attendance',
      'leave_requests',
      'payroll',
      'roles',
      'permissions',
      'recruitment',
      'onboarding',
      'projects',
      'assets',
      'notifications',
      'timesheets',
      'activity_logs',
      'settings',
      'theme'
    ];

    // Create collections if they don't exist
    const existingCollections = await connection.db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    for (const collectionName of collections) {
      if (!existingNames.includes(collectionName)) {
        await connection.db.createCollection(collectionName);
        console.log(`  ✓ Created collection: ${collectionName}`);
      }
    }

    console.log(`✅ Initialized tenant database: tenant_${companyId}`);
    return connection;
  } catch (error) {
    console.error(`❌ Error initializing tenant database for ${companyId}:`, error);
    throw error;
  }
};

module.exports = {
  connectGlobalDB,
  getTenantConnection,
  closeTenantConnection,
  closeAllTenantConnections,
  closeGlobalConnection,
  getGlobalConnection,
  initializeTenantDatabase
};
