 
const User = require('../models/User');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const { uploadToCloudinary } = require('../utils/uploadHandler'); 
const sendEmail = require('../utils/sendEmail'); 
const mongoose = require('mongoose');
const crypto = require('crypto'); 


const createEvent = async (req, res) => {
  const { eventName, date, time, venueName, venueLat, venueLng } = req.body;
  const organizerId = req.user.id; // From auth middleware

  // Basic validation
  if (!eventName || !date || !time || !venueName || !venueLat || !venueLng) {
    return res.status(400).json({ message: 'Please fill in all required event details' });
  }

  // Basic date validation (could be more robust)
  if (new Date(date) < new Date()) {
    return res.status(400).json({ message: 'Event date cannot be in the past' });
  }

  try {
    let eventPhotoUrl = '';
    // Check if an event photo was uploaded
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'event_photos'); // 'event_photos' is the folder in Cloudinary
      eventPhotoUrl = uploadResult.secure_url;
    }

    const newEvent = new Event({
      organizerId,
      eventName,
      eventPhoto: eventPhotoUrl,
      date: new Date(date), // Store as Date object
      time,
      venueName,
      venueLocation: {
        lat: parseFloat(venueLat),
        lng: parseFloat(venueLng),
        address: venueName, // Use venueName as address for simplicity, could be more detailed
      },
    });

    await newEvent.save();

    res.status(201).json({
      message: 'Event created successfully!',
      event: newEvent,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error creating event' });
  }
};

// @desc    Send event invitation
// @route   POST /api/events/:eventId/invite
// @access  Private (Organizer only)
const sendInvitation = async (req, res) => {
  const { eventId } = req.params;
  const { inviteeEmail } = req.body;
  const organizerId = req.user.id; // From auth middleware

  // Input validation
  if (!inviteeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
    return res.status(400).json({ message: 'Please provide a valid invitee email address' });
  }
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Invalid Event ID' });
  }

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Ensure the event belongs to the authenticated organizer
    if (event.organizerId.toString() !== organizerId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to invite guests to this event' });
    }

    // Check if invitation already exists for this email and event
    const existingInvitation = await Invitation.findOne({ eventId, inviteeEmail });
    if (existingInvitation) {
      // Could update status if it was rejected, but for simplicity, just inform it exists
      return res.status(409).json({ message: 'Invitation already sent to this email for this event' });
    }

    // Generate a unique token for the RSVP link
    const invitationToken = crypto.randomBytes(32).toString('hex');

    const newInvitation = new Invitation({
      eventId: event._id,
      inviteeEmail,
      status: 'pending', // Default status
      token: invitationToken,
      sentAt: new Date(),
    });

    await newInvitation.save();

    // --- Send Email ---
    const rsvpAcceptLink = `${req.protocol}://${req.get('host')}/api/events/rsvp/${invitationToken}/accepted`;
    const rsvpRejectLink = `${req.protocol}://${req.get('host')}/api/events/rsvp/${invitationToken}/rejected`;

    const emailSubject = `Invitation: You're invited to ${event.eventName}!`;
    const emailHtml = `
      <p>Dear Guest,</p>
      <p>You are cordially invited to <strong>${event.eventName}</strong>!</p>
      <p><strong>Date:</strong> ${event.date.toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${event.time}</p>
      <p><strong>Venue:</strong> ${event.venueName || event.venueLocation.address}</p>
      <p>Please RSVP by clicking one of the links below:</p>
      <p>
        <a href="${rsvpAcceptLink}" style="background-color: #28a745; color: white; padding: 10px 15px; border-radius: 5px; text-decoration: none;">Accept Invitation</a>
        &nbsp;&nbsp;
        <a href="${rsvpRejectLink}" style="background-color: #dc3545; color: white; padding: 10px 15px; border-radius: 5px; text-decoration: none;">Reject Invitation</a>
      </p>
      <p>We look forward to seeing you!</p>
      <p>Best regards,<br>${req.user.fullName || 'The Organizer'}</p>
    `;

    const emailResult = await sendEmail(inviteeEmail, emailSubject, emailHtml);

    if (!emailResult.success) {
      // Even if email fails, invitation is saved. Could log or notify organizer.
      console.warn(`Failed to send invitation email to ${inviteeEmail}: ${emailResult.error}`);
    }

    res.status(200).json({
      message: `Invitation sent successfully to ${inviteeEmail} for ${event.eventName}`,
      invitation: newInvitation,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ message: 'Server error sending invitation' });
  }
};

// @desc    Handle RSVP response from invitee (via email link)
// @route   GET /api/events/rsvp/:token/:status
// @access  Public (No auth needed, uses token)
const handleRsvp = async (req, res) => {
  const { token, status } = req.params;

  if (!token) {
    return res.status(400).send('<h1>Invalid RSVP Link</h1><p>Invitation token is missing.</p>');
  }
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).send('<h1>Invalid RSVP Status</h1><p>Accepted or Rejected status required.</p>');
  }

  try {
    const invitation = await Invitation.findOne({ token });

    if (!invitation) {
      return res.status(404).send('<h1>Invitation Not Found</h1><p>This invitation link is invalid or has expired.</p>');
    }

    // Prevent re-responding if already accepted/rejected
    if (invitation.status === 'accepted' || invitation.status === 'rejected') {
      return res.status(200).send(`<h1>RSVP Already Recorded</h1><p>Your RSVP for this event has already been recorded as <strong>${invitation.status}</strong>.</p>`);
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    // Optionally, could emit a Socket.IO event to notify the organizer in real-time
    // const io = req.app.get('socketio'); // Assuming io is attached to app object
    // io.to(invitation.eventId.toString()).emit('rsvpUpdated', { eventId: invitation.eventId, newStatus: status, inviteeEmail: invitation.inviteeEmail });

    res.status(200).send(`
      <h1>RSVP Successful!</h1>
      <p>Your RSVP for the event has been recorded as <strong>${status}</strong>. Thank you!</p>
      <p><a href="/">Return to Event Planner Homepage</a></p>
    `);
  } catch (error) {
    console.error('Error handling RSVP:', error);
    res.status(500).send('<h1>Server Error</h1><p>An error occurred while processing your RSVP. Please try again later.</p>');
  }
};

module.exports = {
  createEvent,
  sendInvitation,
  handleRsvp,
};