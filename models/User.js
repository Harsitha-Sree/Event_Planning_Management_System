 
const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Ensures no two users can have the same email
      trim: true,
      lowercase: true, // Store emails in lowercase for consistency
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['organizer', 'vendor', 'admin'], // Enforce specific roles
      default: 'organizer', // Default role for self-registrations if not explicitly chosen
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'], // For administrative control
      default: 'active', // New accounts are active by default
      required: true,
    },
  },
  {
    timestamps: true, // Adds `createdAt` and `updatedAt` fields automatically
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;