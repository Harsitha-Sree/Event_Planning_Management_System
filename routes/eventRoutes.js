const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware'); // For authentication
const { authorizeRoles } = require('../middleware/roleMiddleware'); // For role-based authorization

// Import controllers
const eventController = require('../controllers/eventController'); // Event business logic

// Import utilities
const { uploadEventPhoto } = require('../utils/uploadHandler'); // For event photo uploads
const sendEmail = require('../utils/sendEmail'); // Email utility
const crypto = require('crypto'); // For generating tokens

// Import models
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');

// --- Event Creation and Management ---

// @route   POST /api/events/create
// @desc    Create a new event
// @access  Private (Organizer only)
router.post('/create', protect, authorizeRoles('organizer'), uploadEventPhoto, eventController.createEvent);

// @route   POST /api/events/:eventId/invite
// @desc    Send event invitation with email
// @access  Private (Organizer only)
router.post('/:eventId/invite', protect, authorizeRoles('organizer'), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { inviteeEmail } = req.body;
        const organizerId = req.user.id; // From protect middleware

        console.log('Invitation request received:', { eventId, inviteeEmail, organizerId });

        // Validate email
        if (!inviteeEmail || !inviteeEmail.includes('@')) {
            return res.status(400).json({ message: 'Valid email address is required' });
        }

        // Find the event and verify ownership
        const event = await Event.findOne({ _id: eventId, organizerId });
        if (!event) {
            console.log('Event not found or not owned by user');
            return res.status(404).json({ message: 'Event not found' });
        }

        console.log('Event found:', event.eventName);

        // Check if invitation already exists
        const existingInvitation = await Invitation.findOne({ 
            eventId, 
            inviteeEmail: inviteeEmail.toLowerCase() 
        });

        if (existingInvitation) {
            console.log('Invitation already exists for this email');
            return res.status(409).json({ 
                message: 'This email has already been invited to this event' 
            });
        }

        // Generate unique token for RSVP
        const invitationToken = crypto.randomBytes(32).toString('hex');

        // Create invitation in database
        const invitation = new Invitation({
            eventId,
            organizerId,
            inviteeEmail: inviteeEmail.toLowerCase(),
            token: invitationToken,
            status: 'pending',
            createdAt: new Date()
        });

        await invitation.save();
        console.log('Invitation saved to database');

        // Prepare email content
        const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:5000'}/guest/rsvp.html?token=${invitationToken}`;
        
        const emailSubject = `You're Invited to ${event.eventName}!`;
        
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .event-details { background: white; padding: 20px; border-radius: 8px; 
                                    margin: 20px 0; border-left: 4px solid #667eea; }
                    .event-details h3 { margin-top: 0; color: #667eea; }
                    .event-details p { margin: 10px 0; }
                    .btn { display: inline-block; background: #667eea; color: white; 
                           padding: 15px 40px; text-decoration: none; border-radius: 5px; 
                           margin: 20px 0; font-weight: bold; }
                    .btn:hover { background: #5568d3; }
                    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
                    .icon { font-size: 18px; margin-right: 8px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 You're Invited!</h1>
                    </div>
                    
                    <div class="content">
                        <p>Hello!</p>
                        <p>You've been invited to an exciting event:</p>
                        
                        <div class="event-details">
                            <h3>${event.eventName}</h3>
                            <p><span class="icon">📅</span><strong>Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}</p>
                            <p><span class="icon">🕐</span><strong>Time:</strong> ${event.time}</p>
                            <p><span class="icon">📍</span><strong>Venue:</strong> ${event.venueName || 'To be announced'}</p>
                        </div>
                        
                        <p>We would love to have you join us! Please Send ( Accepted ) Response </p>
                        
                     
                        
                       
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send the email
        console.log(`Sending invitation email to ${inviteeEmail}...`);
        const emailResult = await sendEmail(inviteeEmail, emailSubject, emailHtml);

        if (!emailResult.success) {
            console.error('Failed to send invitation email:', emailResult.error);
            await Invitation.findByIdAndDelete(invitation._id);
            
            return res.status(500).json({ 
                message: 'Failed to send invitation email. Please try again.',
                error: emailResult.error 
            });
        }

        console.log(`✓ Invitation email sent successfully to ${inviteeEmail}`);

        res.status(201).json({
            message: 'Invitation sent successfully',
            invitation: {
                id: invitation._id,
                inviteeEmail: invitation.inviteeEmail,
                status: invitation.status,
                emailSent: true
            }
        });

    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ 
            message: 'Failed to send invitation', 
            error: error.message 
        });
    }
});

// --- RSVP Management Routes ---

