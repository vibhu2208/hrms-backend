// Test auto-population from resume data
const candidateController = require('./src/controllers/candidateController');

// Mock tenant connection and model
const mockTenantConnection = {
  models: {},
  model: function(name, schema) {
    this.models[name] = { schema };
    return {
      create: async (data) => ({
        ...data,
        _id: 'mock_candidate_id_' + Date.now(),
        constructor: {
          findByIdAndUpdate: async (id, update, options) => ({ ...data, ...update.$set, _id: id })
        }
      })
    };
  }
};

// Mock request object
const mockReq = {
  tenant: { connection: mockTenantConnection },
  body: {
    firstName: 'John',
    lastName: 'Doe',
    // Intentionally leaving out skills, experience, location
    email: 'john.doe@example.com',
    phone: '+91-9876543210',
    resumeParsing: {
      extractedData: {
        skills: ['java', 'spring', 'hibernate', 'javascript', 'react'],
        experienceYears: 3,
        experienceMonths: 6,
        currentLocation: 'Noida, Uttar Pradesh',
        currentCompany: 'Tech Solutions Pvt Ltd',
        currentDesignation: 'Senior Java Developer',
        currentCTC: 1200000,
        expectedCTC: 1500000,
        preferredLocation: ['Delhi', 'Gurgaon', 'Noida']
      }
    }
  }
};

async function testAutoPopulation() {
  console.log('🧪 Testing auto-population from resume data...');

  try {
    console.log('📝 Creating candidate with partial data:');
    console.log('- Name: John Doe');
    console.log('- Email/Phone: Provided');
    console.log('- Skills: MISSING (should be auto-populated)');
    console.log('- Experience: MISSING (should be auto-populated)');
    console.log('- Location: MISSING (should be auto-populated)');

    // Test the populateCandidateFromResumeData function directly
    const mockCandidate = {
      _id: 'test_candidate_id',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+91-9876543210'
      // Missing: skills, experience, currentLocation, etc.
    };

    const extractedData = mockReq.body.resumeParsing.extractedData;

    console.log('\n🤖 Resume parsing data available:');
    console.log('- Skills:', extractedData.skills);
    console.log('- Experience:', `${extractedData.experienceYears} years, ${extractedData.experienceMonths} months`);
    console.log('- Location:', extractedData.currentLocation);
    console.log('- Company:', extractedData.currentCompany);
    console.log('- Designation:', extractedData.currentDesignation);

    // Test the auto-population function
    const populatedCandidate = await candidateController.populateCandidateFromResumeData(mockCandidate, extractedData);

    console.log('\n✅ Auto-population results:');
    console.log('- Skills:', populatedCandidate.skills || 'NOT POPULATED');
    console.log('- Experience:', populatedCandidate.experience ? `${populatedCandidate.experience.years}y ${populatedCandidate.experience.months}m` : 'NOT POPULATED');
    console.log('- Current Location:', populatedCandidate.currentLocation || 'NOT POPULATED');
    console.log('- Company:', populatedCandidate.currentCompany || 'NOT POPULATED');
    console.log('- Designation:', populatedCandidate.currentDesignation || 'NOT POPULATED');
    console.log('- Current CTC:', populatedCandidate.currentCTC || 'NOT POPULATED');

    if (populatedCandidate.skills && populatedCandidate.experience && populatedCandidate.currentLocation) {
      console.log('\n🎉 SUCCESS: All missing fields were auto-populated from resume data!');
    } else {
      console.log('\n⚠️ PARTIAL: Some fields were not populated');
    }

  } catch (error) {
    console.error('❌ Auto-population test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAutoPopulation();