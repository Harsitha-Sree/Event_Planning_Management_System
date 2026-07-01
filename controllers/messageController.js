 
const Message = require('../models/Message');
const User = require('../models/User'); 
const mongoose = require('mongoose');


const getConversations = async (req, res) => {
  const userId = req.user.id; // Authenticated user's ID

  try {
    // Aggregation pipeline to get unique chat partners and their last message
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: new mongoose.Types.ObjectId(userId) }, { receiverId: new mongoose.Types.ObjectId(userId) }],
        },
      },
      {
        $sort: { timestamp: -1 }, // Sort by most recent message first
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
              then: '$receiverId',
              else: '$senderId',
            },
          },
          lastMessage: { $first: '$message' }, // Get the last message in the conversation
          lastMessageTimestamp: { $first: '$timestamp' }, // Get its timestamp
          // Could also add 'unreadCount': { $sum: { $cond: [{ $and: [{ $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] }, { $eq: ['$read', false] }] }, 1, 0] } }
        },
      },
      {
        $lookup: {
          from: 'users', // The name of the users collection in MongoDB
          localField: '_id',
          foreignField: '_id',
          as: 'partnerInfo',
        },
      },
      {
        $unwind: '$partnerInfo', // Deconstruct the partnerInfo array
      },
      {
        $project: {
          _id: 0, // Exclude the aggregation's _id
          partnerId: '$_id',
          partnerName: { // Dynamically get name based on role
            $cond: {
              if: { $eq: ['$partnerInfo.role', 'vendor'] },
              then: '$partnerInfo.companyName',
              else: '$partnerInfo.fullName',
            },
          },
          lastMessage: 1,
          lastMessageTimestamp: 1,
        },
      },
      {
        $sort: { lastMessageTimestamp: -1 }, // Sort conversations by last message time
      },
    ]);

    res.status(200).json({
      message: 'Conversations fetched successfully',
      conversations,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error fetching conversations' });
  }
};

// @desc    Get message history between the authenticated user and a specific partner
// @route   GET /api/messages/:chatPartnerId
// @access  Private (Organizer or Vendor)
const getMessagesByPartner = async (req, res) => {
  const userId = req.user.id; // Authenticated user's ID
  const { chatPartnerId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatPartnerId)) {
    return res.status(400).json({ message: 'Invalid chat partner ID' });
  }

  try {
    // Find all messages between the two users
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: chatPartnerId },
        { senderId: chatPartnerId, receiverId: userId },
      ],
    })
      .sort('timestamp') // Sort by oldest to newest
      .select('-__v'); // Exclude Mongoose version key

    // Optionally: Mark messages received by the current user as read
    await Message.updateMany(
      { receiverId: userId, senderId: chatPartnerId, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({
      message: 'Messages fetched successfully',
      messages,
    });
  } catch (error) {
    console.error('Error fetching messages by partner:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// @desc    (Socket.IO will handle real-time message sending)
//          This function is a placeholder if a REST endpoint for sending is also desired.
// @route   POST /api/messages/send
// @access  Private (Organizer or Vendor)
const sendMessage = async (req, res) => {
  // This endpoint might be used for fallbacks or if real-time is not critical for all sends.
  // The primary real-time message sending will be via Socket.IO in socket.js.
  // For demonstration, let's keep it simple and just show it's possible.
  const { receiverId, message } = req.body;
  const senderId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(receiverId) || !message) {
    return res.status(400).json({ message: 'Receiver ID and message are required' });
  }

  try {
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      timestamp: new Date(),
    });

    await newMessage.save();
    res.status(201).json({ message: 'Message sent via REST API', newMessage });
  } catch (error) {
    console.error('Error sending message via REST:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};


module.exports = {
  getConversations,
  getMessagesByPartner,
  sendMessage, // Export if you plan to use a REST fallback for sending
};