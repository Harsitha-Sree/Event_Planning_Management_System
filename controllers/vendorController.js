const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const { uploadToCloudinary } = require('../utils/uploadHandler');
const { calculateProfileCompletion } = require('../utils/vendorProfileCalculator');


const getVendorDashboardStats = async (req, res) => {
  const userId = req.user.id;

  try {
    const totalMessages = await Message.countDocuments({ receiverId: userId });
    const messagesToOrganizers = await Message.countDocuments({ senderId: userId, 'receiverInfo.role': 'organizer' });
    const eventsInterestedIn = 0;

    const vendorProfile = await VendorProfile.findOne({ userId });
    let profileCompletion = 0;
    if (vendorProfile) {
      profileCompletion = calculateProfileCompletion(vendorProfile);
    }

    res.status(200).json({
      totalMessages,
      eventsInterestedIn,
      profileCompletion,
    });
  } catch (error) {
    console.error('Error fetching vendor dashboard stats:', error);
    res.status(500).json({ message: 'Server error fetching vendor dashboard stats' });
  }
};

// @desc    Get the authenticated Vendor's profile
// @route   GET /api/vendor/profile
// @access  Private (Vendor only)
const getVendorProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const vendorProfile = await VendorProfile.findOne({ userId })
      .populate('userId', 'email fullName');

    if (!vendorProfile) {
      return res.status(404).json({ message: 'Vendor profile not found. Please create your profile.' });
    }

    res.status(200).json(vendorProfile);
  } catch (error) {
    console.error('Error fetching vendor profile:', error);
    res.status(500).json({ message: 'Server error fetching vendor profile' });
  }
};

// @desc    Create a new Vendor Profile for the authenticated user
// @route   POST /api/vendor/profile
// @access  Private (Vendor only)
const createVendorProfile = async (req, res) => {
  const userId = req.user.id;
  
  // Debug logs
  console.log('=== CREATE VENDOR PROFILE DEBUG ===');
  console.log('userId:', userId);
  console.log('req.body:', req.body);
  console.log('req.files:', req.files);
  console.log('===================================');
  
  const { companyName, category, location, contactNumber, description, services: servicesJson } = req.body;
  const mainPhotoFile = req.files['photo'] ? req.files['photo'][0] : null;
  const serviceFiles = req.files['serviceFiles'] || [];

  // Basic validation
  if (!companyName || !category || !location || !contactNumber) {
    return res.status(400).json({ message: 'Please fill in all required profile fields' });
  }

  try {
    // Check if a profile already exists for this user
    const existingProfile = await VendorProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(409).json({ message: 'Vendor profile already exists for this user. Use PUT to update.' });
    }

    let mainPhotoUrl = '';
    if (mainPhotoFile) {
      console.log('Uploading main photo to local storage...');
      const uploadResult = await uploadToCloudinary(mainPhotoFile.buffer, 'vendor_photos', mainPhotoFile.originalname);
      mainPhotoUrl = uploadResult.secure_url;
      console.log('Main photo uploaded:', mainPhotoUrl);
    }

    // Process services array
    let services = [];
    if (servicesJson) {
      try {
        services = JSON.parse(servicesJson);
        console.log('Parsed services:', services);
      } catch (parseError) {
        console.error('Error parsing services JSON:', parseError);
        console.error('Services string was:', servicesJson);
        return res.status(400).json({ message: 'Invalid services data format' });
      }
    }

    // Map service files to their respective service objects
    console.log('Processing service files, count:', serviceFiles.length);
    for (let i = 0; i < services.length; i++) {
      if (typeof services[i].newPhotoIndex === 'number' && serviceFiles[services[i].newPhotoIndex]) {
        console.log(`Uploading service photo ${i} to local storage...`);
        const serviceFile = serviceFiles[services[i].newPhotoIndex];
        const uploadResult = await uploadToCloudinary(serviceFile.buffer, 'service_photos', serviceFile.originalname);
        services[i].photo = uploadResult.secure_url;
        delete services[i].newPhotoIndex;
        console.log(`Service photo ${i} uploaded:`, services[i].photo);
      } else if (services[i].photoUrl) {
        services[i].photo = services[i].photoUrl;
        delete services[i].photoUrl;
      }
    }

    console.log('Creating vendor profile with data:', {
      userId,
      companyName,
      photo: mainPhotoUrl,
      category,
      location,
      contactNumber,
      description,
      servicesCount: services.length,
      isApproved: false,
    });

    const newVendorProfile = new VendorProfile({
      userId,
      companyName,
      photo: mainPhotoUrl,
      category,
      location,
      contactNumber,
      description,
      services,
      isApproved: true,
    });

    await newVendorProfile.save();
    console.log('Vendor profile saved successfully!');

    res.status(201).json({
      message: 'Vendor profile created successfully and pending admin approval!',
      profile: newVendorProfile,
    });
  } catch (error) {
    console.error('=== ERROR CREATING VENDOR PROFILE ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('======================================');
    res.status(500).json({ 
      message: 'Server error creating vendor profile',
      error: error.message 
    });
  }
};

