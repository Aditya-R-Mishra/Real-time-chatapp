/**
 * FRIEND ROUTES
 * =============
 * Endpoints for friend requests and friend listing.
 */

const router = require('express').Router();
const friendCtrl = require('../controllers/friend.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', friendCtrl.getFriends);
router.get('/requests', friendCtrl.getFriendRequests);
router.get('/search', friendCtrl.searchUsers);
router.post('/request', friendCtrl.sendFriendRequest);
router.post('/request/:id/accept', friendCtrl.acceptFriendRequest);
router.post('/request/:id/reject', friendCtrl.rejectFriendRequest);
router.delete('/request/:id', friendCtrl.cancelFriendRequest);

module.exports = router;
