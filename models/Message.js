 
const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // References the User model
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // References the User model
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000, // Optional: Limit message length
    },
    timestamp: {
      type: Date,
      default: Date.now, // Default to current time when message is created
    },
    read: {
      type: Boolean,
      default: false, // Indicates if the message has been read by the receiver
    },
    // Optional: Could add a 'chatRoomId' if managing group chats or needing a stable identifier for a 1-on-1 chat
    // chatRoomId: {
    //   type: String, // Can be a combination of senderId and receiverId sorted, or a separate ObjectId
    //   required: true,
    //   index: true, // Index for faster chat lookup
    // }
  },
  {
    // Mongoose does not automatically add `createdAt` for schemas with a `timestamp` field.
    // If you want `createdAt` AND `updatedAt` in addition to `timestamp`, you can add `timestamps: true`.
    // However, for chat, `timestamp` is usually sufficient for creation time, and `updatedAt` is less relevant.
    // So, keeping `timestamps: true` is optional here based on exact needs.
    // timestamps: true,
  }
);

// Create an index for faster querying of messages between two users
messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, timestamp: 1 }); // Also index reverse for finding conversations
// Or, if using chatRoomId: messageSchema.index({ chatRoomId: 1, timestamp: 1 });


const Message = mongoose.model('Message', messageSchema);

module.exports = Message;