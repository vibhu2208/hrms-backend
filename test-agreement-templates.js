const { getTenantConnection } = require('./src/config/database.config');
const { getTenantModel } = require('./src/utils/tenantModels');
const mongoose = require('mongoose');

async function testAgreementTemplates() {
  try {
    console.log('🔍 Testing agreement templates...');
    
    // Get tenant connection
    const tenantConnection = await getTenantConnection('spc');
    console.log('✅ Connected to tenant database');
    
    // Get agreement template model
    const AgreementTemplate = getTenantModel(tenantConnection, 'AgreementTemplate');
    
    // Find all templates
    const allTemplates = await AgreementTemplate.find({});
    console.log(`📊 Total agreement templates found: ${allTemplates.length}`);
    
    if (allTemplates.length > 0) {
      allTemplates.forEach((template, index) => {
        console.log(`\n${index + 1}. Template Details:`);
        console.log(`   - Name: ${template.name}`);
        console.log(`   - ID: ${template._id}`);
        console.log(`   - Template ID: ${template.templateId}`);
        console.log(`   - Category: ${template.category}`);
        console.log(`   - Status: ${template.status}`);
        console.log(`   - Created: ${template.createdAt}`);
        console.log(`   - Variables: ${template.variables?.length || 0}`);
      });
    } else {
      console.log('❌ No agreement templates found in database');
      
      // Try to create a simple test template
      console.log('🔧 Creating a simple test template...');
      const testTemplate = new AgreementTemplate({
        name: 'Test Agreement Template',
        description: 'Simple test template',
        subject: 'Test Agreement - {{companyName}}',
        content: '<h1>Test Agreement</h1><p>This is a test for {{employeeName}}</p>',
        variables: [
          { key: 'employeeName', label: 'Employee Name', type: 'text', required: true },
          { key: 'companyName', label: 'Company Name', type: 'text', required: true }
        ],
        category: 'employment',
        status: 'active',
        isDefault: false,
        templateId: `TEST-${Date.now()}`,
        createdBy: new mongoose.Types.ObjectId(),
        updatedBy: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await testTemplate.save();
      console.log('✅ Test template created successfully');
    }
    
    // Test the model directly
    console.log('\n🧪 Testing model query...');
    const activeTemplates = await AgreementTemplate.find({ status: 'active' });
    console.log(`📊 Active templates: ${activeTemplates.length}`);
    
    await mongoose.connection.close();
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testAgreementTemplates();
