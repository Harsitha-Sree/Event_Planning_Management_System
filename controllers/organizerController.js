 
const User = require('../models/User');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const VendorProfile = require('../models/VendorProfile');
const Message = require('../models/Message');
const mongoose = require('mongoose');


const getOrganizerDashboardStats = async (req, res) => {
  const organizerId = req.user.id;

  try {
    const totalEvents = await Event.countDocuments({ organizerId });

    // Calculate pending RSVPs across all events for this organizer
    const pendingRsvpsResult = await Event.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(organizerId) } },
      {
        $lookup: {
          from: 'invitations', // The collection name for invitations
          localField: '_id',
          foreignField: 'eventId',
          as: 'invitations',
        },
      },
      { $unwind: { path: '$invitations', preserveNullAndEmptyArrays: true } }, // Deconstruct invitations, keep events with no invites
      { $match: { 'invitations.status': 'pending' } },
      { $count: 'pendingRsvps' },
    ]);
    const pendingRsvps = pendingRsvpsResult.length > 0 ? pendingRsvpsResult[0].pendingRsvps : 0;

    // Count unique vendors contacted by this organizer
    const vendorsContactedResult = await Message.aggregate([
      { $match: { senderId: new mongoose.Types.ObjectId(organizerId) } },
      {
        $lookup: {
          from: 'users', // The collection name for users
          localField: 'receiverId',
          foreignField: '_id',
          as: 'receiverInfo',
        },
      },
      { $unwind: '$receiverInfo' },
      { $match: { 'receiverInfo.role': 'vendor' } },
      { $group: { _id: '$receiverId' } }, // Group by receiverId to get unique vendors
      { $count: 'vendorsContacted' },
    ]);
    const vendorsContacted = vendorsContactedResult.length > 0 ? vendorsContactedResult[0].vendorsContacted : 0;


    res.status(200).json({
      totalEvents,
      pendingRsvps,
      vendorsContacted,
    });
  } catch (error) {
    console.error('Error fetching organizer dashboard stats:', error);
    res.status(500).json({ message: 'Server error fetching organizer dashboard stats' });
  }
};

// @desc    Get all events created by the authenticated Organizer
// @route   GET /api/organizer/events
// @access  Private (Organizer only)
const getOrganizerEvents = async (req, res) => {
  const organizerId = req.user.id;

  try {
    const events = await Event.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(organizerId) } },
      {
        $lookup: {
          from: 'invitations', // The collection name for invitations
          localField: '_id',
          foreignField: 'eventId',
          as: 'invitations',
        },
      },
      {
        $addFields: {
          rsvpSummary: {
            accepted: {
              $size: { $filter: { input: '$invitations', as: 'inv', cond: { $eq: ['$$inv.status', 'accepted'] } } }
            },
            pending: {
              $size: { $filter: { input: '$invitations', as: 'inv', cond: { $eq: ['$$inv.status', 'pending'] } } }
            },
            rejected: {
              $size: { $filter: { input: '$invitations', as: 'inv', cond: { $eq: ['$$inv.status', 'rejected'] } } }
            },
          },
        },
      },
      { $project: { invitations: 0 } }, // Exclude raw invitations array
      { $sort: { date: -1, time: -1 } } // Sort by most recent event date/time
    ]);

    res.status(200).json({
      message: 'Organizer events fetched successfully',
      events,
    });
  } catch (error) {
    console.error('Error fetching organizer events:', error);
    res.status(500).json({ message: 'Server error fetching organizer events' });
  }
};

// @desc    Get all approved vendors for the Organizer to browse
// @route   GET /api/organizer/vendors
// @access  Private (Organizer only)
const getApprovedVendors = async (req, res) => {
  const { category, location } = req.query;
  let query = { isApproved: true }; // Only show approved vendors

  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }
  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  try {
    const vendors = await VendorProfile.find(query)
      .populate('userId', 'email fullName') // Optionally populate some user data
      .sort({ companyName: 1 });

    res.status(200).json({
      message: 'Approved vendors fetched successfully',
      vendors,
    });
  } catch (error) {
    console.error('Error fetching approved vendors for organizer:', error);
    res.status(500).json({ message: 'Server error fetching vendors' });
  }
};


module.exports = {
  getOrganizerDashboardStats,
  getOrganizerEvents,
  getApprovedVendors,
};