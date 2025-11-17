const mongoose = require('mongoose');

// Import all models and extract schemas
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Asset = require('../models/Asset');
const JobPosting = require('../models/JobPosting');
const Onboarding = require('../models/Onboarding');
const Offboarding = require('../models/Offboarding');
const Project = require('../models/Project');
const Timesheet = require('../models/Timesheet');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');
const Candidate = require('../models/Candidate');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const ExitProcess = require('../models/ExitProcess');
const TalentPool = require('../models/TalentPool');
const OfferTemplate = require('../models/OfferTemplate');

// Import offboarding related models
const OffboardingRequest = require('../models/tenant/OffboardingRequest');
const OffboardingTask = require('../models/tenant/OffboardingTask');
const HandoverDetail = require('../models/tenant/HandoverDetail');
const AssetClearance = require('../models/tenant/AssetClearance');
const FinalSettlement = require('../models/tenant/FinalSettlement');
const ExitFeedback = require('../models/tenant/ExitFeedback');

/**
 * Get tenant-specific models using the tenant's database connection
 * @param {mongoose.Connection} tenantConnection - Tenant database connection
 * @returns {Object} - Object containing all tenant-specific models
 */
function getTenantModels(tenantConnection) {
  // Cache models per connection to avoid re-compilation
  if (tenantConnection._tenantModels) {
    return tenantConnection._tenantModels;
  }

  const models = {};
  
  // Helper function to safely create tenant model
  const createTenantModel = (modelName, originalModel) => {
    try {
      // Get schema from the original model
      const schema = originalModel.schema || originalModel.prototype.schema;
      if (schema) {
        return tenantConnection.model(modelName, schema);
      } else {
        console.warn(`⚠️ No schema found for ${modelName}, skipping tenant model creation`);
        return null;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to create tenant model for ${modelName}:`, error.message);
      return null;
    }
  };

  // Core models
  models.Employee = createTenantModel('Employee', Employee);
  models.Department = createTenantModel('Department', Department);
  models.Leave = createTenantModel('Leave', Leave);
  models.Attendance = createTenantModel('Attendance', Attendance);
  models.Payroll = createTenantModel('Payroll', Payroll);
  models.Asset = createTenantModel('Asset', Asset);
  models.JobPosting = createTenantModel('JobPosting', JobPosting);
  models.Onboarding = createTenantModel('Onboarding', Onboarding);
  models.Offboarding = createTenantModel('Offboarding', Offboarding);
  models.Project = createTenantModel('Project', Project);
  models.Timesheet = createTenantModel('Timesheet', Timesheet);
  models.Document = createTenantModel('Document', Document);
  models.Compliance = createTenantModel('Compliance', Compliance);
  models.Candidate = createTenantModel('Candidate', Candidate);
  models.Feedback = createTenantModel('Feedback', Feedback);
  models.Notification = createTenantModel('Notification', Notification);
  models.ExitProcess = createTenantModel('ExitProcess', ExitProcess);
  models.TalentPool = createTenantModel('TalentPool', TalentPool);
  models.OfferTemplate = createTenantModel('OfferTemplate', OfferTemplate);

  // Tenant-specific offboarding models
  models.OffboardingRequest = createTenantModel('OffboardingRequest', OffboardingRequest);
  models.OffboardingTask = createTenantModel('OffboardingTask', OffboardingTask);
  models.HandoverDetail = createTenantModel('HandoverDetail', HandoverDetail);
  models.AssetClearance = createTenantModel('AssetClearance', AssetClearance);
  models.FinalSettlement = createTenantModel('FinalSettlement', FinalSettlement);
  models.ExitFeedback = createTenantModel('ExitFeedback', ExitFeedback);

  // Cache models on connection
  tenantConnection._tenantModels = models;
  
  return models;
}

/**
 * Get a specific tenant model
 * @param {mongoose.Connection} tenantConnection - Tenant database connection
 * @param {string} modelName - Name of the model to retrieve
 * @returns {mongoose.Model} - Tenant-specific model
 */
function getTenantModel(tenantConnection, modelName) {
  const models = getTenantModels(tenantConnection);
  return models[modelName];
}

module.exports = {
  getTenantModels,
  getTenantModel
};
