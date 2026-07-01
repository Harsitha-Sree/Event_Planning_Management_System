 
const mongoose = require('mongoose');

const eventSchema = mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // References the User model
    },
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    eventPhoto: {
      type: String, // URL to the uploaded event photo (e.g., Cloudinary URL)
      default: '',  // Can be empty if no photo uploaded
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String, // Storing time as string (e.g., "19:00") for simplicity
      required: true,
    },
    venueName: {
      type: String,
      required: true,
      trim: true,
    },
    venueLocation: {
      // Store geographic coordinates and address for map integration
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      address: {
        type: String, // Can store the human-readable address derived from map selection
        required: true,
        trim: true,
      },
    },
    // Optional: add a status for the event itself (e.g., 'scheduled', 'cancelled', 'completed')
    // eventStatus: {
    //   type: String,
    //   enum: ['scheduled', 'cancelled', 'completed'],
    //   default: 'scheduled',
    // },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;