/**
 * AUTH ROUTES
 * ===========
 * Maps URL paths to controller functions.
 * 
 * Express Router is like a "mini Express app" that handles a group
 * of related routes. We mount it at /api/auth in index.js, so:
 * - router.post('/register') → POST /api/auth/register
 * - router.post('/login')    → POST /api/auth/login
 * 
 * Notice: /register and /login don't need auth middleware (anyone can register/login)
 *         /logout and /me DO need auth middleware (you must be logged in)
 */

const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes (no authentication needed)
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/refresh', auth.refresh);     // Uses cookie, not Bearer token

// Protected routes (must be logged in)
router.post('/logout', authMiddleware, auth.logout);
router.get('/me', authMiddleware, auth.me);

module.exports = router;
