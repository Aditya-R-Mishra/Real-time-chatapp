# Phase 4 — Polish and deployment
**Weeks 7–8 | Real-Time Chat App**

> The final phase. Turn a feature-complete app into a production-ready, deployed product with a live URL, clean README, and demo video.

---

## Objectives

- Add emoji reactions and reply-to threading
- Build a basic admin dashboard
- Implement browser push notifications
- Deploy frontend to Vercel and backend to Render
- Write documentation and record a demo

---

## Deliverables

- [ ] Emoji reactions working on messages
- [ ] Reply-to renders quoted parent message
- [ ] Admin can ban users and delete messages
- [ ] Browser notifications fire when the tab is not focused
- [ ] Live frontend URL (Vercel) and backend URL (Render) working
- [ ] README with setup instructions, architecture summary, and live URL
- [ ] 2–3 minute demo video recorded

---

## 1. Emoji reactions

### Server-side socket event

```js
// server/socket/index.js — inside connection handler
socket.on('add_reaction', async ({ messageId, emoji, roomId }) => {
  const message = await Message.findById(messageId);
  if (!message) return;

  const reactors = message.reactions.get(emoji) || [];
  const alreadyReacted = reactors.some(id => id.toString() === userId);

  if (alreadyReacted) {
    // Toggle off
    message.reactions.set(emoji, reactors.filter(id => id.toString() !== userId));
  } else {
    message.reactions.set(emoji, [...reactors, userId]);
  }

  await message.save();

  io.to(roomId).emit('reaction_updated', {
    messageId,
    reactions: Object.fromEntries(message.reactions),
  });
});
```

### Client-side reaction picker

```jsx
// client/src/components/chat/ReactionPicker.jsx
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ReactionPicker({ messageId, roomId, socket }) {
  return (
    <div className="flex gap-1 bg-white border rounded-full px-2 py-1 shadow-sm">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => socket.emit('add_reaction', { messageId, emoji, roomId })}
          className="text-lg hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
```

### Display reaction counts on messages

```jsx
function ReactionBar({ reactions, currentUserId }) {
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {Object.entries(reactions).map(([emoji, users]) =>
        users.length > 0 ? (
          <span
            key={emoji}
            className={`text-xs px-2 py-0.5 rounded-full border
              ${users.includes(currentUserId) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-200'}`}
          >
            {emoji} {users.length}
          </span>
        ) : null
      )}
    </div>
  );
}
```

---

## 2. Reply-to threading

### Data model (already in schema from Phase 2)

```js
parentMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
```

### Server — populate parent on send

```js
socket.on('send_message', async ({ roomId, content, type = 'text', parentMessageId = null }) => {
  const message = await Message.create({ roomId, content, type, senderId: userId, parentMessageId });
  const populated = await Message.findById(message._id)
    .populate('senderId', 'username avatar')
    .populate({ path: 'parentMessageId', populate: { path: 'senderId', select: 'username' } });
  io.to(roomId).emit('receive_message', populated);
});
```

### Reply UI

```jsx
function MessageBubble({ message, onReply }) {
  return (
    <div className="mb-2">
      {message.parentMessageId && (
        <div className="border-l-2 border-blue-400 pl-2 mb-1 text-xs text-gray-500 italic">
          Replying to {message.parentMessageId.senderId.username}:
          "{message.parentMessageId.content.slice(0, 60)}..."
        </div>
      )}
      <div className="flex gap-2 items-start group">
        <p>{message.content}</p>
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-100 text-xs text-gray-400"
        >
          Reply
        </button>
      </div>
    </div>
  );
}
```

---

## 3. Admin dashboard

### Auth guard for admin routes

```js
// server/middleware/admin.middleware.js
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};
```

Add `role: { type: String, enum: ['user', 'admin'], default: 'user' }` to User model.

### Admin API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/users` | List all users with status |
| PATCH | `/api/admin/users/:id/ban` | Ban or unban a user |
| DELETE | `/api/admin/messages/:id` | Delete any message |
| GET | `/api/admin/stats` | Room count, user count, message count |

### Ban a user

```js
// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', authMiddleware, adminMiddleware, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBanned: true },
    { new: true }
  ).select('-password');
  // Disconnect their active sockets
  const sockets = await io.fetchSockets();
  sockets.forEach(s => { if (s.user._id.toString() === req.params.id) s.disconnect(); });
  res.json(user);
});
```

