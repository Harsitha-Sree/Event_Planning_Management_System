const mongoose = require('mongoose');

const invitationSchema = mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Event', // References the Event model
    },
    inviteeEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // Store emails in lowercase for consistency
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'accepted', 'rejected'], // Current RSVP status
      default: 'pending', // Invitations are pending by default
    },
    token: {
      type: String, // Unique token for direct RSVP via email link (public access)
      required: true,
      unique: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date, // Timestamp when the invitee responded
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields (for when the invitation record itself was created/modified)
  }
);

// Ensure that an email can only be invited once to a specific event
invitationSchema.index({ eventId: 1, inviteeEmail: 1 }, { unique: true });

const Invitation = mongoose.model('Invitation', invitationSchema);

module.exports = Invitation;