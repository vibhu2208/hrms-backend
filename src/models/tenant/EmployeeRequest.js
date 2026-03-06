const mongoose = require('mongoose');

const employeeRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestType: { type: String, enum: ['id-card-reissue','hr-query','bank-update','document-upload','address-change','emergency-contact-update','salary-certificate','experience-letter','noc-request','attendance-regularization','attendance-wfh','attendance-on-duty','attendance-partial-day','other'], required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'pending-info', 'in-progress', 'pending-approval', 'resolved', 'closed', 'rejected'], default: 'open', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: Date,
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false }
  }],
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

employeeRequestSchema.index({ employeeId: 1, status: 1 });
employeeRequestSchema.index({ createdAt: -1 });

employeeRequestSchema.pre('validate', async function generateRequestNumber(next) {
  if (this.requestNumber) return next();
  try {
    const year = new Date().getFullYear();
    const prefix = `REQ${year}`;
    const Model = this.constructor;
    const count = await Model.countDocuments({ requestNumber: new RegExp(`^${prefix}`) });
    this.requestNumber = `${prefix}${String(count + 1).padStart(6, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = employeeRequestSchema;
