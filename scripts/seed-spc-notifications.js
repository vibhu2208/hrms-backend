/**
 * Seed a few demo notifications for SPC Admin/HR/Manager so the bell dropdown has content.
 * Run: node scripts/seed-spc-notifications.js
 */
require('dotenv').config();
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}

const {
  connectGlobalDB,
  getTenantConnection,
  closeAllTenantConnections,
  closeGlobalConnection,
} = require('../src/config/database.config');
const CompanyRegistrySchema = require('../src/models/global/CompanyRegistry');
const TenantUserSchema = require('../src/models/tenant/TenantUser');
const NotificationSchema = require('../src/models/Notification').schema;

(async () => {
  try {
    const global = await connectGlobalDB();
    const Company = global.model('CompanyRegistry', CompanyRegistrySchema);
    const company = await Company.findOne({ companyName: 'SPC Management' });
    if (!company) throw new Error('SPC Management company not found — run wipe-and-seed-spc first');

    const tenant = await getTenantConnection(company.companyId);
    const User = tenant.model('User', TenantUserSchema);
    const Notification = tenant.model('Notification', NotificationSchema);

    const targets = await User.find({
      email: { $in: ['admin@spc.com', 'hr@spc.com', 'manager@spc.com'] },
    }).select('_id email role');

    await Notification.deleteMany({});

    const samples = [
      {
        type: 'leave-request',
        title: 'Leave request pending',
        message: 'An employee submitted a leave request awaiting your review.',
        priority: 'high',
      },
      {
        type: 'project-assignment',
        title: 'New project assignment',
        message: 'You have been assigned to Project Alpha for this week.',
        priority: 'medium',
      },
      {
        type: 'general',
        title: 'Welcome to SPC Management',
        message: 'Your demo workspace is ready. Explore HR, recruitment, and employee tools.',
        priority: 'low',
      },
      {
        type: 'document-expiry',
        title: 'Document expiring soon',
        message: 'A consultant contract document expires in 14 days.',
        priority: 'urgent',
      },
    ];

    let created = 0;
    for (const user of targets) {
      for (const sample of samples) {
        await Notification.create({
          recipient: user._id,
          ...sample,
          isRead: false,
          isActive: true,
        });
        created += 1;
      }
    }

    console.log(`✅ Created ${created} notifications for ${targets.length} users`);
    await closeAllTenantConnections();
    await closeGlobalConnection();
    process.exit(0);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
})();
