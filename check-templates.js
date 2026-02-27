const mongoose = require('mongoose');
const OfferTemplate = require('./src/models/OfferTemplate');
require('dotenv').config();

async function checkTemplates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const templates = await OfferTemplate.find({});
    console.log(`📄 Found ${templates.length} offer templates:`);
    
    if (templates.length === 0) {
      console.log('❌ NO TEMPLATES FOUND - This is likely the issue!');
      console.log('💡 SOLUTION: Run seed script to create offer templates');
      console.log('   Command: node seed-offer-templates.js');
    } else {
      templates.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.name} (ID: ${template._id})`);
        console.log(`      Status: ${template.status}`);
        console.log(`      Variables: ${template.content.match(/\{\{[^}]+\}\}/g)?.join(', ') || 'None'}`);
      });
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error checking templates:', error.message);
  }
}

checkTemplates();
