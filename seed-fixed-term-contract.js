const { getTenantConnection } = require('./src/config/database.config');
const { getTenantModel } = require('./src/utils/tenantModels');
const mongoose = require('mongoose');

const fixedTermContractTemplate = {
  name: 'Fixed Term Employment Contract - Program Officer',
  description: 'Comprehensive fixed term employment contract for program officer positions with all terms and conditions, annexures, and legal clauses',
  category: 'employment',
  subject: 'Fixed Term Employment Contract for the position of {{designation}}',
  content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
        }
        .header h2 { 
            color: #2c3e50; 
            margin-bottom: 10px; 
        }
        .contract-info { 
            background: #f8f9fa; 
            padding: 15px; 
            margin-bottom: 20px; 
            border-left: 4px solid #007bff;
        }
        .section { 
            margin-bottom: 25px; 
        }
        .section h3 { 
            color: #2c3e50; 
            border-bottom: 2px solid #3498db; 
            padding-bottom: 5px; 
        }
        .section p { 
            margin-bottom: 10px; 
            text-align: justify;
        }
        .annexure { 
            background: #f1f3f4; 
            padding: 20px; 
            margin: 20px 0; 
            border: 1px solid #ddd;
        }
        .signature { 
            margin-top: 50px; 
            text-align: right;
        }
        .signature-line { 
            border-bottom: 1px solid #333; 
            width: 300px; 
            margin: 50px 0 10px auto; 
            text-align: center;
        }
        .employee-signature { 
            margin-top: 30px;
        }
        .employee-signature .signature-line { 
            margin: 30px 0 10px 0; 
        }
        .bullet-points { 
            margin-left: 20px; 
        }
        .bullet-points li { 
            margin-bottom: 8px; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
        }
        th { 
            background-color: #f2f2f2; 
            font-weight: bold; 
        }
        .highlight { 
            background-color: #fff3cd; 
            padding: 10px; 
            border-left: 4px solid #ffc107;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <p><strong>{{employeeCode}}</strong></p>
        <p><strong>{{contractDate}}</strong></p>
        <p><strong>{{employeeName}}</strong></p>
        <p>{{employeeAddress}}</p>
        <br>
        <h2>Fixed Term Employment Contract for the position of {{designation}}</h2>
    </div>

    <div class="contract-info">
        <p>Dear {{employeeName}},</p>
        <p>{{companyName}} ({{companyShortName}}) is a management consulting company and provides specific project-based support to organisations. On the conclusion of the selection process, {{companyShortName}} is pleased to appoint you as {{designation}} for a fixed period of employment and depute you to the Specific client-based project on the terms and conditions as mentioned below.</p>
    </div>

    <div class="section">
        <h3>1. Emoluments</h3>
        <p>You will be paid a monthly gross salary of Rs. {{grossSalary}}/- (Rupees {{grossSalaryWords}} Only). The complete break-up of the sum is as per the attached Annexure-I, which forms an integral part of this appointment contract.</p>
    </div>

    <div class="section">
        <h3>2. Period</h3>
        <p>The period of your contract shall begin from {{startDate}} and expire upon satisfactory completion of the said period, but not later than {{endDate}}.</p>
        <p>Subsequently, the appointment will be for a fixed term with the option of renewal at the end of the period, subject to satisfactory performance. The appointment on its expiry will be considered renewed only when a written renewal confirmation is received from the company ({{companyShortName}}).</p>
    </div>

    <div class="section">
        <h3>3. Place of Work</h3>
        <p>Your appointment is made exclusively for you to work with the specific client-based project at the duty station in {{workLocation}}.</p>
    </div>

    <div class="section">
        <h3>4. Terms of Reference</h3>
        <p>The Terms of Reference (TOR) with the broad scope of responsibilities of your position is described in the attached Annexure-II. The responsibilities as mentioned in the annexure are inclusive but not limited in their scope for the overall execution of the job.</p>
    </div>

    <div class="section">
        <h3>5. Reporting Arrangements</h3>
        <p>The consultant will report to the {{reportingTo}} as assigned and referred by the company and work under his/her supervision.</p>
    </div>

    <div class="section">
        <h3>6. Nature of Appointment</h3>
        <p>Your appointment is made on a contractual basis with {{companyName}} ({{companyShortName}}) as per the contract {{companyShortName}} has with the client organisation. Your appointment shall automatically cease to exist at the expiry of the aforesaid contract or closure of the project to which you are deputed by {{companyShortName}}. Since your appointment is being made for a specified period, you will neither have any right nor a lien on the job held by you.</p>
    </div>

    <div class="section">
        <h3>7. Working Hours</h3>
        <p>You must follow the working hours of the Specific Program/ Project of the client organization you are deputed with and follow the policy thereof.</p>
    </div>

    <div class="section">
        <h3>8. Public Holidays</h3>
        <p>The holidays will be applicable as per the company holidays.</p>
    </div>

    <div class="section">
        <h3>9. Leave</h3>
        <p>The entitlement of leaves will be as per the company leave policy.</p>
    </div>

    <div class="section">
        <h3>10. Performance Assessment</h3>
        <p>The Company ({{companyShortName}}) in consultation with appropriate authority would design and facilitate the implementation of the Performance assessment process as felt necessary from time to time. Such performance assessment process may involve the employee and their supervisors as applicable. You will abide by the guideline of such assessment process as laid down by the company from time to time.</p>
    </div>

    <div class="section">
        <h3>11. Official Travel</h3>
        <p>You will adhere to the travel rules as prescribed by the company ({{companyShortName}}). Travel claim will be reimbursed on an actual basis by {{companyShortName}} on submission of a travel claim form as per the travel policy of the company. Travel Expenditure rates will be applicable as per {{companyShortName}} Policy.</p>
    </div>

    <div class="section">
        <h3>12. Obligations of the Employee</h3>
        <p>The obligations of the employee are strictly limited to the terms and conditions of this letter. Accordingly, the employee shall not be entitled to any benefit, payment, subsidy, compensation, or pension from the Company, except as expressly provided. The employee will not be exempted from taxation by virtue of this contract and is solely responsible for payment of tax as required under the law.</p>
    </div>

    <div class="section">
        <h3>13. Confidentiality</h3>
        <ul class="bullet-points">
            <li>You will not, without the prior written consent of Company ({{companyShortName}}), disclose to any third party any confidential information obtained during or arising from this contractual assignment.</li>
            <li>You will not either during your employment or at any point after termination: disclose to any person such Confidential Information (except such persons authorized by the Company to know or as otherwise required by law);</li>
            <li>use such Confidential Information for your own purposes or for any purposes other than those of the Company; or</li>
            <li>through any failure to exercise all due care and diligence, cause any unauthorized disclosure of such Confidential Information.</li>
        </ul>
        <p><strong>"Confidential Information"</strong>, for the purposes of this employment contract, means "all information of a confidential nature relating to the affairs of the company or it's client disclosed (whether in writing, verbally or by any other means and whether directly or indirectly) before or after the date of this Agreement."</p>
        <p>The Employee shall not at any time during the continuance of their employment or on termination, issue any statements to the press except as authorized, in writing, by the Company/its authorized representatives.</p>
    </div>

    <div class="section">
        <h3>14. Disclosure of Information</h3>
        <p>Your services are being hired on the basis of your particular such as qualifications, experience etc. as given in your application/Bio Data and in case any information as given by you is found to be false or incorrect this contract will be deemed void ab initio and you will are liable for termination without any notice.</p>
    </div>

    <div class="section">
        <h3>15. Standards of Conduct</h3>
        <p><strong>15.1</strong> You will conduct at all times with the fullest regard for the purposes and principles of the program, and the Company ({{companyShortName}}), and in a manner befitting your relationship with the Company ({{companyShortName}}). You will not engage in any activity that is incompatible with those purposes and principles. You will avoid any action or public pronouncement, which may adversely affect relationship between the parties, or the integrity, independence and impartiality which are required by such relationship.</p>
        <p><strong>15.2</strong> If you indulge in any activity which is considered undesirable or detrimental to the interest, Code of Conduct or objective of the appointed position or the company ({{companyShortName}}), your services shall be terminated by the Company with immediate effect.</p>
        <p><strong>15.3</strong> You will not discontinue/absent from duty without obtaining specific written approval from the supervisor or the Company ({{companyShortName}}).</p>
        <p><strong>15.4</strong> Employee's fulfillment of requirement of the Terms of Reference as attached in Annexure-III is highly important to the program objective. Submission of periodic report as directed by the company ({{companyShortName}}) or supervisor is an integral part of the job performance of the employee. Non-submission of such reports within the stipulated time will be considered as non-performance and will attract disciplinary action including termination of contract as deem fit by the company.</p>
        <p><strong>15.5</strong> You will act responsibly in the matter of Health and Safety so as to ensure safe working environment for self and others. Any deliberate act on your part of the employee causing health or safety hazards will be viewed strictly as indiscipline and appropriate authorities will initiate suitable action as deem fit.</p>
    </div>

    <div class="section">
        <h3>16. Intellectual Property</h3>
        <p>The intellectual property rights associated with any ideas, concepts, techniques, inventions, processes, works of authorship, all published and unpublished research, developed or created by you, solely or jointly with others, during the course of performing work for or on behalf of the company or the client organisation, at any time during the Employment Period will be considered as "work product" and remain a property of the Client organization you are deputed to with all rights, including, without limitation, copyrights, patents and trade secret rights. You will not exercise any rights over these intellectual properties, copyrights and patents and will desist from using them anywhere outside the role of this contract or any time after the period of contract expires. The obligations under this clause shall survive the termination or expiration of this contract.</p>
    </div>

    <div class="section">
        <h3>17. Non-Compete</h3>
        <p><strong>17.1</strong> You will not engage in any personal, business, or professional activity which conflict or could conflict with your obligations in relation to this contract.</p>
        <p><strong>17.2</strong> You will notify the Company ({{companyShortName}}) immediately of any actual or potential conflict of interest in relation to this contract.</p>
        <p><strong>17.3</strong> You are prohibited from taking another assignment (full time or part time) along with this contract unless specific permission in writing is obtained from appropriate authority.</p>
    </div>

    <div class="section">
        <h3>18. Suspension or Termination</h3>
        <p><strong>18.1</strong> This Contract may be terminated at any time by either party giving {{noticePeriod}} notice or {{noticePeriod}} remuneration in lieu of notice. However, this contract may be terminated without any notice in the following events:</p>
        <ul class="bullet-points">
            <li>(a) commits any act of fraud, gross misconduct or negligence or other repudiatory breach of contract; or</li>
            <li>(b) is convicted of any criminal offence; or</li>
            <li>(c) has misrepresented details relating to educational qualifications, prior work experience, prior reputation in relation to her earlier employment and information in relation to any criminal proceedings; or</li>
            <li>(d) undertakes such actions or omissions which is detrimental to or harms the reputation of the Company.</li>
        </ul>
        <p><strong>18.2</strong> If during the notice of {{noticePeriod}}, after the employee has given resignation, the organization feels that the stipulated {{noticePeriod}} is not required then can terminate the employment at an earlier date for which no compensation would be payable.</p>
        <p><strong>18.3</strong> The employee if wants to discontinue his/her engagement is required to give {{noticePeriod}} advance notice to the Company ({{companyShortName}}) or salary in lieu thereof.</p>
    </div>

    <div class="section">
        <h3>19. Return of Assets on Expiry/ Termination</h3>
        <p>You will return any property or documents of the Company which might have been issued to you or in your possession, custody for the performance of duty under this contract, including but not limited to, the laptop, phone, minutes, correspondence, notes, records, reports, plans, letterheads, visiting cards, upon cessation of the employment contract for whatsoever reason. You will immediately deliver to the authorized representative of the Company as directed.</p>
    </div>

    <div class="section">
        <h3>20. Governing Law</h3>
        <p>This employment contract shall be governed in accordance with Indian law. Any disputes arising out of this employment contract shall be subject to the exclusive jurisdiction of the courts in {{jurisdiction}}.</p>
    </div>

    <div class="annexure">
        <h3>Annexure - I</h3>
        <h4>COMPLETE BREAK-UP OF EMOLUMENTS OF {{employeeName}} w.e.f. {{startDate}}</h4>
        <table>
            <tr>
                <th>Salary Components</th>
                <th>Monthly</th>
            </tr>
            <tr>
                <td>Basic Salary</td>
                <td>{{basicSalary}}</td>
            </tr>
            <tr>
                <td>HRA</td>
                <td>{{hra}}</td>
            </tr>
            <tr>
                <td>Special Allowance</td>
                <td>{{specialAllowance}}</td>
            </tr>
            <tr>
                <td>Telephone Allowance</td>
                <td>{{telephoneAllowance}}</td>
            </tr>
            <tr>
                <td><strong>Gross Salary</strong></td>
                <td><strong>{{grossSalary}}</strong></td>
            </tr>
            <tr>
                <td>Employer Contribution to PF</td>
                <td>{{employerPF}}</td>
            </tr>
            <tr>
                <td><strong>Cost to Company</strong></td>
                <td><strong>{{costToCompany}}</strong></td>
            </tr>
        </table>
        <p><strong>You will also be entitled to the following benefits:</strong></p>
        <ul class="bullet-points">
            <li>You will be covered under medical insurance of {{medicalInsuranceSum}} sum assured and Personal Accident of {{accidentInsuranceSum}} sum assured under the Group Mediclaim and Group Accident policy of the Company.</li>
        </ul>
    </div>

    <div class="annexure">
        <h3>Annexure – II</h3>
        <h4>Terms of Reference</h4>
        <table>
            <tr>
                <th>Name</th>
                <td>{{employeeName}}</td>
            </tr>
            <tr>
                <th>Position</th>
                <td>{{designation}}</td>
            </tr>
            <tr>
                <th>Reporting to</th>
                <td>{{reportingTo}}</td>
            </tr>
            <tr>
                <th>Work Location</th>
                <td>{{workLocation}}</td>
            </tr>
        </table>
        <h4>Roles and Responsibilities:</h4>
        <ul class="bullet-points">
            <li>Develop working relations with the assigned set of districts. KMA program should become a priority program within the system</li>
            <li>Liaison with the district officials for regular support for the program and monthly/ quarterly review to be conducted at the district level</li>
            <li>Regular interaction with the district and block officials for support in day-to day operations.</li>
            <li>Share program data with key officials for data-based decision making</li>
            <li>Conduct capacity building sessions at the regional/ district level for district and block officials</li>
            <li>Conduct regular capacity building need assessment and design CB sessions to fill program gaps</li>
            <li>Assess IEC requirements for the district and blocks and develop IEC implementation plans</li>
            <li>Assess effectiveness of IEC plans and use the same for planning purpose</li>
            <li>Prepare weekly plans for field visit to districts and blocks</li>
            <li>Share highlights from field visits to {{reportingTo}}</li>
            <li>Share weekly/ monthly and quarterly reports with {{reportingTo}}</li>
        </ul>
    </div>

    <div class="signature">
        <p>For {{companyName}}</p>
        <br><br><br>
        <div class="signature-line">{{authorizedSignatory}}</div>
        <p>{{signatoryTitle}}</p>
    </div>

    <div class="employee-signature">
        <div class="highlight">
            <p><strong>I accept the offer and the terms and conditions mentioned in the aforesaid letter.</strong></p>
        </div>
        <br><br><br>
        <div class="signature-line">Signature</div>
        <p><strong>Name of the Employee</strong></p>
        <p>{{designation}}</p>
    </div>
</body>
</html>`,
  variables: [
    { key: 'employeeCode', label: 'Employee Code', type: 'text', required: true },
    { key: 'contractDate', label: 'Contract Date', type: 'date', required: true },
    { key: 'employeeName', label: 'Employee Full Name', type: 'text', required: true },
    { key: 'employeeAddress', label: 'Employee Address', type: 'text', required: true },
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'companyName', label: 'Company Full Name', type: 'text', required: true },
    { key: 'companyShortName', label: 'Company Short Name', type: 'text', required: true },
    { key: 'grossSalary', label: 'Gross Salary (Rs.)', type: 'currency', required: true },
    { key: 'grossSalaryWords', label: 'Gross Salary in Words', type: 'text', required: true },
    { key: 'startDate', label: 'Start Date', type: 'date', required: true },
    { key: 'endDate', label: 'End Date', type: 'date', required: true },
    { key: 'workLocation', label: 'Work Location', type: 'text', required: true },
    { key: 'reportingTo', label: 'Reporting To', type: 'text', required: true },
    { key: 'noticePeriod', label: 'Notice Period', type: 'text', required: false, defaultValue: 'Thirty Days' },
    { key: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'Delhi' },
    { key: 'basicSalary', label: 'Basic Salary', type: 'currency', required: true },
    { key: 'hra', label: 'HRA', type: 'currency', required: true },
    { key: 'specialAllowance', label: 'Special Allowance', type: 'currency', required: true },
    { key: 'telephoneAllowance', label: 'Telephone Allowance', type: 'currency', required: true },
    { key: 'employerPF', label: 'Employer PF Contribution', type: 'currency', required: true },
    { key: 'costToCompany', label: 'Cost to Company', type: 'currency', required: true },
    { key: 'medicalInsuranceSum', label: 'Medical Insurance Sum Assured', type: 'text', required: false, defaultValue: '1 lakh' },
    { key: 'accidentInsuranceSum', label: 'Accident Insurance Sum Assured', type: 'text', required: false, defaultValue: '5 Lakh' },
    { key: 'authorizedSignatory', label: 'Authorized Signatory', type: 'text', required: true },
    { key: 'signatoryTitle', label: 'Signatory Title', type: 'text', required: true }
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
    renewalRequired: true,
    renewalNoticeDays: 30
  },
  tags: ['fixed-term', 'program-officer', 'comprehensive', 'legal', 'contract']
};

async function seedFixedTermContractTemplate(tenantId = 'spc') {
  try {
    console.log(`🏢 Seeding Fixed Term Contract Template for tenant: ${tenantId}`);
    
    // Get tenant connection
    const tenantConnection = await getTenantConnection(tenantId);
    const AgreementTemplate = getTenantModel(tenantConnection, 'AgreementTemplate');
    
    // Check if template already exists
    const existingTemplate = await AgreementTemplate.findOne({ 
      name: fixedTermContractTemplate.name 
    });
    
    if (existingTemplate) {
      console.log(`📄 Template "${fixedTermContractTemplate.name}" already exists. Skipping seed.`);
      return;
    }

    // Create the template
    const template = new AgreementTemplate({
      ...fixedTermContractTemplate,
      templateId: `FTC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      createdBy: new mongoose.Types.ObjectId(),
      updatedBy: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await template.save();
    console.log(`✅ Created template: ${template.name} (${template.templateId})`);
    console.log(`📋 Template includes ${template.variables.length} variables for customization`);

  } catch (error) {
    console.error('❌ Error seeding fixed term contract template:', error);
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  const tenantId = process.argv[2] || 'spc';
  seedFixedTermContractTemplate(tenantId)
    .then(() => {
      console.log('✅ Fixed Term Contract Template seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedFixedTermContractTemplate;
