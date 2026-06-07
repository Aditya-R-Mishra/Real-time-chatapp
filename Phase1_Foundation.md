# Phase 1 — Foundation
**Weeks 1–2 | Real-Time Chat App**

---

## Objectives

Set up the full project skeleton, implement user authentication end-to-end, and build the basic React UI shell. By the end of this phase you should be able to register, log in, and see the chat layout — no messages yet.

---

## Deliverables

- [ ] Project repository with frontend and backend configured
- [ ] MongoDB Atlas cluster connected
- [ ] Registration and login API endpoints working
- [ ] JWT access + refresh token flow implemented
- [ ] Protected route middleware in place
- [ ] React app with auth forms and basic chat layout rendered

---

## Folder Structure

```
/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/        # Login, Register forms
│   │   │   └── layout/      # Sidebar, ChatWindow shell
│   │   ├── context/         # AuthContext
│   │   ├── hooks/           # useAuth, useApi
│   │   ├── pages/           # LoginPage, RegisterPage, ChatPage
│   │   └── main.jsx
│   └── vite.config.js
│
└── server/                  # Node.js + Express backend
    ├── controllers/
    │   └── auth.controller.js
    ├── middleware/
    │   └── auth.middleware.js
    ├── models/
    │   └── User.model.js
    ├── routes/
    │   └── auth.routes.js
    ├── utils/
    │   └── jwt.js
    └── index.js
```

---

## Setup Steps

### 1. Initialize the backend

```bash
mkdir server && cd server
npm init -y
npm install express mongoose bcryptjs jsonwebtoken dotenv cors cookie-parser
npm install -D nodemon
```

Add to `package.json`:
```json
"scripts": {
  "dev": "nodemon index.js",
  "start": "node index.js"
}
```

### 2. Initialize the frontend

```bash
npm create vite@latest client -- --template react
cd client
npm install axios react-router-dom tailwindcss @tailwindcss/vite socket.io-client
```

### 3. Environment variables

Create `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/chatapp
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
CLIENT_URL=http://localhost:5173
```

---

## API Endpoints

| Method | Route | Auth required | Description |
|--------|-------|--------------|-------------|
| POST | `/api/auth/register` | No | Create new user account |
| POST | `/api/auth/login` | No | Login, returns access + refresh tokens |
| POST | `/api/auth/refresh` | No | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | Yes | Revoke refresh token |
| GET | `/api/auth/me` | Yes | Return current user object |

---

## Key Code: JWT utilities

```js
// server/utils/jwt.js
const jwt = require('jsonwebtoken');

const signAccess = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefresh = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const verifyAccess = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

const verifyRefresh = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
```

---

## Key Code: Auth middleware

```js
// server/middleware/auth.middleware.js
const { verifyAccess } = require('../utils/jwt');
const User = require('../models/User.model');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = verifyAccess(header.split(' ')[1]);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

---

## Key Code: User model

```js
// server/models/User.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  avatar:   { type: String, default: '' },
  status:   { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

---

## React: Auth context

```jsx
// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt silent refresh on mount
    axios.post('/api/auth/refresh', {}, { withCredentials: true })
      .then(res => {
        localStorage.setItem('accessToken', res.data.accessToken);
        setUser(res.data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password }, { withCredentials: true });
    localStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    await axios.post('/api/auth/logout', {}, { withCredentials: true });
    localStorage.removeItem('accessToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## Testing checklist

- [ ] `POST /api/auth/register` returns 201 with user object
- [ ] `POST /api/auth/login` sets `refreshToken` HTTP-only cookie and returns `accessToken`
- [ ] `POST /api/auth/refresh` returns new access token using the cookie
- [ ] `GET /api/auth/me` returns 401 without token, 200 with valid token
- [ ] Passwords are NOT returned in any API response
- [ ] React login form updates AuthContext and redirects to `/chat`

---

## Common mistakes to avoid

- Never return the `password` field in API responses — use `.select('-password')` in Mongoose queries
- Store the refresh token in an HTTP-only cookie, not `localStorage` (prevents XSS theft)
- Set `httpOnly: true, sameSite: 'strict', secure: true` on the cookie in production
- Add input validation with `express-validator` before hitting the database

---

## Next phase

Phase 2 adds Socket.io to the backend and connects the React UI to real-time messaging. The auth tokens created here will be passed in the Socket.io handshake to authenticate socket connections.
