const axios = require('axios');

const defaultAgreementTemplates = [
  {
    name: 'Employment Agreement - Full Time',
    description: 'Standard employment agreement for full-time employees with benefits and standard terms',
    category: 'employment',
    subject: 'Employment Agreement - {{companyName}}',
    content: `EMPLOYMENT AGREEMENT

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
{{employeeName}}`,
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
    content: `INTERNSHIP AGREEMENT

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
{{employeeName}}`,
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

async function addAgreementTemplates() {
  // You'll need to get a valid auth token and tenant info
  const BASE_URL = 'http://localhost:5000/api';
  const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token
  const TENANT_ID = 'spc';

  try {
    console.log('🚀 Adding agreement templates...');

    for (const template of defaultAgreementTemplates) {
      try {
        const response = await axios.post(
          `${BASE_URL}/agreement-templates`,
          template,
          {
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`,
              'Content-Type': 'application/json',
              'x-tenant-id': TENANT_ID
            }
          }
        );

        if (response.data.success) {
          console.log(`✅ Created template: ${template.name}`);
        } else {
          console.log(`❌ Failed to create ${template.name}:`, response.data.message);
        }
      } catch (error) {
        console.log(`❌ Error creating ${template.name}:`, error.response?.data?.message || error.message);
      }
    }

    console.log('🎉 Agreement template addition completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

// Instructions
console.log(`
📋 To add agreement templates:

1. First, log in to the application and get your auth token from browser localStorage/cookies
2. Replace 'YOUR_AUTH_TOKEN_HERE' in this script with your actual token
3. Make sure the backend is running on localhost:5000
4. Run: node add-agreement-templates.js

Alternatively, you can create templates through the UI in the Templates section.
`);

// Uncomment the line below when you have the auth token
// addAgreementTemplates();

module.exports = addAgreementTemplates;