// @route   GET /api/events/:eventId/invitations
// @desc    Get all invitations for an event (for organizers to manage RSVPs)
// @access  Private (Organizer only)
router.get('/:eventId/invitations', protect, authorizeRoles('organizer'), async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id; // From protect middleware

        console.log('=== GET Invitations for Event ===');
        console.log('Event ID:', eventId);
        console.log('User ID:', userId);

        // Verify the event exists and belongs to the organizer
        // FIXED: Using organizerId instead of organizer
        const event = await Event.findOne({ _id: eventId, organizerId: userId });
        
        if (!event) {
            console.log('Event not found or user is not the organizer');
            return res.status(404).json({ 
                message: 'Event not found or you do not have permission to view this event' 
            });
        }

        console.log('Event found:', event.eventName);

        // FIXED: Using eventId to match your Invitation schema
        const invitations = await Invitation.find({ eventId: eventId })
            .sort({ createdAt: -1 }); // Most recent first

        console.log(`Found ${invitations.length} invitations`);

        // Format the response
        const formattedInvitations = invitations.map(inv => ({
            _id: inv._id,
            inviteeEmail: inv.inviteeEmail,
            status: inv.status,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt
        }));

        res.status(200).json({
            success: true,
            count: invitations.length,
            invitations: formattedInvitations,
            event: {
                _id: event._id,
                eventName: event.eventName,
                date: event.date
            }
        });

    } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ 
            message: 'Failed to fetch invitations',
            error: error.message 
        });
    }
});

// @route   PATCH /api/events/:eventId/invitations/:invitationId/status
// @desc    Update invitation status (organizer can manually change RSVP status)
// @access  Private (Organizer only)
router.patch('/:eventId/invitations/:invitationId/status', protect, authorizeRoles('organizer'), async (req, res) => {
    try {
        const { eventId, invitationId } = req.params;
        const { status } = req.body;
        const userId = req.user.id; // From protect middleware

        console.log('=== UPDATE Invitation Status ===');
        console.log('Event ID:', eventId);
        console.log('Invitation ID:', invitationId);
        console.log('New Status:', status);
        console.log('User ID:', userId);

        // Validate status
        const validStatuses = ['pending', 'accepted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }

        // Verify the event exists and belongs to the organizer
        // FIXED: Using organizerId instead of organizer
        const event = await Event.findOne({ _id: eventId, organizerId: userId });
        
        if (!event) {
            return res.status(404).json({ 
                message: 'Event not found or you do not have permission to modify this event' 
            });
        }

        console.log('Event verified, updating invitation...');

        // FIXED: Using eventId to match your Invitation schema
        const invitation = await Invitation.findOneAndUpdate(
            { 
                _id: invitationId,
                eventId: eventId 
            },
            { 
                status: status,
                updatedAt: new Date()
            },
            { 
                new: true // Return updated document
            }
        );

        if (!invitation) {
            return res.status(404).json({ 
                message: 'Invitation not found' 
            });
        }

        console.log('Invitation updated successfully');

        res.status(200).json({
            success: true,
            message: `Invitation status updated to ${status}`,
            invitation: {
                _id: invitation._id,
                inviteeEmail: invitation.inviteeEmail,
                status: invitation.status,
                updatedAt: invitation.updatedAt
            }
        });

    } catch (error) {
        console.error('Error updating invitation status:', error);
        res.status(500).json({ 
            message: 'Failed to update invitation status',
            error: error.message 
        });
    }
});

// @route   DELETE /api/events/:eventId/invitations/:invitationId
// @desc    Delete an invitation
// @access  Private (Organizer only)
router.delete('/:eventId/invitations/:invitationId', protect, authorizeRoles('organizer'), async (req, res) => {
    try {
        const { eventId, invitationId } = req.params;
        const userId = req.user.id;

        // Verify the event belongs to the organizer
        const event = await Event.findOne({ _id: eventId, organizerId: userId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Find and delete the invitation
        const invitation = await Invitation.findOneAndDelete({ 
            _id: invitationId, 
            eventId 
        });

        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        console.log(`Invitation deleted: ${invitation.inviteeEmail} for event ${event.eventName}`);

        res.json({
            message: 'Invitation deleted successfully',
            deletedInvitation: {
                id: invitation._id,
                inviteeEmail: invitation.inviteeEmail
            }
        });

    } catch (error) {
        console.error('Error deleting invitation:', error);
        res.status(500).json({ 
            message: 'Failed to delete invitation', 
            error: error.message 
        });
    }
});

// --- Alternative/Backup Endpoint ---

// @route   GET /api/events/organizer/events/:eventId/rsvps
// @desc    Alternative endpoint to get RSVPs (backup route)
// @access  Private (Organizer only)
router.get('/organizer/events/:eventId/rsvps', protect, authorizeRoles('organizer'), async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        console.log('=== GET RSVPs (Alternative Endpoint) ===');
        console.log('Event ID:', eventId);

        const event = await Event.findOne({ _id: eventId, organizerId: userId });
        
        if (!event) {
            return res.status(404).json({ 
                message: 'Event not found' 
            });
        }

        const invitations = await Invitation.find({ eventId: eventId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            invitations: invitations,
            rsvps: invitations // Alias for compatibility
        });

    } catch (error) {
        console.error('Error fetching RSVPs:', error);
        res.status(500).json({ 
            message: 'Failed to fetch RSVPs',
            error: error.message 
        });
    }
});

// --- Public RSVP Handling ---

// @route   GET /api/events/rsvp/:token/:status
// @desc    Handle RSVP response from invitee via email link
// @access  Public (No authentication needed, token is used for validation)
router.get('/rsvp/:token/:status', eventController.handleRsvp);

module.exports = router;