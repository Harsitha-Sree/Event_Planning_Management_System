const mongoose = require('mongoose');

const vendorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  photo: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  services: [{
    type: String,
  }],
  description: {
    type: String,
    default: '',
  },
  isApproved: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
vendorProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// CRITICAL FIX: Check if model already exists before creating it
module.exports = mongoose.models.VendorProfile || mongoose.model('VendorProfile', vendorProfileSchema);