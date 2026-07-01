 
const User = require('../models/User'); 
const VendorProfile = require('../models/VendorProfile'); // Assuming VendorProfile model is defined
const Event = require('../models/Event'); // Assuming Event model is defined
const Invitation = require('../models/Invitation'); // Assuming Invitation model is defined
const mongoose = require('mongoose'); // Needed for isValidObjectId


const getDashboardStats = async (req, res) => {
  try {
    const organizerCount = await User.countDocuments({ role: 'organizer' });
    const vendorCount = await User.countDocuments({ role: 'vendor' });
    const eventCount = await Event.countDocuments();

    res.status(200).json({
      organizerCount,
      vendorCount,
      eventCount,
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
};


const getOrganizers = async (req, res) => {
  const { fullName, email, status } = req.query;
  let query = { role: 'organizer' };

  if (fullName) {
    query.fullName = { $regex: fullName, $options: 'i' }; 
  }
  if (email) {
    query.email = { $regex: email, $options: 'i' };
  }
  if (status && ['active', 'suspended', 'deleted'].includes(status)) {
    query.status = status;
  }

  try {
    // Aggregation to count events for each organizer directly in the query
    const organizers = await User.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'events', // The collection name for events (usually lowercase, plural of model name)
          localField: '_id',
          foreignField: 'organizerId',
          as: 'events',
        },
      },
      {
        $addFields: {
          eventsCount: { $size: '$events' },
        },
      },
      {
        $project: {
          password: 0, // Exclude password from output
          events: 0,   // Exclude the actual events array if only count is needed for table view
        },
      },
      { $sort: { createdAt: -1 } } // Sort by most recent
    ]);

    res.status(200).json({
      message: 'Organizers fetched successfully',
      organizers,
    });
  } catch (error) {
    console.error('Error fetching organizers:', error);
    res.status(500).json({ message: 'Server error fetching organizers' });
  }
};

// @desc    Get single organizer details for Admin
// @route   GET /api/admin/organizers/:id
// @access  Private (Admin only)
const getOrganizerById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Organizer ID' });
  }

  try {
    const organizer = await User.findById(id).select('-password'); // Exclude password

    if (!organizer || organizer.role !== 'organizer') {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    // Populate events created by this organizer with RSVP summary
    const events = await Event.aggregate([
      { $match: { organizerId: new mongoose.Types.ObjectId(id) } },
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
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({
      ...organizer._doc, // Spread existing organizer fields
      events,            // Add events array
    });
  } catch (error) {
    console.error(`Error fetching organizer ${id} details:`, error);
    res.status(500).json({ message: 'Server error fetching organizer details' });
  }
};

// @desc    Update organizer account status (active, suspended, deleted)
// @route   PATCH /api/admin/organizers/status/:id
// @access  Private (Admin only)
const updateOrganizerStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Expected: 'active', 'suspended', 'deleted'

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Organizer ID' });
  }
  if (!status || !['active', 'suspended', 'deleted'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  try {
    const organizer = await User.findById(id);

    if (!organizer || organizer.role !== 'organizer') {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    organizer.status = status;
    await organizer.save();

    res.status(200).json({
      message: `Organizer ${organizer.fullName}'s status updated to ${status}`,
      organizer: { id: organizer._id, status: organizer.status },
    });
  } catch (error) {
    console.error(`Error updating organizer ${id} status:`, error);
    res.status(500).json({ message: 'Server error updating organizer status' });
  }
};

// @desc    Delete an organizer account
// @route   DELETE /api/admin/organizers/:id
// @access  Private (Admin only)
const deleteOrganizer = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Organizer ID' });
  }

  try {
    const organizer = await User.findById(id);

    if (!organizer || organizer.role !== 'organizer') {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    // --- Perform cascading deletes for associated data ---
    // 1. Find all events created by this organizer
    const organizerEvents = await Event.find({ organizerId: id }).select('_id');
    const eventIds = organizerEvents.map(event => event._id);

    // 2. Delete all invitations related to these events
    if (eventIds.length > 0) {
      await Invitation.deleteMany({ eventId: { $in: eventIds } });
    }

    // 3. Delete all events created by this organizer
    await Event.deleteMany({ organizerId: id });

    // 4. Delete messages where this organizer is sender or receiver (optional, depending on message ownership)
    // If messages are strictly between an organizer and a vendor, deleting the user might not delete all messages.
    // However, if we delete the user, their messages become less meaningful.
    await Message.deleteMany({ $or: [{ senderId: id }, { receiverId: id }] });

    // 5. Finally, delete the organizer's user account
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: 'Organizer and all associated data deleted successfully' });
  } catch (error) {
    console.error(`Error deleting organizer ${id}:`, error);
    res.status(500).json({ message: 'Server error deleting organizer' });
  }
};

