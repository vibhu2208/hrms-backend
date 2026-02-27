const mongoose = require('mongoose');
const OfferTemplate = require('./src/models/OfferTemplate');
require('dotenv').config();

async function seedOfferTemplates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Check if templates already exist
    const existingTemplates = await OfferTemplate.countDocuments();
    if (existingTemplates > 0) {
      console.log(`📄 ${existingTemplates} templates already exist. Skipping seed.`);
      await mongoose.connection.close();
      return;
    }

    // Create offer templates
    const templates = [
      {
        name: 'Employee Offer Letter',
        subject: 'Offer Letter - {{position}} at {{companyName}}',
        content: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .offer-details { background: #f8f9fa; padding: 15px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Offer Letter</h2>
    </div>
    <div class="content">
        <p>Dear <strong>{{candidateName}}</strong>,</p>
        <p>We are pleased to offer you the position of <strong>{{position}}</strong> at <strong>{{companyName}}</strong>.</p>
        
        <div class="offer-details">
            <h3>Offer Details:</h3>
            <p><strong>Project Name:</strong> {{projectName}}</p>
            <p><strong>Client Organization:</strong> {{clientName}}</p>
            <p><strong>Work Location:</strong> {{location}}</p>
            <p><strong>Contract Period:</strong> {{contractStartDate}} to {{contractEndDate}}</p>
            <p><strong>Monthly Salary:</strong> Rs. {{monthlySalary}}/-</p>
        </div>
        
        <p>Please review this offer and confirm your acceptance within 3 days.</p>
        <p>We look forward to welcoming you to our team!</p>
        
        <p>Best regards,<br>
        <strong>{{hrName}}</strong><br>
        {{hrDesignation}}<br>
        {{companyName}}</p>
    </div>
    <div class="footer">
        <p>&copy; {{currentDate}} {{companyName}}. All rights reserved.</p>
    </div>
</body>
</html>
        `,
        status: 'active',
        isDefault: true,
        version: '1.0'
      },
      {
        name: 'Consultancy Offer Letter',
        subject: 'Consultancy Offer - {{projectName}} at {{clientName}}',
        content: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .project-info { background: #ecf0f1; padding: 15px; margin: 20px 0; border-left: 4px solid #3498db; }
        .footer { background: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Consultancy Offer Letter</h2>
        <p>Project: {{projectName}}</p>
    </div>
    <div class="content">
        <p>Dear <strong>{{candidateName}}</strong>,</p>
        <p>We are delighted to offer you a consultancy position for the <strong>{{projectName}}</strong> project.</p>
        
        <div class="project-info">
            <h3>Project Details:</h3>
            <p><strong>Project Name:</strong> {{projectName}}</p>
            <p><strong>Client Organization:</strong> {{clientName}}</p>
            <p><strong>Work Location:</strong> {{location}}</p>
            <p><strong>Position:</strong> {{position}}</p>
            <p><strong>Contract Period:</strong> {{contractStartDate}} to {{contractEndDate}}</p>
            <p><strong>Monthly Consultancy Fee:</strong> Rs. {{monthlySalary}}/-</p>
            <p><strong>Basic:</strong> Rs. {{basic}}/-</p>
            <p><strong>HRA:</strong> Rs. {{hra}}/-</p>
        </div>
        
        <p>This consultancy offer is subject to the terms and conditions outlined in the attached agreement.</p>
        <p>Please confirm your acceptance by {{expiryDate}}.</p>
        
        <p>Best regards,<br>
        <strong>{{hrName}}</strong><br>
        {{hrDesignation}}<br>
        {{companyName}}</p>
    </div>
    <div class="footer">
        <p>&copy; {{currentDate}} {{companyName}}. All rights reserved.</p>
    </div>
</body>
</html>
        `,
        status: 'active',
        isDefault: false,
        version: '1.0'
      }
    ];

    await OfferTemplate.insertMany(templates);
    console.log(`✅ Created ${templates.length} offer templates successfully!`);
    
    // Verify creation
    const count = await OfferTemplate.countDocuments();
    console.log(`📄 Total templates in database: ${count}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error seeding templates:', error.message);
  }
}

seedOfferTemplates();
