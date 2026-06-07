/**
 * SERVER ENTRY POINT
 * ==================
 * This is where everything starts. Think of it as the "main()" of our backend.
 * 
 * What happens here:
 * 1. Load environment variables (database URL, secrets, etc.)
 * 2. Create Express app with middleware (CORS, JSON parsing, cookies)
 * 3. Connect to MongoDB Atlas
 * 4. Register all API routes (auth, rooms, uploads, admin)
 * 5. Create HTTP server and attach Socket.io for real-time messaging
 * 6. Start listening for connections
 * 
 * WHY http.createServer(app) instead of app.listen()?
 * → Socket.io needs the raw HTTP server object to "upgrade" regular HTTP
 *   connections to persistent WebSocket connections. Express's app.listen()
 *   creates an HTTP server internally but doesn't give us access to it.
 */

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import route handlers
const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/room.routes');
const uploadRoutes = require('./routes/upload.routes');
const adminRoutes = require('./routes/admin.routes');

// Import Socket.io initializer
const initSocket = require('./socket');

// Create Express app
const app = express();

// Create HTTP server from Express app (needed for Socket.io)
const httpServer = http.createServer(app);

// ─── MIDDLEWARE ───────────────────────────────────────────────
// Middleware runs on EVERY request before it reaches your routes.
// Think of them as "security checkpoints" at an airport.

// CORS: Controls which websites can call your API
// Without this, your React frontend (localhost:5173) would be blocked
// from calling your backend (localhost:5000) due to browser security
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, // Allow cookies to be sent cross-origin
}));

// JSON parser: Converts incoming JSON request bodies into JS objects
// Without this, req.body would be undefined when the client sends JSON
app.use(express.json());

// Cookie parser: Reads cookies from incoming requests into req.cookies
// We use this for refresh tokens (stored as HTTP-only cookies)
app.use(cookieParser());

// ─── API ROUTES ──────────────────────────────────────────────
// Each route group handles a different "section" of the API.
// The first argument is the URL prefix.

app.use('/api/auth', authRoutes);      // /api/auth/login, /register, etc.
app.use('/api/rooms', roomRoutes);     // /api/rooms, /api/rooms/:id, etc.
app.use('/api/upload', uploadRoutes);  // /api/upload (file uploads)
app.use('/api/admin', adminRoutes);    // /api/admin/users, /stats, etc.

// Health check endpoint — useful for deployment platforms
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── SOCKET.IO ───────────────────────────────────────────────
// Initialize Socket.io and attach it to the HTTP server.
// This enables real-time bidirectional communication.
const io = initSocket(httpServer);

// Make io accessible to route handlers (for admin operations like banning)
app.set('io', io);

// ─── DATABASE CONNECTION ─────────────────────────────────────
// Connect to MongoDB Atlas. Mongoose handles connection pooling,
// reconnection, and query buffering automatically.
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
