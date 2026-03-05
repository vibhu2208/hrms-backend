const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const AgreementTemplate = require('./src/models/AgreementTemplate');
const Employee = require('./src/models/Employee');

const defaultAgreementTemplates = [
  {
    name: 'Employment Agreement - Full Time',
    description: 'Standard employment agreement for full-time employees with benefits and standard terms',
    category: 'employment',
    subject: 'Employment Agreement - {{companyName}}',
    content: `
EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is made and entered into on {{effectiveDate}} ("Effective Date") by and between:

{{companyName}}, a company organized and existing under the laws of {{jurisdiction}}, with its principal place of business at {{companyAddress}} (hereinafter referred to as the "Company"),

AND

{{employeeName}}, residing at {{employeeAddress}} (hereinafter referred to as the "Employee").

1. POSITION AND DUTIES
The Company agrees to employ the Employee as {{designation}} in the {{department}} department. The Employee shall perform such duties and responsibilities as may be assigned by the Company from time to time.

2. COMPENSATION
The Employee shall receive a gross annual salary of {{annualSalary}} {{currency}}, payable in accordance with the Company's standard payroll schedule.

3. BENEFITS
The Employee shall be entitled to participate in such benefit plans as the Company may make available to its employees, including but not limited to health insurance, retirement plans, and paid time off.

4. TERM OF EMPLOYMENT
This Agreement shall commence on {{startDate}} and shall continue until terminated in accordance with the provisions herein.

5. TERMINATION
Either party may terminate this employment relationship at any time, with or without cause, by providing {{noticePeriod}} written notice to the other party.

6. CONFIDENTIALITY
The Employee agrees to maintain the confidentiality of all proprietary information and trade secrets of the Company.

7. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of {{jurisdiction}}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

_________________________
{{companyName}}

_________________________
{{employeeName}}
    `,
    variables: [
      { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
      { key: 'employeeAddress', label: 'Employee Address', type: 'text', required: true },
      { key: 'designation', label: 'Job Title/Designation', type: 'text', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'annualSalary', label: 'Annual Salary', type: 'currency', required: true },
      { key: 'currency', label: 'Currency', type: 'text', required: false, defaultValue: 'USD' },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'effectiveDate', label: 'Agreement Effective Date', type: 'date', required: true },
      { key: 'companyName', label: 'Company Name', type: 'text', required: true },
      { key: 'companyAddress', label: 'Company Address', type: 'text', required: true },
      { key: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'State' },
      { key: 'noticePeriod', label: 'Notice Period', type: 'text', required: false, defaultValue: '30 days' }
    ],
    status: 'active',
    isDefault: true,
    legalReviewed: true,
    settings: {
      requireESignature: true,
      allowDigitalSignature: true,
      autoExpiry: { enabled: false }
    },
    agreementSettings: {
      effectiveDate: 'joining-date',
      duration: 'permanent',
      renewalRequired: false
    },
    tags: ['full-time', 'standard', 'benefits']
  },
  {
    name: 'Non-Disclosure Agreement',
    description: 'Confidentiality agreement to protect company proprietary information',
    category: 'confidentiality',
    subject: 'Non-Disclosure Agreement - {{companyName}}',
    content: `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{effectiveDate}} between:

{{companyName}} ("Disclosing Party")
AND
{{employeeName}} ("Receiving Party")

1. CONFIDENTIAL INFORMATION
The Disclosing Party agrees to disclose certain confidential and proprietary information to the Receiving Party for the purpose of {{purpose}}.

2. OBLIGATIONS
The Receiving Party agrees to:
a) Hold all confidential information in strict confidence
b) Use the confidential information solely for the intended purpose
c) Not disclose the information to any third party without prior written consent
d) Take reasonable precautions to protect the confidentiality of the information

3. TERM
This Agreement shall remain in effect for a period of {{term}} from the Effective Date.

4. RETURN OF INFORMATION
Upon termination of this Agreement, the Receiving Party shall promptly return all confidential information to the Disclosing Party.

5. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

_________________________
{{companyName}}

_________________________
{{employeeName}}
    `,
    variables: [
      { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
      { key: 'companyName', label: 'Company Name', type: 'text', required: true },
      { key: 'effectiveDate', label: 'Agreement Effective Date', type: 'date', required: true },
      { key: 'purpose', label: 'Purpose of Disclosure', type: 'text', required: true },
      { key: 'term', label: 'Agreement Term', type: 'text', required: false, defaultValue: '2 years' },
      { key: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'State' }
    ],
    status: 'active',
    isDefault: true,
    legalReviewed: true,
    settings: {
      requireESignature: true,
      allowDigitalSignature: true,
      autoExpiry: { enabled: true, days: 730 }
    },
    agreementSettings: {
      effectiveDate: 'signature-date',
      duration: 'fixed-term',
      termLength: 24,
      renewalRequired: true,
      renewalNoticeDays: 30
    },
    tags: ['confidentiality', 'proprietary', 'legal']
  },
  {
    name: 'Remote Work Agreement',
    description: 'Agreement for employees working remotely with specific terms and conditions',
    category: 'remote-work',
    subject: 'Remote Work Agreement - {{companyName}}',
    content: `
REMOTE WORK AGREEMENT

This Remote Work Agreement ("Agreement") is made on {{effectiveDate}} between {{companyName}} ("Company") and {{employeeName}} ("Employee").

1. REMOTE WORK ARRANGEMENT
The Employee agrees to work remotely from {{remoteLocation}} as a {{designation}} for the Company.

2. WORKING HOURS
The Employee shall work {{workingHours}} per week, generally between {{coreHours}}. The Employee shall be available for communication during core business hours.

3. EQUIPMENT AND EXPENSES
The Company shall provide the following equipment: {{equipmentProvided}}. The Employee shall be responsible for {{employeeExpenses}}.

4. COMMUNICATION
The Employee shall maintain regular communication with their supervisor and team through {{communicationMethods}}.

5. SECURITY
The Employee shall ensure the security of Company information and follow all security protocols outlined in {{securityPolicy}}.

6. TERM
This remote work arrangement shall commence on {{startDate}} and continue until {{endDate}} or until terminated by either party with {{noticePeriod}} notice.

7. IN-OFFICE REQUIREMENTS
The Employee agrees to come to the office {{officeVisits}} for {{officePurpose}}.

_________________________
{{companyName}}

_________________________
{{employeeName}}
    `,
    variables: [
      { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
      { key: 'companyName', label: 'Company Name', type: 'text', required: true },
      { key: 'designation', label: 'Job Title', type: 'text', required: true },
      { key: 'effectiveDate', label: 'Agreement Effective Date', type: 'date', required: true },
      { key: 'startDate', label: 'Remote Work Start Date', type: 'date', required: true },
      { key: 'endDate', label: 'Remote Work End Date', type: 'date', required: false },
      { key: 'remoteLocation', label: 'Remote Work Location', type: 'text', required: true },
      { key: 'workingHours', label: 'Weekly Working Hours', type: 'text', required: false, defaultValue: '40 hours' },
      { key: 'coreHours', label: 'Core Business Hours', type: 'text', required: false, defaultValue: '9:00 AM - 5:00 PM' },
      { key: 'equipmentProvided', label: 'Equipment Provided by Company', type: 'text', required: false },
      { key: 'employeeExpenses', label: 'Employee Responsibilities', type: 'text', required: false },
      { key: 'communicationMethods', label: 'Communication Methods', type: 'text', required: false },
      { key: 'securityPolicy', label: 'Security Policy Reference', type: 'text', required: false },
      { key: 'noticePeriod', label: 'Notice Period for Changes', type: 'text', required: false, defaultValue: '30 days' },
      { key: 'officeVisits', label: 'Office Visit Frequency', type: 'text', required: false },
      { key: 'officePurpose', label: 'Office Visit Purpose', type: 'text', required: false }
    ],
    status: 'active',
    isDefault: true,
    legalReviewed: true,
    settings: {
      requireESignature: true,
      allowDigitalSignature: true,
      autoExpiry: { enabled: false }
    },
    agreementSettings: {
      effectiveDate: 'custom-date',
      duration: 'permanent',
      renewalRequired: false
    },
    tags: ['remote', 'work-from-home', 'flexible']
  }
];

async function seedAgreementTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms-multi-tenant', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Get a default admin user for createdBy field
    const adminUser = await Employee.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('⚠️ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`👤 Using admin user: ${adminUser.firstName} ${adminUser.lastName}`);

    // Clear existing templates
    await AgreementTemplate.deleteMany({});
    console.log('🗑️ Cleared existing agreement templates');

    // Create default templates
    const createdTemplates = [];
    
    for (const templateData of defaultAgreementTemplates) {
      const template = new AgreementTemplate({
        ...templateData,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      });
      
      await template.save();
      createdTemplates.push(template);
      console.log(`✅ Created template: ${template.name} (${template.templateId})`);
    }

    console.log(`\n🎉 Successfully created ${createdTemplates.length} agreement templates!`);
    
    console.log('\n📋 Created Templates:');
    createdTemplates.forEach(template => {
      console.log(`   - ${template.name} (${template.category}) - ${template.templateId}`);
    });

  } catch (error) {
    console.error('❌ Error seeding agreement templates:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seed function
if (require.main === module) {
  seedAgreementTemplates();
}

module.exports = seedAgreementTemplates;