Check ban status in socket auth middleware:
```js
if (socket.user.isBanned) return next(new Error('Banned'));
```

---

## 4. Browser push notifications

No service worker needed — the browser Notifications API is enough for tab-based notifications.

```js
// client/src/utils/notifications.js
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function showNotification(title, body, icon) {
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // Only notify when tab is not focused
  new Notification(title, { body, icon: icon || '/favicon.ico' });
}
```

Use in the chat page:

```js
// When receive_message fires and the tab is not focused
socket.on('receive_message', (msg) => {
  setMessages(prev => [...prev, msg]);
  showNotification(
    msg.senderId.username,
    msg.type === 'text' ? msg.content : '📎 Sent a file',
    msg.senderId.avatar
  );
});
```

Call `requestNotificationPermission()` after login to prompt the user once.

---

## 5. Deployment

### Backend — Render

1. Push `server/` to a GitHub repository
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set build command: `npm install`
4. Set start command: `node index.js`
5. Add environment variables (all keys from `.env`):
   - `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `CLIENT_URL` = your Vercel frontend URL
6. Enable **Auto-Deploy** from main branch

> Render free tier spins down after 15 minutes of inactivity. For a demo, this is fine — add a note in your README that the first request may take ~30 seconds.

### Frontend — Vercel

1. Push `client/` to GitHub (or use a monorepo root)
2. Import project on [vercel.com](https://vercel.com)
3. Set framework preset: **Vite**
4. Add environment variable:
   - `VITE_SERVER_URL` = your Render backend URL
5. Deploy — Vercel handles the rest

### CORS update for production

```js
// server/index.js — update CORS for deployed frontend
app.use(cors({
  origin: process.env.CLIENT_URL, // e.g. https://chatapp.vercel.app
  credentials: true,
}));
```

Also update Socket.io CORS:
```js
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true }
});
```

---

## 6. README structure

Your `README.md` should contain these sections:

```md
# Real-Time Chat App

Live demo: https://chatapp.vercel.app

## Features
- Real-time messaging with Socket.io
- JWT authentication with refresh token rotation
- Typing indicators and read receipts
- Private DMs, emoji reactions, reply threading
- Image/file uploads via Cloudinary
- Admin dashboard

## Tech stack
React · Node.js · Express · Socket.io · MongoDB · Cloudinary

## Architecture
[Brief diagram or description]

## Local setup
1. Clone the repo
2. Set up server/.env (see .env.example)
3. cd server && npm install && npm run dev
4. cd client && npm install && npm run dev

## Environment variables
[Table of all required keys]

## API documentation
[Link to Swagger or brief endpoint list]
```

---

## 7. Demo video checklist

Record a 2–3 minute Loom or screen recording showing:

- [ ] Register two accounts in separate browser windows
- [ ] Send messages in real time — both windows update simultaneously
- [ ] Show typing indicator appearing in the second window
- [ ] Show read receipts updating (✓ → ✓✓)
- [ ] Upload an image — show it appearing in both windows
- [ ] Open a DM between the two accounts
- [ ] Add an emoji reaction
- [ ] Show the admin panel (ban/unban a user)
- [ ] Show the live deployed URL in the browser address bar

---

## Final testing checklist

- [ ] All four phases of features work end-to-end on the deployed URL
- [ ] No credentials or `.env` files committed to the repository (check with `git log`)
- [ ] `npm run lint` passes with no errors
- [ ] README has the live URL, setup instructions, and environment variable table
- [ ] The demo video link is in the README

---

## Evaluation highlights to mention

When presenting or submitting, explicitly call out these implementation choices — they show industry awareness:

- **Cursor-based pagination** on message history (not offset/skip)
- **JWT refresh token rotation** — old tokens invalidated on use
- **socket.to(roomId)** for targeted room broadcasts (not io.emit)
- **HTTP-only cookies** for refresh tokens (XSS protection)
- **Cloudinary pre-signed upload** via server middleware (API keys never exposed to client)
- **Compound MongoDB index** on `(roomId, createdAt)` for efficient queries
- **CI/CD** via Render and Vercel auto-deploy from main branch

---

*Project complete. Good luck with your submission!*
