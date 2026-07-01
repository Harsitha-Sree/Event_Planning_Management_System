 
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); 
const { authorizeRoles } = require('../middleware/roleMiddleware'); 
const messageController = require('../controllers/messageController'); 

const router = express.Router();

// All routes in this file are protected and require either 'organizer' or 'vendor' role.
// Admin role usually doesn't participate in direct chats.

// @route   GET /api/messages/conversations
// @desc    Get a list of all active conversations for the authenticated user
// @access  Private (Organizer or Vendor)
router.get('/conversations', protect, authorizeRoles('organizer', 'vendor'), messageController.getConversations);

// @route   GET /api/messages/:chatPartnerId
// @desc    Get message history between the authenticated user and a specific partner
// @access  Private (Organizer or Vendor)
router.get('/:chatPartnerId', protect, authorizeRoles('organizer', 'vendor'), messageController.getMessagesByPartner);

// @route   POST /api/messages/send
// @desc    (Optional REST fallback) Send a message to a specific partner
// @access  Private (Organizer or Vendor)
// Note: Primary real-time sending is handled by Socket.IO. This is a fallback/alternative.
router.post('/send', protect, authorizeRoles('organizer', 'vendor'), messageController.sendMessage);


module.exports = router;