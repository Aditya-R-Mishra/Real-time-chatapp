/**
 * FRIEND CONTROLLER
 * =================
 * Manages friend requests, friendships, and user discovery.
 */

const User = require('../models/User.model');
const FriendRequest = require('../models/FriendRequest.model');

/**
 * SEND FRIEND REQUEST
 * POST /api/friends/request
 * Body: { recipientId }
 */
exports.sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id.toString();

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }

    if (recipientId === senderId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const currentUser = await User.findById(senderId);
    if (currentUser.friends?.some((id) => id.toString() === recipientId)) {
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    // Check if reverse request is pending -> if so, auto-accept!
    const reverseRequest = await FriendRequest.findOne({
      sender: recipientId,
      recipient: senderId,
      status: 'pending',
    });

    if (reverseRequest) {
      reverseRequest.status = 'accepted';
      await reverseRequest.save();

      await User.findByIdAndUpdate(senderId, { $addToSet: { friends: recipientId } });
      await User.findByIdAndUpdate(recipientId, { $addToSet: { friends: senderId } });

      const io = req.app.get('io');
      if (io) {
        io.emit('friend_request_accepted', {
          user1: senderId,
          user2: recipientId,
        });
      }

      return res.json({ message: 'Friend request accepted automatically', status: 'accepted' });
    }

    // Check if request already exists
    let request = await FriendRequest.findOne({
      sender: senderId,
      recipient: recipientId,
    });

    if (request && request.status === 'pending') {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    if (request) {
      request.status = 'pending';
      await request.save();
    } else {
      request = await FriendRequest.create({
        sender: senderId,
        recipient: recipientId,
        status: 'pending',
      });
    }

    const populated = await FriendRequest.findById(request._id)
      .populate('sender', 'username avatar status')
      .populate('recipient', 'username avatar status');

    // Notify recipient via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('new_friend_request', {
        request: populated,
        recipientId,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ACCEPT FRIEND REQUEST
 * POST /api/friends/request/:id/accept
 */
exports.acceptFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.id,
      recipient: req.user._id,
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found or already handled' });
    }

    request.status = 'accepted';
    await request.save();

    const senderId = request.sender.toString();
    const recipientId = req.user._id.toString();

    // Add each user to the other's friends array
    await User.findByIdAndUpdate(recipientId, { $addToSet: { friends: senderId } });
    await User.findByIdAndUpdate(senderId, { $addToSet: { friends: recipientId } });

    const populated = await FriendRequest.findById(request._id)
      .populate('sender', 'username avatar status')
      .populate('recipient', 'username avatar status');

    const io = req.app.get('io');
    if (io) {
      io.emit('friend_request_accepted', {
        user1: senderId,
        user2: recipientId,
      });
    }

    res.json({ message: 'Friend request accepted', request: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * REJECT FRIEND REQUEST
 * POST /api/friends/request/:id/reject
 */
exports.rejectFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * CANCEL OUTGOING FRIEND REQUEST
 * DELETE /api/friends/request/:id
 */
exports.cancelFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndDelete({
      _id: req.params.id,
      sender: req.user._id,
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET ACCEPTED FRIENDS
 * GET /api/friends
 */
exports.getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'username avatar status');
    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET PENDING FRIEND REQUESTS (Incoming & Outgoing)
 * GET /api/friends/requests
 */
exports.getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: userId, status: 'pending' })
        .populate('sender', 'username avatar status')
        .sort({ createdAt: -1 }),
      FriendRequest.find({ sender: userId, status: 'pending' })
        .populate('recipient', 'username avatar status')
        .sort({ createdAt: -1 }),
    ]);

    res.json({ incoming, outgoing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * SEARCH USERS WITH FRIENDSHIP STATUS
 * GET /api/friends/search?q=query
 */
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id.toString();

    let query = { _id: { $ne: req.user._id } };
    if (q?.trim()) {
      query.username = { $regex: q.trim(), $options: 'i' };
    }

    const users = await User.find(query).select('username avatar status friends').limit(20);

    const currentUser = await User.findById(currentUserId);
    const userFriendIds = (currentUser.friends || []).map((id) => id.toString());

    // Fetch pending requests
    const pendingRequests = await FriendRequest.find({
      $or: [
        { sender: currentUserId, status: 'pending' },
        { recipient: currentUserId, status: 'pending' },
      ],
    });

    const results = users.map((u) => {
      const uId = u._id.toString();
      let status = 'none';
      let requestId = null;

      if (userFriendIds.includes(uId)) {
        status = 'friend';
      } else {
        const reqOutgoing = pendingRequests.find(
          (r) => r.sender.toString() === currentUserId && r.recipient.toString() === uId
        );
        const reqIncoming = pendingRequests.find(
          (r) => r.recipient.toString() === currentUserId && r.sender.toString() === uId
        );

        if (reqOutgoing) {
          status = 'request_sent';
          requestId = reqOutgoing._id;
        } else if (reqIncoming) {
          status = 'request_received';
          requestId = reqIncoming._id;
        }
      }

      return {
        _id: u._id,
        username: u.username,
        avatar: u.avatar,
        status: u.status,
        friendshipStatus: status,
        requestId,
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
