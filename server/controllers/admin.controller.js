/**
 * ADMIN CONTROLLER
 * =================
 * Admin-only operations. All routes using this controller
 * are protected by BOTH authMiddleware AND adminMiddleware.
 * 
 * WHY ADMIN FEATURES?
 * - Moderation is essential for any chat app
 * - Banning removes toxic users from the platform
 * - Message deletion handles inappropriate content
 * - Stats give admins an overview of platform health
 */

const User = require('../models/User.model');
const Message = require('../models/Message.model');
const Room = require('../models/Room.model');

/**
 * LIST USERS — Get all users with their status
 * GET /api/admin/users
 */
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * BAN / UNBAN USER — Toggle a user's banned status
 * PATCH /api/admin/users/:id/ban
 * Body: { isBanned: true/false }
 * 
 * Also disconnects the user's active socket connections
 * so they're immediately kicked from the chat.
 */
exports.banUser = async (req, res) => {
  try {
    const { isBanned } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: isBanned !== undefined ? isBanned : true },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Disconnect their active sockets (kicks them immediately)
    const io = req.app.get('io');
    if (io) {
      const sockets = await io.fetchSockets();
      sockets.forEach(s => {
        if (s.user?._id?.toString() === req.params.id) {
          s.disconnect(true);
        }
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE MESSAGE — Remove a message by ID
 * DELETE /api/admin/messages/:id
 */
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Notify the room that a message was deleted
    const io = req.app.get('io');
    if (io) {
      io.to(message.roomId.toString()).emit('message_deleted', {
        messageId: message._id,
      });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * STATS — Get platform statistics
 * GET /api/admin/stats
 */
exports.getStats = async (req, res) => {
  try {
    const [userCount, roomCount, messageCount, onlineCount] = await Promise.all([
      User.countDocuments(),
      Room.countDocuments(),
      Message.countDocuments(),
      User.countDocuments({ status: 'online' }),
    ]);

    res.json({ userCount, roomCount, messageCount, onlineCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
