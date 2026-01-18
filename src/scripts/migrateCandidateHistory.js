/**
 * Migration Script: Populate applicationHistory for existing candidates
 * 
 * This script:
 * 1. Adds required indexes to Candidate model
 * 2. Populates applicationHistory for existing candidates
 * 3. Links candidates with same email/phone via masterCandidateId
 * 
 * Usage: node src/scripts/migrateCandidateHistory.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Candidate Schema (simplified for migration)
const candidateSchema = new mongoose.Schema({
  candidateCode: String,
  firstName: String,
  lastName: String,
  email: { type: String, lowercase: true },
  phone: String,
  alternatePhone: String,
  appliedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
  stage: String,
  status: String,
  timeline: Array,
  interviews: Array,
  masterCandidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  applicationHistory: [{
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
    jobTitle: String,
    appliedDate: Date,
    stage: String,
    status: String,
    outcome: String,
    interviews: Array,
    onboardingRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding' },
    offboardingRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'Offboarding' }
  }],
  createdAt: Date
}, { strict: false });

// Helper function to normalize phone
const normalizePhone = (phone) => {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
};

async function migrateCandidateHistory() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all tenant databases or use default
    const db = mongoose.connection.db;
    const adminDb = db.admin();
    const databases = await adminDb.listDatabases();
    
    const candidateDatabases = databases.databases
      .filter(db => db.name !== 'admin' && db.name !== 'local' && db.name !== 'config')
      .map(db => db.name);

    console.log(`📊 Found ${candidateDatabases.length} databases to process\n`);

    for (const dbName of candidateDatabases) {
      try {
        console.log(`\n📦 Processing database: ${dbName}`);
        const tenantDb = mongoose.connection.useDb(dbName);
        const Candidate = tenantDb.model('Candidate', candidateSchema);

        // Create indexes
        console.log('  📇 Creating indexes...');
        await Candidate.collection.createIndex({ email: 1 });
        await Candidate.collection.createIndex({ phone: 1 });
        await Candidate.collection.createIndex({ email: 1, phone: 1 });
        await Candidate.collection.createIndex({ isDuplicate: 1 });
        await Candidate.collection.createIndex({ duplicateOf: 1 });
        await Candidate.collection.createIndex({ masterCandidateId: 1 });
        console.log('  ✅ Indexes created');

        // Get all candidates
        const candidates = await Candidate.find({}).populate('appliedFor', 'title');
        console.log(`  📋 Found ${candidates.length} candidates`);

        // Group candidates by email/phone
        const candidateGroups = new Map();
        
        for (const candidate of candidates) {
          const normalizedEmail = candidate.email?.toLowerCase().trim();
          const normalizedPhone = normalizePhone(candidate.phone);
          const key = `${normalizedEmail || ''}_${normalizedPhone || ''}`;
          
          if (!candidateGroups.has(key)) {
            candidateGroups.set(key, []);
          }
          candidateGroups.get(key).push(candidate);
        }

        console.log(`  🔗 Found ${candidateGroups.size} unique candidate groups`);

        let updated = 0;
        let linked = 0;

        // Process each group
        for (const [key, group] of candidateGroups.entries()) {
          if (group.length === 0) continue;

          // Sort by creation date to find master (first application)
          group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          const masterCandidate = group[0];

          // Update master candidate
          if (!masterCandidate.applicationHistory || masterCandidate.applicationHistory.length === 0) {
            masterCandidate.applicationHistory = [{
              jobId: masterCandidate.appliedFor?._id || masterCandidate.appliedFor,
              jobTitle: masterCandidate.appliedFor?.title || 'N/A',
              appliedDate: masterCandidate.createdAt,
              stage: masterCandidate.stage,
              status: masterCandidate.status,
              outcome: null,
              interviews: masterCandidate.interviews || []
            }];
            await masterCandidate.save();
            updated++;
          }

          // Link and update other candidates in the group
          for (let i = 1; i < group.length; i++) {
            const candidate = group[i];
            
            // Link to master
            if (!candidate.masterCandidateId) {
              candidate.masterCandidateId = masterCandidate._id;
              linked++;
            }

            // Add to application history
            if (!candidate.applicationHistory || candidate.applicationHistory.length === 0) {
              candidate.applicationHistory = [{
                jobId: candidate.appliedFor?._id || candidate.appliedFor,
                jobTitle: candidate.appliedFor?.title || 'N/A',
                appliedDate: candidate.createdAt,
                stage: candidate.stage,
                status: candidate.status,
                outcome: null,
                interviews: candidate.interviews || []
              }];
            }

            // Also add to master's history if not already there
            const jobId = candidate.appliedFor?._id || candidate.appliedFor;
            const existsInMaster = masterCandidate.applicationHistory.some(
              entry => entry.jobId?.toString() === jobId?.toString()
            );

            if (!existsInMaster) {
              masterCandidate.applicationHistory.push({
                jobId: jobId,
                jobTitle: candidate.appliedFor?.title || 'N/A',
                appliedDate: candidate.createdAt,
                stage: candidate.stage,
                status: candidate.status,
                outcome: null,
                interviews: candidate.interviews || []
              });
            }

            await candidate.save();
            updated++;
          }

          // Save master with updated history
          await masterCandidate.save();
        }

        console.log(`  ✅ Updated ${updated} candidates, linked ${linked} candidates to masters`);
      } catch (error) {
        console.error(`  ❌ Error processing database ${dbName}:`, error.message);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCandidateHistory();