// @desc    Get all vendors for Admin
// @route   GET /api/admin/vendors
// @access  Private (Admin only)
const getVendors = async (req, res) => {
  const { companyName, category, isApproved } = req.query;
  let query = {};

  if (companyName) {
    query.companyName = { $regex: companyName, $options: 'i' };
  }
  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }
  if (isApproved !== undefined) {
    query.isApproved = isApproved === 'true'; // Convert string 'true'/'false' to boolean
  }

  try {
    const vendors = await VendorProfile.find(query)
      .populate('userId', 'email fullName status') // Populate user details like email, status
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Vendors fetched successfully',
      vendors,
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Server error fetching vendors' });
  }
};

// @desc    Get single vendor details for Admin
// @route   GET /api/admin/vendors/:id
// @access  Private (Admin only)
const getVendorById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Vendor ID' });
  }

  try {
    const vendor = await VendorProfile.findById(id).populate('userId', 'email fullName status');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    res.status(200).json(vendor);
  } catch (error) {
    console.error(`Error fetching vendor ${id} details:`, error);
    res.status(500).json({ message: 'Server error fetching vendor details' });
  }
};

// @desc    Update vendor approval status
// @route   PATCH /api/admin/vendors/approve/:id
// @access  Private (Admin only)
const updateVendorApprovalStatus = async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body; // Expected: true or false

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Vendor ID' });
  }
  if (typeof isApproved !== 'boolean') {
    return res.status(400).json({ message: 'Invalid approval status provided (must be true/false)' });
  }

  try {
    const vendor = await VendorProfile.findById(id);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    vendor.isApproved = isApproved;
    await vendor.save();

    res.status(200).json({
      message: `Vendor ${vendor.companyName}'s approval status updated to ${isApproved}`,
      vendor: { id: vendor._id, isApproved: vendor.isApproved },
    });
  } catch (error) {
    console.error(`Error updating vendor ${id} approval status:`, error);
    res.status(500).json({ message: 'Server error updating vendor approval status' });
  }
};

// @desc    Delete a vendor profile and associated user
// @route   DELETE /api/admin/vendors/:id
// @access  Private (Admin only)
const deleteVendor = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Vendor Profile ID' });
  }

  try {
    const vendor = await VendorProfile.findById(id);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    const userId = vendor.userId;

    // Delete messages where this vendor's user is sender or receiver
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });

    // Delete the vendor profile
    await VendorProfile.findByIdAndDelete(id);

    // Delete the associated user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Vendor profile and associated user deleted successfully' });
  } catch (error) {
    console.error(`Error deleting vendor ${id}:`, error);
    res.status(500).json({ message: 'Server error deleting vendor' });
  }
};

