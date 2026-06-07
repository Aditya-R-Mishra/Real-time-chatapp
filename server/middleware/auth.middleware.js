/**
 * AUTH MIDDLEWARE
 * ==============
 * Middleware is like a "security guard" that checks every request
 * before it reaches your route handler.
 * 
 * HOW IT WORKS:
 * 1. Client sends: Authorization: Bearer <token>
 * 2. This middleware extracts the token
 * 3. Verifies it using our JWT secret
 * 4. Finds the user in the database
 * 5. Attaches user to req.user (so route handlers can access it)
 * 6. Calls next() to let the request continue
 * 
 * If any step fails → 401 Unauthorized response.
 * 
 * USAGE in routes:
 *   router.get('/protected', authMiddleware, (req, res) => {
 *     // req.user is available here!
 *     res.json(req.user);
 *   });
 */

const { verifyAccess } = require('../utils/jwt');
const User = require('../models/User.model');

module.exports = async (req, res, next) => {
  // Step 1: Check if the Authorization header exists and has the right format
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Step 2: Extract the token (everything after "Bearer ")
    const token = header.split(' ')[1];

    // Step 3: Verify the token — this will throw if expired or tampered
    const decoded = verifyAccess(token);

    // Step 4: Find the user in the database
    // .select('-password') ensures the password hash is NOT included
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned' });
    }

    // Step 5: Attach user to the request object
    // Now any route handler after this middleware can access req.user
    req.user = user;

    // Step 6: Let the request continue to the route handler
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
