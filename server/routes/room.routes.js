/**
 * ROOM ROUTES
 * ============
 * All room-related API endpoints.
 * Every route here requires authentication (authMiddleware applied to all).
 * 
 * Route order matters! Express matches routes top-to-bottom.
 * /dm and /users must come BEFORE /:id, otherwise Express would
 * treat "dm" and "users" as room IDs.
 */

const router = require('express').Router();
const roomCtrl = require('../controllers/room.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to ALL routes in this router
router.use(authMiddleware);

// ↓ These specific routes MUST come before /:id routes
router.post('/dm', roomCtrl.createOrGetDM);           // POST /api/rooms/dm
router.get('/users', roomCtrl.listUsers);              // GET /api/rooms/users

// Room CRUD
router.get('/', roomCtrl.listRooms);                   // GET /api/rooms
router.post('/', roomCtrl.createRoom);                 // POST /api/rooms
router.get('/:id', roomCtrl.getRoom);                  // GET /api/rooms/:id
router.post('/:id/join', roomCtrl.joinRoom);           // POST /api/rooms/:id/join

// Messages within a room
router.get('/:id/messages', roomCtrl.getMessages);     // GET /api/rooms/:id/messages
router.get('/:id/search', roomCtrl.searchMessages);    // GET /api/rooms/:id/search?q=

module.exports = router;