// @desc    Get all events for Admin
// @route   GET /api/admin/events
// @access  Private (Admin only)
const getEvents = async (req, res) => {
  const { eventName, organizerName, date, rsvpStatus } = req.query;
  let query = {};

  if (eventName) {
    query.eventName = { $regex: eventName, $options: 'i' };
  }
  if (date) {
    // For date filtering, assuming 'date' query parameter is a YYYY-MM-DD string
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  try {
    let pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users', // The collection name for users
          localField: 'organizerId',
          foreignField: '_id',
          as: 'organizerInfo',
        },
      },
      { $unwind: '$organizerInfo' }, // Deconstruct the array to get a single organizer object
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
      {
        $project: {
          invitations: 0, // Exclude raw invitations
          'organizerInfo.password': 0, // Exclude organizer password
        },
      },
      {
        $addFields: { // Add organizer name directly for easier filtering (if requested)
          organizerFullName: '$organizerInfo.fullName'
        }
      }
    ];

    // Add organizerName filter if present
    if (organizerName) {
      pipeline.push({
        $match: { 'organizerInfo.fullName': { $regex: organizerName, $options: 'i' } }
      });
    }

    // Add rsvpStatus filter if present (requires aggregation on rsvpSummary)
    if (rsvpStatus && ['pending', 'accepted', 'rejected'].includes(rsvpStatus)) {
        // This is a bit more complex. We need to filter based on presence/count in summary.
        // For simplicity, we'll assume filtering based on _any_ presence, not just nonzero counts.
        // A more robust filter would check if count > 0 for a given status.
        pipeline.push({
            $match: {
                [`rsvpSummary.${rsvpStatus}`]: { $gt: 0 } // Event has at least one RSVP of this status
            }
        });
    }

    pipeline.push({ $sort: { date: -1, time: -1 } }); // Sort by most recent event date/time

    const events = await Event.aggregate(pipeline);

    // Reformat organizerInfo to be directly embedded as 'organizerId' for frontend compatibility
    const formattedEvents = events.map(event => {
        const { organizerInfo, ...rest } = event;
        return {
            ...rest,
            organizerId: organizerInfo // Frontend expects `organizerId` to be the populated object
        };
    });

    res.status(200).json({
      message: 'Events fetched successfully',
      events: formattedEvents,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server error fetching events' });
  }
};

// @desc    Get single event details for Admin
// @route   GET /api/admin/events/:id
// @access  Private (Admin only)
const getEventById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Event ID' });
  }

  try {
    const event = await Event.findById(id)
      .populate('organizerId', 'fullName email status') // Populate organizer details
      .lean(); // Use .lean() for aggregation compatibility and performance

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get invitations for this event
    const invitations = await Invitation.find({ eventId: id }).select('-__v');

    // Calculate RSVP summary
    const rsvpSummary = {
      accepted: invitations.filter(inv => inv.status === 'accepted').length,
      pending: invitations.filter(inv => inv.status === 'pending').length,
      rejected: invitations.filter(inv => inv.status === 'rejected').length,
    };

    res.status(200).json({
      ...event,
      rsvpSummary,
      invitedGuests: invitations, // Include all invitation details
    });
  } catch (error) {
    console.error(`Error fetching event ${id} details:`, error);
    res.status(500).json({ message: 'Server error fetching event details' });
  }
};

// @desc    Delete an event
// @route   DELETE /api/admin/events/:id
// @access  Private (Admin only)
const deleteEvent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Event ID' });
  }

  try {
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Delete all associated invitations first
    await Invitation.deleteMany({ eventId: id });

    // Then delete the event itself
    await Event.findByIdAndDelete(id);

    res.status(200).json({ message: 'Event and all associated invitations deleted successfully' });
  } catch (error) {
    console.error(`Error deleting event ${id}:`, error);
    res.status(500).json({ message: 'Server error deleting event' });
  }
};

module.exports = {
  getDashboardStats,
  getOrganizers,
  getOrganizerById,
  updateOrganizerStatus,
  deleteOrganizer,
  getVendors,
  getVendorById,
  updateVendorApprovalStatus,
  deleteVendor,
  getEvents,
  getEventById,
  deleteEvent,
};