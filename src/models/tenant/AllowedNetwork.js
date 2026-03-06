const mongoose = require('mongoose');

const allowedNetworkSchema = new mongoose.Schema(
  {
    networkName: {
      type: String,
      required: true,
      trim: true
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

allowedNetworkSchema.index({ ipAddress: 1 }, { unique: true });

module.exports = allowedNetworkSchema;
