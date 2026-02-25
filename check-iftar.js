const { getTenantConnection } = require('./src/config/database.config');

async function checkIftarAalam() {
  let tenantConnection = null;
  
  try {
    console.log('🔍 Checking iftar aalam (iftar@mail.com)...');
    
    // Connect to tenant database
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    tenantConnection = await getTenantConnection(tenantDbName);
    
    console.log('✅ Connected to tenant database');
    
    // Get models
    const Employee = tenantConnection.models.Employee || tenantConnection.model('Employee', require('./src/models/tenant/TenantEmployee'));
    const Candidate = tenantConnection.model('Candidate', require('./src/models/Candidate').schema);
    
    // Find the employee
    const employee = await Employee.findOne({ email: 'iftar@mail.com' });
    
    if (!employee) {
      console.log('❌ Employee iftar@mail.com not found');
      return;
    }
    
    console.log('\n👤 Employee Details:');
    console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`   Email: ${employee.email}`);
    console.log(`   Code: ${employee.employeeCode}`);
    console.log(`   Status: ${employee.status}`);
    console.log(`   isActive: ${employee.isActive}`);
    console.log(`   isExEmployee: ${employee.isExEmployee}`);
    console.log(`   terminatedAt: ${employee.terminatedAt || 'Not set'}`);
    
    // Check if candidate exists
    const candidate = await Candidate.findOne({
      $or: [
        { exEmployeeId: employee._id },
        { exEmployeeCode: employee.employeeCode },
        { email: employee.email, isExEmployee: true }
      ]
    });
    
    if (candidate) {
      console.log(`\n✅ Candidate found: ${candidate.candidateCode}`);
      console.log(`   Stage: ${candidate.stage}, Status: ${candidate.status}`);
    } else {
      console.log(`\n❌ No candidate found in candidate pool`);
      
      // Check if employee needs to be processed
      if (!employee.isExEmployee || employee.isActive || employee.status !== 'terminated') {
        console.log(`\n🔄 Employee not properly processed as ex-employee. Running workflow...`);
        
        try {
          const offboardingWorkflow = require('./src/services/offboardingWorkflow');
          
          const offboardingRequest = {
            _id: new (require('mongoose').Types.ObjectId)(),
            employeeId: employee._id,
            reason: 'Completed offboarding',
            reasonDetails: 'Offboarding completed - fixing missing candidate',
            lastWorkingDay: new Date(),
            status: 'closed',
            isCompleted: true,
            save: async function() { 
              return this;
            }
          };
          
          await offboardingWorkflow.completeOffboarding(tenantConnection, offboardingRequest);
          
          console.log(`✅ Workflow completed`);
          
          // Check again for candidate
          const newCandidate = await Candidate.findOne({
            $or: [
              { exEmployeeId: employee._id },
              { exEmployeeCode: employee.employeeCode },
              { email: employee.email, isExEmployee: true }
            ]
          });
          
          if (newCandidate) {
            console.log(`✅ SUCCESS: Candidate created: ${newCandidate.candidateCode}`);
          } else {
            console.log(`❌ Still no candidate found. Creating manually...`);
            
            // Create candidate manually
            const experience = employee.joiningDate ? 
              Math.floor((new Date() - new Date(employee.joiningDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
            
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const candidateCode = `CAN${timestamp}${random}`;
            
            const candidateData = {
              candidateCode: candidateCode,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              phone: employee.phone || '',
              currentLocation: employee.address?.city || employee.address || '',
              experience: {
                years: experience,
                months: 0
              },
              currentCompany: 'Previous Employer',
              currentDesignation: employee.designation || 'Previous Role',
              currentCTC: null,
              skills: employee.skills || [],
              source: 'internal',
              stage: 'applied',
              status: 'active',
              isExEmployee: true,
              exEmployeeId: employee._id,
              exEmployeeCode: employee.employeeCode,
              notes: `Ex-employee from ${employee.department || 'General'} department. Fixed via manual intervention.`,
              timeline: [{
                action: 'Added from Offboarding',
                description: `Employee offboarding completed. Previous employee code: ${employee.employeeCode}. Experience: ${experience} years.`,
                timestamp: new Date()
              }]
            };
            
            const createdCandidate = await Candidate.create(candidateData);
            console.log(`✅ SUCCESS: Manually created candidate: ${createdCandidate.candidateCode}`);
          }
          
        } catch (workflowError) {
          console.error(`❌ Workflow failed:`, workflowError.message);
        }
      }
    }
    
    // Final status check
    const updatedEmployee = await Employee.findById(employee._id);
    console.log(`\n📊 Final Employee Status:`);
    console.log(`   Status: ${updatedEmployee.status}`);
    console.log(`   Active: ${updatedEmployee.isActive}`);
    console.log(`   Ex-employee: ${updatedEmployee.isExEmployee}`);
    console.log(`   Terminated: ${updatedEmployee.terminatedAt || 'Not set'}`);
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    if (tenantConnection) {
      await tenantConnection.close();
      console.log('🔒 Database connection closed');
    }
  }
}

// Run the check
checkIftarAalam();
