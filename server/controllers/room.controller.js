/**
 * ROOM CONTROLLER
 * ================
 * Handles all room-related operations:
 * - List rooms, create rooms, get room details
 * - Create/get DM rooms (private 1-on-1 conversations)
 * - Paginated message history (cursor-based, not offset)
 * - Full-text message search
 * 
 * CURSOR-BASED PAGINATION explained:
 * Instead of "give me page 3" (offset: skip 100, limit 50),
 * we say "give me 50 messages BEFORE this timestamp."
 * 
 * Why cursor > offset?
 * - Offset is SLOW on large collections (MongoDB has to count through skipped docs)
 * - Offset gives WRONG results if new messages arrive while paginating
 * - Cursor is consistent and fast regardless of collection size
 * - This is how Slack, Discord, and WhatsApp do it
 */

const Room = require('../models/Room.model');
const Message = require('../models/Message.model');
const User = require('../models/User.model');

/**
 * LIST ROOMS — Get all public rooms (or rooms the user is a member of)
 * GET /api/rooms
 */
exports.listRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { isPrivate: false },                              // All public rooms
        { members: req.user._id, isPrivate: true },        // Private rooms the user is in
      ]
    })
      .populate('members', 'username avatar status')       // Get member details
      .populate('createdBy', 'username')
      .sort({ updatedAt: -1 });                            // Most recently active first

    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * CREATE ROOM — Create a new public room
 * POST /api/rooms
 * Body: { name, description }
 */
exports.createRoom = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const room = await Room.create({
      name: name.trim(),
      description: description || '',
      createdBy: req.user._id,
      members: [req.user._id],   // Creator is automatically a member
    });

    const populated = await room.populate('createdBy', 'username');
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Room name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET ROOM — Get details for a specific room
 * GET /api/rooms/:id
 */
exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('members', 'username avatar status')
      .populate('createdBy', 'username');

    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * JOIN ROOM — Add the current user to a room's members
 * POST /api/rooms/:id/join
 */
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: req.user._id } },  // $addToSet prevents duplicates
      { new: true }
    ).populate('members', 'username avatar status');

    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET MESSAGES — Paginated message history for a room
 * GET /api/rooms/:id/messages?before=<messageId>&limit=50
 * 
 * CURSOR-BASED PAGINATION:
 * - First load: No "before" param → get the newest 50 messages
 * - Load more: Pass before=<oldestMessageId> → get 50 messages before that one
 * - This is efficient because MongoDB uses the compound index (roomId, createdAt)
 */
exports.getMessages = async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const query = { roomId: req.params.id };

    if (before) {
      // Find the reference message's timestamp
      const ref = await Message.findById(before).lean();
      if (ref) {
        query.createdAt = { $lt: ref.createdAt };  // Only messages BEFORE this time
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })                               // Newest first
      .limit(Number(limit))
      .populate('senderId', 'username avatar')
      .populate({
        path: 'parentMessageId',                              // For reply threading
        populate: { path: 'senderId', select: 'username' },
      })
      .lean();                                                // Returns plain JS objects (faster)

    // Reverse to chronological order (oldest → newest)
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * CREATE OR GET DM — Create a private 1-on-1 conversation
 * POST /api/rooms/dm
 * Body: { targetUserId }
 * 
 * DETERMINISTIC NAMING:
 * If user A (id: "abc") DMs user B (id: "xyz"):
 *   Room name = "abc_xyz" (IDs sorted alphabetically)
 * If user B DMs user A:
 *   Room name = "abc_xyz" (same! because we sort)
 * This prevents duplicate DM rooms.
 */
exports.createOrGetDM = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id.toString();

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot DM yourself' });
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deterministic name — sort IDs so A→B and B→A produce the same room
    const dmName = [currentUserId, targetUserId].sort().join('_');

    // Find existing DM or create new one
    let room = await Room.findOne({ name: dmName, isPrivate: true });
    if (!room) {
      room = await Room.create({
        name: dmName,
        isPrivate: true,
        members: [currentUserId, targetUserId],
        createdBy: currentUserId,
      });
    }

    // Populate member details for the response
    await room.populate('members', 'username avatar status');
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * SEARCH MESSAGES — Full-text search within a room
 * GET /api/rooms/:id/search?q=hello
 * 
 * Uses MongoDB's $text operator which leverages the text index
 * we defined on the Message model.
 */
exports.searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);

    const results = await Message.find({
      roomId: req.params.id,
      $text: { $search: q },           // Full-text search
    })
      .sort({ score: { $meta: 'textScore' } })   // Sort by relevance
      .limit(20)
      .populate('senderId', 'username avatar')
      .lean();

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * LIST USERS — Get all users (for starting DMs)
 * GET /api/rooms/users
 */
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username avatar status')
      .sort({ username: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
