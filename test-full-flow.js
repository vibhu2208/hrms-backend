// Test the exact sendOffer controller flow
require('dotenv').config();
const mongoose = require('mongoose');
const { sendOfferLetterWithTemplate } = require('./src/services/emailService');

async function testFullSendOfferFlow() {
  try {
    console.log('🧪 Testing Full Send Offer Flow...');
    
    // Connect to database first
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');
    
    // Simulate the exact data structure from sendOffer controller
    const templateId = '699f8e893d0bf98447d1b188'; // Consultancy Offer Letter
    const candidate = {
      firstName: 'Test',
      lastName: 'Candidate',
      email: 'test@example.com'
    };
    const onboarding = {
      position: 'Lab Technician'
    };
    
    const annualCTC = 480000;
    const employmentStartDate = '2025-12-31';
    const contractEndDate = '2026-12-31';
    const clientName = 'International Agency';
    const location = 'Patna (AIIMS)';
    const projectName = 'Typhoid Fever Surveillance Project';
    const monthlySalary = '40000';
    
    // Prepare offer details exactly as in controller
    const templateOfferDetails = {
      clientName: clientName,
      location: location,
      projectName: projectName,
      joiningDate: new Date(employmentStartDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      contractStartDate: new Date(employmentStartDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      contractEndDate: new Date(contractEndDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      monthlySalary: monthlySalary,
      basic: 24000,
      hra: 16000,
      allowances: 0,
      benefits: 'Standard benefits package',
      contractExtensionInfo: 'Contract extension terms to be discussed',
      hrName: 'Raj Kumar',
      hrDesignation: 'HR Manager',
      expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      currentDate: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };

    console.log('📤 Calling sendOfferLetterWithTemplate with controller data...');
    console.log('🎯 Project Name:', templateOfferDetails.projectName);
    
    const emailResult = await sendOfferLetterWithTemplate({
      templateId: templateId,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      candidateEmail: candidate.email,
      position: onboarding.position,
      designation: onboarding.position,
      ctc: annualCTC,
      joiningDate: new Date(employmentStartDate),
      offerDetails: templateOfferDetails,
      companyName: process.env.COMPANY_NAME || 'SPC Management Services PVT Ltd.'
    });
    
    console.log('✅ SUCCESS: Full flow working!');
    console.log('📧 Email result:', emailResult);
    
  } catch (error) {
    console.error('❌ Full flow test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

testFullSendOfferFlow();
