 
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // For authentication
const { authorizeRoles } = require('../middleware/roleMiddleware'); // For role-based authorization
const organizerController = require('../controllers/organizerController'); // Organizer business logic

const router = express.Router();


router.get('/stats', protect, authorizeRoles('organizer'), organizerController.getOrganizerDashboardStats);


router.get('/events', protect, authorizeRoles('organizer'), organizerController.getOrganizerEvents);


router.get('/vendors', protect, authorizeRoles('organizer'), organizerController.getApprovedVendors);


module.exports = router;