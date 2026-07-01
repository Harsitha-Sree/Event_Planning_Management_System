const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User'); // User model for authentication
const Message = require('./models/Message'); // Message model for saving chat
const Vendor = require('./models/Vendor'); // ADD THIS: Import Vendor model

dotenv.config(); // Load environment variables

// Map to store connected users: { userId: socketId }
const connectedUsers = new Map();

// Helper to get a consistent chat room ID for two users
const getChatRoomId = (userId1, userId2) => {
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return sortedIds.join('-');
};

const initSocket = (server) => {
  // Initialize Socket.IO server and attach it to the HTTP server
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for development, specify your frontend URL in production
      methods: ['GET', 'POST'],
    },
  });

  // --- Socket.IO Middleware for Authentication ---
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      console.log('Socket.IO: Authentication error - No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user from DB to ensure they still exist and are active
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.log(`Socket.IO: Authentication error - User ${decoded.id} not found`);
        return next(new Error('Authentication error: User not found'));
      }

      if (user.status === 'suspended') {
        console.log(`Socket.IO: Authentication error - User ${decoded.id} suspended`);
        return next(new Error('Authentication error: Your account has been suspended.'));
      }

      // Attach user info to the socket object
      socket.user = {
        id: user._id.toString(),
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        companyName: user.companyName, // if vendor
      };
      next();
    } catch (error) {
      console.error('Socket.IO: Authentication error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      }
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // --- Socket.IO Connection Handler ---
  io.on('connection', (socket) => {
    console.log(`User ${socket.user.fullName} (${socket.user.id}) connected via Socket.IO`);

    // Store the user's socket ID
    connectedUsers.set(socket.user.id, socket.id);

    // Let the user join their own room (for general notifications)
    socket.join(socket.user.id);

    // Listen for 'sendMessage' event from clients
    socket.on('sendMessage', async (messageData, callback) => {
      const { receiverId, message } = messageData;
      const senderId = socket.user.id; // Sender is the authenticated user

      // ===== DEBUG LOGGING =====
      console.log('\n========== MESSAGE DEBUG ==========');
      console.log('Sender ID:', senderId);
      console.log('Sender role:', socket.user.role);
      console.log('Receiver ID (original):', receiverId);
      console.log('Receiver ID type:', typeof receiverId);
      console.log('Receiver ID length:', receiverId ? receiverId.length : 'N/A');
      console.log('Message:', message);

      // Basic validation
      if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
        console.error(`❌ Invalid receiverId: ${receiverId}`);
        return callback({ status: 'error', message: 'Invalid receiver ID' });
      }
      if (!message || message.trim() === '') {
        return callback({ status: 'error', message: 'Message cannot be empty' });
      }

      try {
        let actualReceiverId = receiverId;
        
        // ===== FIX: Check if receiverId is a Vendor _id and resolve to userId =====
        console.log('🔍 Checking if receiver ID is a vendor...');
        const vendor = await Vendor.findById(receiverId);
        
        if (vendor) {
          console.log('✅ Found vendor! Resolving to userId...');
          console.log('   Vendor _id:', vendor._id);
          console.log('   Vendor userId:', vendor.userId);
          console.log('   Vendor name:', vendor.companyName);
          actualReceiverId = vendor.userId.toString();
          console.log('   Resolved receiver ID:', actualReceiverId);
        } else {
          console.log('ℹ️  Not a vendor ID, treating as user ID');
        }

        console.log('Final Receiver ID:', actualReceiverId);
        console.log('===================================\n');

        // Now find the actual user with the resolved ID
        console.log(`🔍 Looking for user with ID: ${actualReceiverId}`);
        const receiver = await User.findById(actualReceiverId);
        
        if (!receiver) {
          console.error(`❌ Recipient user not found with ID: ${actualReceiverId}`);
          
          // Debug info
          const totalUsers = await User.countDocuments();
          const totalVendors = await User.countDocuments({ role: 'vendor' });
          console.log(`📊 Database stats: ${totalUsers} total users, ${totalVendors} vendors`);
          
          return callback({ status: 'error', message: 'Recipient user not found in database' });
        }

        console.log('✅ Receiver found:', {
          id: receiver._id,
          role: receiver.role,
          name: receiver.companyName || receiver.businessName || receiver.fullName,
          status: receiver.status
        });

        if (receiver.status === 'suspended' || receiver.status === 'deleted') {
          return callback({ status: 'error', message: 'Cannot send message to an inactive account.' });
        }

        // Save message to database with the ACTUAL user IDs
        const newMessage = new Message({
          senderId: new mongoose.Types.ObjectId(senderId),
          receiverId: new mongoose.Types.ObjectId(actualReceiverId), // Use resolved ID
          message: message.trim(),
          timestamp: new Date(),
          read: false,
        });
        await newMessage.save();

        console.log('✅ Message saved to database:', newMessage._id);

        // Prepare message object to send to clients
        const messageToSend = {
          _id: newMessage._id,
          senderId: senderId,
          receiverId: actualReceiverId, // Use resolved ID
          message: newMessage.message,
          timestamp: newMessage.timestamp.toISOString(),
        };

        // Emit 'receiveMessage' to the sender (to update their own chat window)
        io.to(senderId).emit('receiveMessage', messageToSend);

        // Emit 'receiveMessage' to the receiver if they are online
        if (connectedUsers.has(actualReceiverId)) {
          io.to(actualReceiverId).emit('receiveMessage', messageToSend);
          console.log(`✅ Message sent from ${senderId} to online user ${actualReceiverId}`);
        } else {
          console.log(`📤 Message sent from ${senderId} to offline user ${actualReceiverId}`);
        }

        // Send confirmation back to the sender client
        callback({ status: 'ok', message: 'Message sent successfully', messageData: messageToSend });

      } catch (error) {
        console.error('❌ Error saving or sending message via Socket.IO:', error);
        console.error('Error stack:', error.stack);
        callback({ status: 'error', message: `Failed to send message: ${error.message}` });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.fullName} (${socket.user.id}) disconnected`);
      // Remove the user's socket ID from connectedUsers map
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
    });
  });

  return io;
};

module.exports = initSocket;