 
const mongoose = require('mongoose');

const organizerSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // References the User model
      unique: true, // An organizer profile should be unique per user
    },
   
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

const Organizer = mongoose.model('Organizer', organizerSchema);

module.exports = Organizer;