const mongoose = require('mongoose');
const OfferTemplate = require('../models/OfferTemplate');
const Employee = require('../models/Employee');
require('dotenv').config();

const getSampleTemplate = (createdById) => ({
  name: 'Standard Full-Time Offer Letter',
  description: 'Default offer letter template for full-time positions',
  category: 'full-time',
  subject: 'Offer Letter - {{position}} at {{companyName}}',
  content: `Dear {{candidateName}},

We are delighted to extend an offer of employment to you for the position of {{position}} at {{companyName}}.

POSITION DETAILS:
- Position: {{position}}
- Department: {{department}}
- Annual CTC: ₹{{offeredCTC}}
- Start Date: {{startDate}}

COMPENSATION BREAKDOWN:
Your total annual compensation of ₹{{offeredCTC}} includes:
- Basic Salary
- House Rent Allowance (HRA)
- Special Allowances
- Performance Bonus (as applicable)
- Other benefits as per company policy

EMPLOYMENT TERMS:
1. This is a full-time position
2. You will report to the respective department head
3. Standard working hours: Monday to Friday, 9:00 AM to 6:00 PM
4. Probation period: 3 months from the date of joining
5. Notice period: As per company policy

BENEFITS:
- Health Insurance for self and family
- Paid Time Off (PTO) as per company policy
- Professional development opportunities
- Other benefits as outlined in the employee handbook

JOINING FORMALITIES:
Please bring the following documents on your first day:
- Educational certificates and mark sheets
- Previous employment documents (if applicable)
- Identity proof (Aadhar, PAN, Passport)
- Address proof
- Passport size photographs
- Bank account details for salary transfer

OFFER ACCEPTANCE:
This offer is valid for 7 days from the date of this letter. Please confirm your acceptance by clicking the acceptance link sent to your email.

We are excited to have you join our team and look forward to a mutually beneficial association.

If you have any questions, please feel free to contact us at {{hrEmail}} or {{hrPhone}}.

Best Regards,
{{hrName}}
HR Department
{{companyName}}

---
This is a system-generated offer letter. Please do not reply to this email.`,
  
  variables: [
    { key: 'candidateName', label: 'Candidate Name', type: 'text', required: true },
    { key: 'candidateEmail', label: 'Candidate Email', type: 'text', required: true },
    { key: 'position', label: 'Position', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: false },
    { key: 'offeredCTC', label: 'Offered CTC', type: 'currency', required: true },
    { key: 'startDate', label: 'Start Date', type: 'date', required: false },
    { key: 'joiningDate', label: 'Joining Date', type: 'date', required: false },
    { key: 'companyName', label: 'Company Name', type: 'text', required: false },
    { key: 'hrName', label: 'HR Name', type: 'text', required: false },
    { key: 'hrEmail', label: 'HR Email', type: 'text', required: false },
    { key: 'hrPhone', label: 'HR Phone', type: 'text', required: false }
  ],
  
  status: 'active',
  isDefault: true,
  usageCount: 0,
  createdBy: createdById,
  settings: {
    autoExpiry: {
      enabled: true,
      hours: 168 // 7 days
    },
    reminders: {
      enabled: true,
      schedule: [
        { hours: 72, message: 'Reminder: Your offer expires in 3 days' },
        { hours: 24, message: 'Reminder: Your offer expires in 1 day' }
      ]
    },
    requireESignature: false,
    allowCounterOffer: false
  }
});

async function seedTemplate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');

    // Get first employee as creator (or create a system user)
    let creator = await Employee.findOne();
    if (!creator) {
      console.log('⚠️  No employees found. Template will be created without a creator reference.');
      console.log('   Please create an employee first or the template creation will fail.');
      process.exit(1);
    }

    console.log(`Using employee: ${creator.name} (${creator.employeeId}) as creator`);

    const sampleTemplate = getSampleTemplate(creator._id);

    // Check if template already exists
    const existingTemplate = await OfferTemplate.findOne({ 
      name: sampleTemplate.name 
    });

    if (existingTemplate) {
      console.log('Template already exists. Updating...');
      await OfferTemplate.findByIdAndUpdate(existingTemplate._id, sampleTemplate);
      console.log('✅ Template updated successfully!');
    } else {
      console.log('Creating new template...');
      await OfferTemplate.create(sampleTemplate);
      console.log('✅ Template created successfully!');
    }

    // Display template info
    const template = await OfferTemplate.findOne({ name: sampleTemplate.name });
    console.log('\n📄 Template Details:');
    console.log(`   ID: ${template._id}`);
    console.log(`   Template ID: ${template.templateId}`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Category: ${template.category}`);
    console.log(`   Status: ${template.status}`);
    console.log(`   Is Default: ${template.isDefault}`);
    console.log(`   Variables: ${template.variables.length}`);
    console.log(`   Created By: ${creator.name}`);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding template:', error);
    process.exit(1);
  }
}

// Run the seed function
seedTemplate();
