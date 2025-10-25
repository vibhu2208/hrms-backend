const cron = require('node-cron');
const Document = require('../models/Document');
const Compliance = require('../models/Compliance');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Check for expiring documents daily at 9 AM
const checkExpiringDocuments = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running expiring documents check...');
    
    const today = new Date();
    const documents = await Document.find({
      expiryDate: { $exists: true, $ne: null },
      status: { $ne: 'expired' },
      isActive: true
    }).populate('employee');

    for (const doc of documents) {
      const daysUntilExpiry = Math.ceil((doc.expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // Check if document is expiring within alert period
      if (daysUntilExpiry <= doc.alertDaysBefore && daysUntilExpiry > 0) {
        // Get user for employee
        const user = await User.findOne({ employeeId: doc.employee._id });
        
        if (user) {
          await Notification.create({
            recipient: user._id,
            type: 'document-expiry',
            title: 'Document Expiring Soon',
            message: `Your ${doc.documentType} (${doc.documentName}) will expire in ${daysUntilExpiry} days`,
            priority: daysUntilExpiry <= 7 ? 'high' : 'medium',
            relatedEntity: {
              entityType: 'Document',
              entityId: doc._id
            },
            actionUrl: `/documents/${doc._id}`
          });
        }
      } else if (daysUntilExpiry <= 0) {
        // Mark as expired
        doc.status = 'expired';
        await doc.save();
      }
    }
    
    console.log('Expiring documents check completed');
  } catch (error) {
    console.error('Error in expiring documents check:', error);
  }
}, {
  scheduled: false
});

// Check for due compliances daily at 9 AM
const checkDueCompliances = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running due compliances check...');
    
    const today = new Date();
    const compliances = await Compliance.find({
      dueDate: { $exists: true, $ne: null },
      status: { $in: ['pending', 'in-progress'] },
      alertEnabled: true,
      isActive: true
    }).populate('employee');

    for (const compliance of compliances) {
      const daysUntilDue = Math.ceil((compliance.dueDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= compliance.alertDaysBefore && daysUntilDue >= 0) {
        const user = await User.findOne({ employeeId: compliance.employee._id });
        
        if (user) {
          await Notification.create({
            recipient: user._id,
            type: 'compliance-due',
            title: 'Compliance Due Soon',
            message: `${compliance.title} is due in ${daysUntilDue} days`,
            priority: daysUntilDue <= 5 ? 'urgent' : 'high',
            relatedEntity: {
              entityType: 'Compliance',
              entityId: compliance._id
            },
            actionUrl: `/compliance/${compliance._id}`
          });
        }
      }
    }
    
    console.log('Due compliances check completed');
  } catch (error) {
    console.error('Error in due compliances check:', error);
  }
}, {
  scheduled: false
});

// Check for expiring contracts daily at 9 AM
const checkExpiringContracts = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running expiring contracts check...');
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 30);

    const projects = await Project.find({
      endDate: { $gte: today, $lte: futureDate },
      status: 'active'
    }).populate('client').populate('projectManager');

    for (const project of projects) {
      const daysUntilExpiry = Math.ceil((project.endDate - today) / (1000 * 60 * 60 * 24));
      
      if (project.projectManager) {
        const user = await User.findOne({ employeeId: project.projectManager._id });
        
        if (user) {
          await Notification.create({
            recipient: user._id,
            type: 'contract-expiry',
            title: 'Project Contract Expiring',
            message: `Project "${project.name}" contract expires in ${daysUntilExpiry} days`,
            priority: daysUntilExpiry <= 15 ? 'high' : 'medium',
            relatedEntity: {
              entityType: 'Project',
              entityId: project._id
            },
            actionUrl: `/projects/${project._id}`
          });
        }
      }
    }
    
    console.log('Expiring contracts check completed');
  } catch (error) {
    console.error('Error in expiring contracts check:', error);
  }
}, {
  scheduled: false
});

// Start all cron jobs
const startCronJobs = () => {
  checkExpiringDocuments.start();
  checkDueCompliances.start();
  checkExpiringContracts.start();
  console.log('✅ Cron jobs started');
};

// Stop all cron jobs
const stopCronJobs = () => {
  checkExpiringDocuments.stop();
  checkDueCompliances.stop();
  checkExpiringContracts.stop();
  console.log('⏹️  Cron jobs stopped');
};

module.exports = {
  startCronJobs,
  stopCronJobs
};
