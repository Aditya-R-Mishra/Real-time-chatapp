/**
 * ADMIN ROUTES
 * =============
 * Protected routes that require BOTH authentication AND admin role.
 * We chain two middleware: authMiddleware → adminMiddleware → handler
 * 
 * This is the "middleware composition" pattern:
 * authMiddleware checks "are you logged in?"
 * adminMiddleware checks "are you an admin?"
 * Only if BOTH pass does the request reach the handler.
 */

const router = require('express').Router();
const adminCtrl = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// Apply both middleware to ALL admin routes
router.use(authMiddleware, adminMiddleware);

router.get('/users', adminCtrl.listUsers);              // GET /api/admin/users
router.patch('/users/:id/ban', adminCtrl.banUser);      // PATCH /api/admin/users/:id/ban
router.delete('/messages/:id', adminCtrl.deleteMessage); // DELETE /api/admin/messages/:id
router.get('/stats', adminCtrl.getStats);                // GET /api/admin/stats

module.exports = router;
