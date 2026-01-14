/**
 * Cleanup Script: Delete all clients and companies except TTS, TTS-NEW, and TCS
 * This script removes all clients and companies from the database,
 * keeping only: tts, tts-new, and tcs (case-insensitive matching)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client');
const { connectGlobalDB } = require('../config/database.config');

const companiesToKeep = ['tts', 'tts-new', 'tcs'];

const cleanup = async () => {
  let globalConn = null;
  try {
    console.log('\n🧹 Starting cleanup of clients and companies...\n');
    console.log('📋 Companies to KEEP:', companiesToKeep.join(', '));
    console.log('⚠️  All other clients and companies will be DELETED\n');
    
    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.error('💡 Make sure you have a .env file with MONGODB_URI configured');
      process.exit(1);
    }
    
    // Connect to main database for Client model
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to main database');
    
    // Connect to global database for CompanyRegistry
    globalConn = await connectGlobalDB();
    if (!globalConn) {
      console.error('❌ Failed to connect to global database');
      console.error('💡 Continuing with Client cleanup only...\n');
    } else {
      console.log('✅ Connected to global database');
    }
    
    // Get CompanyRegistry model only if connection succeeded
    let CompanyRegistry = null;
    if (globalConn) {
      const CompanyRegistrySchema = require('../models/global/CompanyRegistry');
      CompanyRegistry = globalConn.model('CompanyRegistry', CompanyRegistrySchema);
    }
    
    // Find all clients
    const allClients = await Client.find({});
    console.log(`\n📊 Found ${allClients.length} clients in database`);
    
    // Find all companies in CompanyRegistry (if connection available)
    let allCompanies = [];
    if (CompanyRegistry) {
      allCompanies = await CompanyRegistry.find({});
      console.log(`📊 Found ${allCompanies.length} companies in CompanyRegistry\n`);
    } else {
      console.log('⚠️  Skipping CompanyRegistry cleanup (connection failed)\n');
    }
    
    // Filter clients to keep (case-insensitive)
    const clientsToKeep = allClients.filter(client => {
      const companyName = (client.companyName || '').toLowerCase().trim();
      return companiesToKeep.some(keep => companyName === keep.toLowerCase());
    });
    
    // Filter companies to keep (case-insensitive)
    const companiesToKeepList = CompanyRegistry ? allCompanies.filter(company => {
      const companyName = (company.companyName || '').toLowerCase().trim();
      return companiesToKeep.some(keep => companyName === keep.toLowerCase());
    }) : [];
    
    // Calculate what will be deleted
    const clientsToDelete = allClients.length - clientsToKeep.length;
    const companiesToDelete = allCompanies.length - companiesToKeepList.length;
    
    console.log('📋 Clients to KEEP:');
    if (clientsToKeep.length > 0) {
      clientsToKeep.forEach(client => {
        console.log(`   - ${client.companyName} (${client.clientCode})`);
      });
    } else {
      console.log('   (none)');
    }
    
    console.log('\n📋 Companies to KEEP:');
    if (companiesToKeepList.length > 0) {
      companiesToKeepList.forEach(company => {
        console.log(`   - ${company.companyName} (${company.companyCode})`);
      });
    } else {
      console.log('   (none)');
    }
    
    console.log(`\n⚠️  Clients to DELETE: ${clientsToDelete}`);
    console.log(`⚠️  Companies to DELETE: ${companiesToDelete}\n`);
    
    if (clientsToDelete === 0 && companiesToDelete === 0) {
      console.log('✅ No cleanup needed. All companies match the keep list.\n');
      if (globalConn) await globalConn.close();
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Delete clients that are NOT in the keep list (using simpler approach)
    if (clientsToDelete > 0) {
      console.log('🗑️  Deleting clients...');
      const clientIdsToKeep = clientsToKeep.map(c => c._id.toString());
      
      const deleteResult = await Client.deleteMany({
        _id: { $nin: clientsToKeep.map(c => c._id) }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} clients`);
    }
    
    // Delete companies from CompanyRegistry that are NOT in the keep list
    if (companiesToDelete > 0 && CompanyRegistry) {
      console.log('🗑️  Deleting companies from CompanyRegistry...');
      
      const deleteResult = await CompanyRegistry.deleteMany({
        _id: { $nin: companiesToKeepList.map(c => c._id) }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} companies from CompanyRegistry`);
    }
    
    // Verify final state
    const remainingClients = await Client.find({});
    const remainingCompanies = CompanyRegistry ? await CompanyRegistry.find({}) : [];
    
    console.log('\n📊 Final State:');
    console.log(`   Clients remaining: ${remainingClients.length}`);
    remainingClients.forEach(client => {
      console.log(`      - ${client.companyName} (${client.clientCode})`);
    });
    
    console.log(`\n   Companies remaining: ${remainingCompanies.length}`);
    remainingCompanies.forEach(company => {
      console.log(`      - ${company.companyName} (${company.companyCode})`);
    });
    
    console.log('\n✅ Cleanup completed successfully!\n');
    
    if (globalConn) await globalConn.close();
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    if (globalConn) await globalConn.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the cleanup
cleanup();
