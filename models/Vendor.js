 
const mongoose = require('mongoose');

const serviceSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  photo: {
    type: String, 
    default: '',
  },
});

const vendorProfileSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // References the User model
      unique: true, // A vendor profile should be unique per user
    },
    companyName: {
      type: String,
      required: true,
      unique: true, // Ensure company names are unique across vendors
      trim: true,
    },
    photo: {
      type: String, // URL to the uploaded main business photo/logo
      default: '',
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String, // E.g., "New York, NY" or full address
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    services: [serviceSchema], // Array of embedded service objects
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    isApproved: {
      type: Boolean,
      default: false, // New vendor profiles require admin approval
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

const VendorProfile = mongoose.model('VendorProfile', vendorProfileSchema);

module.exports = VendorProfile;