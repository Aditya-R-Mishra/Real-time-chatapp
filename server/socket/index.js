/**
 * SOCKET.IO SERVER
 * =================
 * This is the HEART of real-time messaging.
 * 
 * HTTP vs WebSockets:
 * ┌─────────────┬──────────────────────────────────────────────┐
 * │ HTTP (REST)  │ Client asks → Server answers. One-way.      │
 * │ WebSocket    │ Both sides can send data at ANY time.        │
 * └─────────────┴──────────────────────────────────────────────┘
 * 
 * Socket.io wraps WebSockets with:
 * - Automatic reconnection if the connection drops
 * - Rooms (like channels — broadcast to a subset of users)
 * - Fallback to HTTP long-polling if WebSocket isn't available
 * - Event-based API (emit/on) instead of raw binary frames
 * 
 * EVENTS IN THIS FILE:
 * ┌─────────────────────┬──────────────────────────────────────┐
 * │ Event               │ What it does                          │
 * ├─────────────────────┼──────────────────────────────────────┤
 * │ connection          │ New user connects                     │
 * │ join_room           │ User joins a chat room                │
 * │ leave_room          │ User leaves a chat room               │
 * │ send_message        │ User sends a message                  │
 * │ typing_start        │ User starts typing                    │
 * │ typing_stop         │ User stops typing                     │
 * │ message_read        │ User has read messages                │
 * │ add_reaction        │ User reacts with an emoji              │
 * │ disconnect          │ User disconnects                      │
 * └─────────────────────┴──────────────────────────────────────┘
 * 
 * BROADCASTING:
 * - io.emit()           → Sends to ALL connected users
 * - io.to(roomId).emit() → Sends to all users in a specific room
 * - socket.to(roomId).emit() → Sends to all in room EXCEPT the sender
 * - socket.emit()       → Sends only to the sender
 */

const { Server } = require('socket.io');
const { verifyAccess } = require('../utils/jwt');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const Room = require('../models/Room.model');

function initSocket(httpServer) {
  // Create Socket.io server attached to the HTTP server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // ─── AUTH MIDDLEWARE ──────────────────────────────────────
  // This runs BEFORE the 'connection' event.
  // If next(new Error()) is called, the connection is rejected.
  // The client receives a 'connect_error' event.
  io.use(async (socket, next) => {
    try {
      // Token is sent in socket.handshake.auth (not URL params — that's insecure)
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      // Verify the JWT
      const decoded = verifyAccess(token);

      // Find the user and attach to socket object
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      if (user.isBanned) return next(new Error('Account is banned'));

      socket.user = user;  // Now socket.user is available in all event handlers
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ─── CONNECTION HANDLER ───────────────────────────────────
  // This fires when a user successfully connects (after auth middleware passes)
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🟢 User connected: ${socket.user.username} (${userId})`);

    // Mark user as online in the database
    await User.findByIdAndUpdate(userId, { status: 'online' });

    // Notify ALL connected clients that this user came online
    io.emit('user_online', { userId, username: socket.user.username });

    // ─── JOIN ROOM ────────────────────────────────────────
    // When a user clicks on a room in the sidebar
    socket.on('join_room', async (roomId) => {
      // Socket.io rooms: a virtual grouping. All sockets in the same room
      // receive broadcasts to that room. One socket can be in multiple rooms.
      socket.join(roomId);

      // Also add user to room's members in DB (if not already)
      await Room.findByIdAndUpdate(roomId, {
        $addToSet: { members: userId },
      });

      // Notify room that someone joined
      socket.to(roomId).emit('user_joined_room', {
        userId,
        username: socket.user.username,
        roomId,
      });
    });

    // ─── LEAVE ROOM ───────────────────────────────────────
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user_left_room', {
        userId,
        username: socket.user.username,
        roomId,
      });
    });

    // ─── SEND MESSAGE ─────────────────────────────────────
    // This is the core of the chat app!
    socket.on('send_message', async ({ roomId, content, type = 'text', parentMessageId = null }) => {
      // Validate
      if (!content?.trim()) return;

      // Save message to MongoDB (persistence!)
      const message = await Message.create({
        roomId,
        content: content.trim(),
        type,
        senderId: userId,
        parentMessageId,
      });

      // Populate sender info and parent message (for replies)
      const populated = await Message.findById(message._id)
        .populate('senderId', 'username avatar')
        .populate({
          path: 'parentMessageId',
          populate: { path: 'senderId', select: 'username' },
        });

      // Broadcast to ALL members in the room (including sender)
      // Using io.to() instead of socket.to() because we want the sender
      // to also receive the message (with the server-generated _id and timestamp)
      io.to(roomId).emit('new_message', populated);
    });

    // ─── TYPING INDICATORS ────────────────────────────────
    // These are "fire and forget" — NOT saved to the database
    // (no one needs a permanent record of who was typing when)
    socket.on('typing', ({ roomId, isTyping }) => {
      // socket.to() sends to everyone in the room EXCEPT the sender
      // (you don't need to see "You are typing...")
      socket.to(roomId).emit('user_typing', {
        userId,
        username: socket.user.username,
        roomId,
        isTyping,
      });
    });

    // ─── READ RECEIPTS ────────────────────────────────────
    // When a user scrolls and messages become visible
    socket.on('message_read', async ({ messageIds, roomId }) => {
      if (!messageIds?.length) return;

      // $addToSet prevents duplicate entries in the readBy array
      // $ne in the filter ensures we only update messages not yet read by this user
      await Message.updateMany(
        { _id: { $in: messageIds }, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      // Notify the room so senders can update their ✓ → ✓✓
      io.to(roomId).emit('messages_read', {
        messageIds,
        readerId: userId,
      });
    });

    // ─── EMOJI REACTIONS ──────────────────────────────────
    // Toggle: click once to add reaction, click again to remove
    socket.on('toggle_reaction', async ({ messageId, emoji, roomId }) => {
      const message = await Message.findById(messageId);
      if (!message) return;

      // Get current reactors for this emoji (or empty array)
      const reactors = message.reactions.get(emoji) || [];
      const alreadyReacted = reactors.some(id => id.toString() === userId);

      if (alreadyReacted) {
        // Toggle OFF — remove user from reactors
        message.reactions.set(
          emoji,
          reactors.filter(id => id.toString() !== userId)
        );
      } else {
        // Toggle ON — add user to reactors
        message.reactions.set(emoji, [...reactors, userId]);
      }

      await message.save();

      // Broadcast updated reactions to the room
      io.to(roomId).emit('reaction_updated', {
        messageId,
        reactions: Object.fromEntries(message.reactions),
      });
    });

    // ─── DISCONNECT ───────────────────────────────────────
    // Fires when the WebSocket connection closes
    // (tab close, network drop, logout, etc.)
    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${socket.user.username}`);

      // Mark user as offline
      await User.findByIdAndUpdate(userId, { status: 'offline' });

      // Notify all clients
      io.emit('user_offline', { userId });
    });
  });

  return io;
}

module.exports = initSocket;
