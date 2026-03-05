const { getTenantConnection } = require('./src/config/database.config');
const { getTenantModel } = require('./src/utils/tenantModels');
const mongoose = require('mongoose');

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
    name: 'Internship Agreement',
    description: 'Agreement for interns with specific terms and learning objectives',
    category: 'internship',
    subject: 'Internship Agreement - {{companyName}}',
    content: `
INTERNSHIP AGREEMENT

This Internship Agreement ("Agreement") is made on {{effectiveDate}} between {{companyName}} ("Company") and {{employeeName}} ("Intern").

1. INTERNSHIP POSITION
The Company agrees to provide an internship position as {{designation}} in the {{department}} department.

2. INTERNSHIP PERIOD
The internship shall commence on {{startDate}} and conclude on {{endDate}}.

3. STIPEND
The Intern shall receive a stipend of {{monthlyStipend}} {{currency}} per month.

4. LEARNING OBJECTIVES
The internship focuses on: {{learningObjectives}}

5. RESPONSIBILITIES
The Intern shall: {{internshipResponsibilities}}

6. CONFIDENTIALITY
All company information remains confidential during and after the internship.

_________________________
{{companyName}}

_________________________
{{employeeName}}
    `,
    variables: [
      { key: 'employeeName', label: 'Intern Full Name', type: 'text', required: true },
      { key: 'designation', label: 'Internship Position', type: 'text', required: true },
      { key: 'department', label: 'Department', type: 'text', required: true },
      { key: 'monthlyStipend', label: 'Monthly Stipend', type: 'currency', required: true },
      { key: 'currency', label: 'Currency', type: 'text', required: false, defaultValue: 'USD' },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'endDate', label: 'End Date', type: 'date', required: true },
      { key: 'effectiveDate', label: 'Agreement Effective Date', type: 'date', required: true },
      { key: 'companyName', label: 'Company Name', type: 'text', required: true },
      { key: 'learningObjectives', label: 'Learning Objectives', type: 'textarea', required: true },
      { key: 'internshipResponsibilities', label: 'Intern Responsibilities', type: 'textarea', required: true }
    ],
    status: 'active',
    isDefault: false,
    legalReviewed: true,
    settings: {
      requireESignature: true,
      allowDigitalSignature: true,
      autoExpiry: { enabled: true, days: 365 }
    },
    agreementSettings: {
      effectiveDate: 'custom-date',
      duration: 'fixed-term',
      termLength: 12,
      renewalRequired: false
    },
    tags: ['internship', 'learning', 'temporary']
  }
];

async function seedTenantAgreementTemplates(tenantId = 'spc') {
  try {
    console.log(`🏢 Seeding agreement templates for tenant: ${tenantId}`);
    
    // Get tenant connection
    const tenantConnection = await getTenantConnection(tenantId);
    const AgreementTemplate = getTenantModel(tenantConnection, 'AgreementTemplate');
    
    // Check if templates already exist
    const existingCount = await AgreementTemplate.countDocuments();
    if (existingCount > 0) {
      console.log(`📄 ${existingCount} agreement templates already exist for tenant ${tenantId}. Skipping seed.`);
      return;
    }

    // Create default templates
    const createdTemplates = [];
    
    for (const templateData of defaultAgreementTemplates) {
      const template = new AgreementTemplate({
        ...templateData,
        templateId: `AGR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        createdBy: new mongoose.Types.ObjectId(), // Use a dummy ObjectId for seeding
        updatedBy: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await template.save();
      createdTemplates.push(template);
      console.log(`✅ Created template: ${template.name} (${template.templateId})`);
    }

    console.log(`\n🎉 Successfully created ${createdTemplates.length} agreement templates for tenant ${tenantId}!`);
    
    console.log('\n📋 Created Templates:');
    createdTemplates.forEach(template => {
      console.log(`   - ${template.name} (${template.category}) - ${template.templateId}`);
    });

  } catch (error) {
    console.error('❌ Error seeding agreement templates:', error);
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  const tenantId = process.argv[2] || 'spc';
  seedTenantAgreementTemplates(tenantId)
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedTenantAgreementTemplates;
