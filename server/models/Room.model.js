/**
 * ROOM MODEL
 * ==========
 * A "Room" is a container for a conversation. Think of it like:
 * - Slack channels (#general, #random)
 * - WhatsApp group chats
 * - Or a private 1-on-1 DM
 * 
 * KEY CONCEPTS:
 * 
 * 1. ObjectId references (ref: 'User'):
 *    Instead of embedding entire user objects, we store just their _id.
 *    This is like a "foreign key" in SQL. When we need the full user data,
 *    we use .populate('members') to "join" the data.
 * 
 * 2. isPrivate flag:
 *    DMs are rooms with isPrivate: true and exactly 2 members.
 *    Public rooms are visible to everyone and can have many members.
 * 
 * 3. Deterministic DM naming:
 *    For DMs, the room name is the two user IDs sorted and joined with '_'.
 *    This ensures that user A→B and user B→A always find the SAME room
 *    instead of creating duplicates.
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  // Array of User ObjectIds — who is a member of this room
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',    // ← This tells Mongoose "these IDs refer to User documents"
  }],
  isPrivate: {
    type: Boolean,
    default: false,   // Public rooms are default; DMs are private
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
