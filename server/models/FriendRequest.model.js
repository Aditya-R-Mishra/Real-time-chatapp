/**
 * FRIEND REQUEST MODEL
 * ====================
 * Manages friend requests between users.
 * 
 * Flow:
 * 1. User A sends request to User B -> status: 'pending'
 * 2. User B accepts -> status: 'accepted' (both users added to each other's friends array)
 * 3. User B rejects -> status: 'rejected'
 */

const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

// Prevent duplicate requests between same users
friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