// @desc    Update the authenticated Vendor's profile
// @route   PUT /api/vendor/profile
// @access  Private (Vendor only)
const updateVendorProfile = async (req, res) => {
  const userId = req.user.id;
  
  // Debug logs
  console.log('=== UPDATE VENDOR PROFILE DEBUG ===');
  console.log('userId:', userId);
  console.log('req.body:', req.body);
  console.log('req.files:', req.files);
  console.log('===================================');
  
  const { companyName, category, location, contactNumber, description, services: servicesJson } = req.body;
  const mainPhotoFile = req.files['photo'] ? req.files['photo'][0] : null;
  const serviceFiles = req.files['serviceFiles'] || [];

  // Basic validation
  if (!companyName || !category || !location || !contactNumber) {
    return res.status(400).json({ message: 'Please fill in all required profile fields' });
  }

  try {
    let vendorProfile = await VendorProfile.findOne({ userId });

    if (!vendorProfile) {
      return res.status(404).json({ message: 'Vendor profile not found. Please create your profile first.' });
    }

    // Update main photo if a new file is uploaded
    if (mainPhotoFile) {
      console.log('Uploading new main photo to local storage...');
      const uploadResult = await uploadToCloudinary(mainPhotoFile.buffer, 'vendor_photos', mainPhotoFile.originalname);
      vendorProfile.photo = uploadResult.secure_url;
      console.log('Main photo updated:', vendorProfile.photo);
    }

    // Update text fields
    vendorProfile.companyName = companyName;
    vendorProfile.category = category;
    vendorProfile.location = location;
    vendorProfile.contactNumber = contactNumber;
    vendorProfile.description = description;

    // Process services array
    let newServices = [];
    if (servicesJson) {
      try {
        newServices = JSON.parse(servicesJson);
        console.log('Parsed services:', newServices);
      } catch (parseError) {
        console.error('Error parsing services JSON:', parseError);
        console.error('Services string was:', servicesJson);
        return res.status(400).json({ message: 'Invalid services data format' });
      }
    }

    // Process service photos
    console.log('Processing service files, count:', serviceFiles.length);
    for (let i = 0; i < newServices.length; i++) {
      if (typeof newServices[i].newPhotoIndex === 'number' && serviceFiles[newServices[i].newPhotoIndex]) {
        console.log(`Uploading service photo ${i} to local storage...`);
        const serviceFile = serviceFiles[newServices[i].newPhotoIndex];
        const uploadResult = await uploadToCloudinary(serviceFile.buffer, 'service_photos', serviceFile.originalname);
        newServices[i].photo = uploadResult.secure_url;
        delete newServices[i].newPhotoIndex;
        console.log(`Service photo ${i} uploaded:`, newServices[i].photo);
      } else if (newServices[i].photoUrl) {
        newServices[i].photo = newServices[i].photoUrl;
        delete newServices[i].photoUrl;
      }
    }

    vendorProfile.services = newServices;
    
    await vendorProfile.save();
    console.log('Vendor profile updated successfully!');

    res.status(200).json({
      message: 'Vendor profile updated successfully!',
      profile: vendorProfile,
    });
  } catch (error) {
    console.error('=== ERROR UPDATING VENDOR PROFILE ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('======================================');
    res.status(500).json({ 
      message: 'Server error updating vendor profile',
      error: error.message 
    });
  }
};

module.exports = {
  getVendorDashboardStats,
  getVendorProfile,
  createVendorProfile,
  updateVendorProfile,
};