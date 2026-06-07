# Phase 2 — Real-time core
**Weeks 3–4 | Real-Time Chat App**

> This is the MVP phase. By the end of Week 4 you should have a fully working chat app where messages send and appear in real time across multiple browser tabs.

---

## Objectives

- Integrate Socket.io on both server and client
- Implement room join/leave and message broadcasting
- Persist every message to MongoDB
- Load chat history when a user joins a room
- Show basic online presence (who is connected)

---

## Deliverables

- [ ] Socket.io server attached to Express HTTP server
- [ ] Socket connections authenticated via JWT
- [ ] `join_room`, `send_message`, `receive_message` events working
- [ ] Messages saved to MongoDB on each `send_message`
- [ ] Chat history loaded on room join (50 messages, cursor-based)
- [ ] Online user list updates on connect/disconnect

---

## New files this phase

```
server/
├── models/
│   ├── Room.model.js       # NEW
│   └── Message.model.js    # NEW
├── socket/
│   └── index.js            # NEW — all socket event handlers
└── routes/
    └── room.routes.js      # NEW — REST endpoints for rooms

client/src/
├── hooks/
│   └── useSocket.js        # NEW
├── components/
│   └── chat/
│       ├── MessageList.jsx  # NEW
│       ├── MessageInput.jsx # NEW
│       └── UserList.jsx     # NEW
```

---

## Models

### Room model

```js
// server/models/Room.model.js
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPrivate:   { type: Boolean, default: false },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
```

### Message model

```js
// server/models/Message.model.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  senderId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:         { type: String, required: true },
  type:            { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  readBy:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions:       { type: Map, of: [mongoose.Schema.Types.ObjectId], default: {} },
  parentMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: true });

// Compound index for efficient cursor-based pagination
messageSchema.index({ roomId: 1, createdAt: -1 });
// Full-text index for Phase 3 search
messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
```

---

## Socket.io server setup

```js
// server/socket/index.js
const { Server } = require('socket.io');
const { verifyAccess } = require('../utils/jwt');
const User = require('../models/User.model');
const Message = require('../models/Message.model');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true }
  });

  // Auth middleware — runs before any connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const decoded = verifyAccess(token);
      socket.user = await User.findById(decoded.id).select('-password');
      if (!socket.user) return next(new Error('User not found'));
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Mark user online
    await User.findByIdAndUpdate(userId, { status: 'online' });
    io.emit('user_online', { userId });

    // Join a room
    socket.on('join_room', async ({ roomId }) => {
      socket.join(roomId);

      // Send last 50 messages (cursor-based)
      const messages = await Message.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('senderId', 'username avatar')
        .lean();

      socket.emit('room_history', { roomId, messages: messages.reverse() });
    });

    // Send a message
    socket.on('send_message', async ({ roomId, content, type = 'text' }) => {
      if (!content?.trim()) return;

      const message = await Message.create({
        roomId, content: content.trim(), type, senderId: userId
      });

      const populated = await message.populate('senderId', 'username avatar');

      // Broadcast to ALL members in the room (including sender)
      io.to(roomId).emit('receive_message', populated);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(userId, { status: 'offline' });
      io.emit('user_offline', { userId });
    });
  });

  return io;
}

module.exports = initSocket;
```

Attach to your Express server in `index.js`:

```js
// server/index.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const initSocket = require('./socket');

const app = express();
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

// ... middleware and routes

httpServer.listen(process.env.PORT || 5000, () => console.log('Server running'));
```

---

## Socket hook (React client)

```js
// client/src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || socketRef.current) return;

    socket = io(import.meta.env.VITE_SERVER_URL, {
      auth: { token },
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error('Socket auth error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef.current;
}
```

---

## React: using the socket in the chat page

```jsx
// client/src/pages/ChatPage.jsx
import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function ChatPage() {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);

  useEffect(() => {
    if (!socket || !currentRoom) return;

    socket.emit('join_room', { roomId: currentRoom });

    socket.on('room_history', ({ messages }) => setMessages(messages));
    socket.on('receive_message', (msg) => setMessages(prev => [...prev, msg]));

    return () => {
      socket.off('room_history');
      socket.off('receive_message');
    };
  }, [socket, currentRoom]);

  const sendMessage = (content) => {
    if (!socket || !currentRoom) return;
    socket.emit('send_message', { roomId: currentRoom, content });
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar: room list */}
      {/* Main: MessageList + MessageInput */}
    </div>
  );
}
```

---

## REST endpoints for rooms

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/rooms` | Yes | List all public rooms |
| POST | `/api/rooms` | Yes | Create a new room |
| GET | `/api/rooms/:id` | Yes | Get room details |
| GET | `/api/rooms/:id/messages` | Yes | Paginated message history |

### Cursor-based pagination example

```js
// GET /api/rooms/:id/messages?before=<messageId>&limit=50
router.get('/:id/messages', authMiddleware, async (req, res) => {
  const { before, limit = 50 } = req.query;
  const query = { roomId: req.params.id };
  if (before) {
    const ref = await Message.findById(before).lean();
    if (ref) query.createdAt = { $lt: ref.createdAt };
  }
  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('senderId', 'username avatar')
    .lean();
  res.json(messages.reverse());
});
```

> Use cursor-based pagination (by `createdAt` / `_id`) rather than offset/skip — offset pagination becomes slow and inconsistent on large collections. This is an industry standard that evaluators will notice.

---

## Testing checklist

- [ ] Opening two browser tabs, sending a message in one appears instantly in the other
- [ ] Refreshing the page reloads the last 50 messages from MongoDB
- [ ] Disconnecting a socket updates the user's status to `offline`
- [ ] Socket connections without a valid JWT are rejected with `connect_error`
- [ ] Messages are persisted in MongoDB — confirm in Atlas UI or Compass
- [ ] Multiple rooms work independently (messages in Room A do not appear in Room B)

---

## What evaluators look for in this phase

- Using `socket.to(roomId).emit()` not `io.emit()` for room messages — targeted broadcast shows you understand Socket.io rooms
- JWT passed in `socket.handshake.auth` — not as a URL query param (security best practice)
- Cursor-based pagination on message history — not `.skip()` offset
- Messages populated with sender info before emitting — one DB call, not N+1

---

## Next phase

Phase 3 adds the UX polish features: typing indicators, read receipts, private DMs, and Cloudinary file uploads.
