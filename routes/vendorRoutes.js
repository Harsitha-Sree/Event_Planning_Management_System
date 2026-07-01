 
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // For authentication
const { authorizeRoles } = require('../middleware/roleMiddleware'); // For role-based authorization
const vendorController = require('../controllers/vendorController'); // Vendor business logic
const { uploadVendorProfile } = require('../utils/uploadHandler'); // For vendor profile photo and service photo uploads

const router = express.Router();


router.get('/stats', protect, authorizeRoles('vendor'), vendorController.getVendorDashboardStats);


router.get('/profile', protect, authorizeRoles('vendor'), vendorController.getVendorProfile);


router.post('/profile', protect, authorizeRoles('vendor'), uploadVendorProfile, vendorController.createVendorProfile);


router.put('/profile', protect, authorizeRoles('vendor'), uploadVendorProfile, vendorController.updateVendorProfile);


module.exports = router;