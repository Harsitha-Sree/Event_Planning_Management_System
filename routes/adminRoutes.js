 
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // For authentication
const { authorizeRoles } = require('../middleware/roleMiddleware'); // For role-based authorization
const adminController = require('../controllers/adminController'); // Admin business logic

const router = express.Router();

router.get('/stats', protect, authorizeRoles('admin'), adminController.getDashboardStats);


router.get('/organizers', protect, authorizeRoles('admin'), adminController.getOrganizers);

router.get('/organizers/:id', protect, authorizeRoles('admin'), adminController.getOrganizerById);


router.patch('/organizers/status/:id', protect, authorizeRoles('admin'), adminController.updateOrganizerStatus);


router.delete('/organizers/:id', protect, authorizeRoles('admin'), adminController.deleteOrganizer);



router.get('/vendors', protect, authorizeRoles('admin'), adminController.getVendors);


router.get('/vendors/:id', protect, authorizeRoles('admin'), adminController.getVendorById);


router.patch('/vendors/approve/:id', protect, authorizeRoles('admin'), adminController.updateVendorApprovalStatus);


router.delete('/vendors/:id', protect, authorizeRoles('admin'), adminController.deleteVendor);


router.get('/events', protect, authorizeRoles('admin'), adminController.getEvents);


router.get('/events/:id', protect, authorizeRoles('admin'), adminController.getEventById);


router.delete('/events/:id', protect, authorizeRoles('admin'), adminController.deleteEvent);


module.exports = router;