# Phase 3 — Standard features
**Weeks 5–6 | Real-Time Chat App**

> Adds the UX features that turn your MVP into something that feels like a real product: typing indicators, read receipts, private DMs, and media uploads.

---

## Objectives

- Implement typing indicators via socket events with debounce
- Add read receipts to messages
- Support private 1-on-1 DM conversations
- Allow image and file uploads via Cloudinary
- Add full-text message search

---

## Deliverables

- [ ] Typing indicator appears when another user is composing
- [ ] Messages show single/double tick read status
- [ ] Users can open a private DM with any other user
- [ ] Images and files can be sent and displayed in chat
- [ ] Search bar returns relevant messages within a room

---

## 1. Typing indicators

### Server-side socket events

```js
// Add inside io.on('connection', ...) in server/socket/index.js

socket.on('typing_start', ({ roomId }) => {
  // Broadcast to room members EXCEPT the sender
  socket.to(roomId).emit('user_typing', {
    userId: socket.user._id,
    username: socket.user.username,
    roomId,
  });
});

socket.on('typing_stop', ({ roomId }) => {
  socket.to(roomId).emit('user_stopped_typing', {
    userId: socket.user._id,
    roomId,
  });
});
```

### Client-side with debounce

```jsx
// client/src/components/chat/MessageInput.jsx
import { useRef } from 'react';

export default function MessageInput({ socket, roomId, onSend }) {
  const typingTimeout = useRef(null);
  const isTyping = useRef(false);

  const handleChange = (e) => {
    if (!isTyping.current) {
      socket.emit('typing_start', { roomId });
      isTyping.current = true;
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing_stop', { roomId });
      isTyping.current = false;
    }, 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(typingTimeout.current);
    socket.emit('typing_stop', { roomId });
    isTyping.current = false;
    onSend(e.target.message.value.trim());
    e.target.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="message" onChange={handleChange} placeholder="Type a message..." autoComplete="off" />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Typing indicator display

```jsx
// Show "Priya is typing..." below the message list
const [typingUsers, setTypingUsers] = useState({});

useEffect(() => {
  socket.on('user_typing', ({ userId, username }) => {
    setTypingUsers(prev => ({ ...prev, [userId]: username }));
  });
  socket.on('user_stopped_typing', ({ userId }) => {
    setTypingUsers(prev => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  });
}, [socket]);

const typingText = Object.values(typingUsers).join(', ');
// Render: "Priya is typing..." or "Priya, Raj are typing..."
```

---

## 2. Read receipts

### Server-side

```js
// server/socket/index.js — add inside connection handler
socket.on('message_read', async ({ messageIds, roomId }) => {
  await Message.updateMany(
    { _id: { $in: messageIds }, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
  // Notify room so senders can update their tick status
  io.to(roomId).emit('messages_read', { messageIds, readerId: userId });
});
```

### Client-side — emit on scroll/visibility

```js
// Emit when messages come into view (use IntersectionObserver)
const observer = new IntersectionObserver((entries) => {
  const visibleIds = entries
    .filter(e => e.isIntersecting)
    .map(e => e.target.dataset.messageId);
  if (visibleIds.length) {
    socket.emit('message_read', { messageIds: visibleIds, roomId: currentRoom });
  }
});
// Attach observer to each message element
```

### Status indicator component

```jsx
function ReadTick({ message, currentUserId }) {
  const isOwn = message.senderId._id === currentUserId;
  if (!isOwn) return null;
  const read = message.readBy.some(id => id !== currentUserId);
  return <span className="text-xs ml-1">{read ? '✓✓' : '✓'}</span>;
}
```

---

## 3. Private DMs

DMs are just rooms with `isPrivate: true` and exactly two members. Generate a deterministic room name from both user IDs to avoid duplicate rooms.

### Create or find DM room

```js
// server/controllers/dm.controller.js
const createOrGetDM = async (req, res) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user._id.toString();

  // Deterministic name — sort IDs so A-B and B-A produce the same room
  const dmName = [currentUserId, targetUserId].sort().join('_');

  let room = await Room.findOne({ name: dmName, isPrivate: true });
  if (!room) {
    room = await Room.create({
      name: dmName,
      isPrivate: true,
      members: [currentUserId, targetUserId],
      createdBy: currentUserId,
    });
  }

  res.json(room);
};
```

Add route: `POST /api/rooms/dm`

On the client, clicking a user's name calls this endpoint and then joins the returned room via socket.

---

## 4. Cloudinary file uploads

### Setup

```bash
cd server && npm install cloudinary multer multer-storage-cloudinary
```

```env
# Add to server/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Upload middleware

```js
// server/middleware/upload.middleware.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'chatapp',
    resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

module.exports = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
```

### Upload endpoint

```js
// POST /api/upload
const upload = require('../middleware/upload.middleware');

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    url: req.file.path,
    type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
    filename: req.file.originalname,
  });
});
```

### Client-side file upload flow

```jsx
const handleFileSelect = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const { data } = await axios.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data',
               Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
  });

  // Send the Cloudinary URL as a message
  socket.emit('send_message', {
    roomId: currentRoom,
    content: data.url,
    type: data.type,
  });
};
```

---

## 5. Message search

### MongoDB full-text index

The text index was already defined on the Message model in Phase 2:

```js
messageSchema.index({ content: 'text' });
```

### Search endpoint

```js
// GET /api/rooms/:id/search?q=hello
router.get('/:id/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);

  const results = await Message.find({
    roomId: req.params.id,
    $text: { $search: q },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(20)
    .populate('senderId', 'username avatar')
    .lean();

  res.json(results);
});
```

---

## API endpoints added this phase

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/rooms/dm` | Create or retrieve a DM room |
| POST | `/api/upload` | Upload image or file to Cloudinary |
| GET | `/api/rooms/:id/search?q=` | Full-text search within a room |

---

## Testing checklist

- [ ] Typing indicator appears for other users and clears after 2 seconds of inactivity
- [ ] Messages sent by you show ✓ (sent) then ✓✓ (read) when the other user views them
- [ ] Clicking a user opens a DM; the same DM room is returned if clicked again
- [ ] Uploading a JPEG displays an image in the chat; uploading a PDF shows a file link
- [ ] Files > 10MB are rejected with a 400 error
- [ ] Search returns results ranked by relevance, not just recency

---

## Common mistakes to avoid

- Do NOT emit `typing_start` on every keypress without debounce — it floods the server
- Always check `readBy: { $ne: userId }` before adding to the readBy array to avoid duplicates
- Never store Cloudinary API secrets in the client — uploads must go through your server
- The DM room name must be deterministic — always sort the two user IDs before joining

---

## Next phase

Phase 4 adds the finishing touches: emoji reactions, admin controls, browser notifications, and full deployment to Vercel and Render.
