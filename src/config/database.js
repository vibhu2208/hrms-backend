const mongoose = require('mongoose');
const dns = require('dns');

// Windows/Node often fails mongodb+srv SRV lookups without this
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  /* Node < 17 */
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 — avoids querySrv ECONNREFUSED on some Windows DNS setups
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`⚠️  Server will continue running but database operations may fail.`);
    console.error(`💡 Please check your MongoDB connection string and network connectivity.`);
    // Don't exit - allow server to start even if DB connection fails
    // This allows frontend to work while DB issues are resolved
  }
};

module.exports = connectDB;
