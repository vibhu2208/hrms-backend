const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const { getTenantModel } = require('../utils/tenantModels');

// Test endpoint to verify tenant isolation
router.get('/tenant-info', protect, tenantMiddleware, async (req, res) => {
  try {
    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    
    const employeeCount = await Employee.countDocuments();
    
    res.json({
      success: true,
      data: {
        clientId: req.tenant.clientId,
        dbName: req.tenant.dbName,
        companyName: req.tenant.client.companyName,
        employeeCount: employeeCount,
        connectionState: req.tenant.connection.readyState,
        connectionName: req.tenant.connection.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test endpoint to create a test employee for verification
router.post('/test-employee', protect, tenantMiddleware, async (req, res) => {
  try {
    const Employee = getTenantModel(req.tenant.connection, 'Employee');
    
    const testEmployee = await Employee.create({
      firstName: 'Test',
      lastName: 'Employee',
      email: `test-${Date.now()}@${req.tenant.client.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      phone: '1234567890',
      position: 'Test Position',
      department: null,
      salary: 50010,
      hireDate: new Date(),
      status: 'active'
    });
    
    res.json({
      success: true,
      message: 'Test employee created successfully',
      data: {
        employee: testEmployee,
        tenant: {
          clientId: req.tenant.clientId,
          dbName: req.tenant.dbName,
          companyName: req.tenant.client.companyName
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
