/**
 * MESSAGE MODEL
 * =============
 * Represents a single chat message in a room.
 * 
 * KEY CONCEPTS:
 * 
 * 1. Compound Index { roomId: 1, createdAt: -1 }:
 *    This is a PERFORMANCE optimization. Without it, every query for
 *    "messages in room X, sorted by newest first" would scan the ENTIRE
 *    messages collection. With the index, MongoDB can instantly jump to
 *    the right room and walk backwards through time. Think of it like
 *    the index in the back of a textbook — you don't read every page
 *    to find "MongoDB", you look it up in the index.
 *    
 *    The "1" means ascending, "-1" means descending.
 * 
 * 2. Text Index on content:
 *    Enables MongoDB's full-text search feature. After creating this index,
 *    you can search messages with:
 *      Message.find({ $text: { $search: "hello world" } })
 *    MongoDB will find all messages containing "hello" or "world" and
 *    rank them by relevance.
 * 
 * 3. Reactions as Map:
 *    reactions: { "👍": [userId1, userId2], "❤️": [userId3] }
 *    Map is perfect here because emoji keys are dynamic — we don't know
 *    in advance which emojis users will react with.
 * 
 * 4. parentMessageId (Reply threading):
 *    If this message is a reply to another message, parentMessageId
 *    points to the original. We use .populate() to fetch the parent
 *    message's content when rendering.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Which room does this message belong to?
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,    // Single-field index for quick room lookups
  },
  // Who sent this message?
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // The actual message text (or a Cloudinary URL for images/files)
  content: {
    type: String,
    required: true,
  },
  // What kind of message is this?
  type: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text',
  },
  // Array of user IDs who have "read" this message
  // Used for the ✓✓ read receipts feature
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Emoji reactions: { "👍": [userId1, userId2], "❤️": [userId3] }
  // Map type allows dynamic keys (we don't know which emojis users will pick)
  reactions: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: {},
  },
  // If this is a reply, which message is it replying to?
  parentMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
}, { timestamps: true });

// ─── INDEXES ─────────────────────────────────────────────────
// Compound index: "Give me messages in room X, newest first"
// This is the #1 most important query in a chat app
messageSchema.index({ roomId: 1, createdAt: -1 });

// Full-text index: Enables $text search on message content
messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
