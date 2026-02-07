/**
 * Debug Controller Step by Step
 */

const mongoose = require('mongoose');

async function debugController() {
  try {
    console.log('🧪 Debugging Controller Step by Step...');
    
    // Test database connection first
    const tenantDbName = 'tenant_696b515db6c9fd5fd51aed1c';
    await mongoose.connect(`mongodb+srv://vibhu:Vaibhav5373@hrms.amc8ygk.mongodb.net/${tenantDbName}?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Database connected');
    
    // Test getUserProjects function directly
    const { getUserProjects } = require('./src/config/spcProjectPermissions');
    
    const ProjectAssignment = mongoose.model('ProjectAssignment', new mongoose.Schema({}, { strict: false }), 'projectassignments');
    const connection = mongoose.connection;
    
    const mockUserId = '696bfa999239d1cecdf311a7';
    
    console.log('🔍 Testing getUserProjects...');
    const userProjects = await getUserProjects(mockUserId, connection);
    console.log(`✅ getUserProjects returned: ${userProjects.length} projects`);
    
    // Test the actual controller method
    console.log('🔍 Testing controller method...');
    
    // Create a mock request and response
    const mockReq = {
      user: {
        userId: mockUserId,
        userRole: 'company_admin',
        email: 'admin@company.com'
      }
    };
    
    let errorOccurred = false;
    let errorMessage = '';
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (!data.success) {
            errorOccurred = true;
            errorMessage = data.message;
          }
          console.log('📊 Response:', JSON.stringify(data, null, 2));
        }
      })
    };
    
    // Import and call the controller
    try {
      const SPCProjectController = require('./src/controllers/spcProjectController');
      
      console.log('🔍 Calling getUserDashboard...');
      await SPCProjectController.getUserDashboard(mockReq, mockRes);
      
      if (!errorOccurred) {
        console.log('✅ Controller method executed successfully!');
      } else {
        console.log('❌ Controller method failed with error:', errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Controller method threw exception:', error.message);
      console.error('Stack:', error.stack);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugController();
