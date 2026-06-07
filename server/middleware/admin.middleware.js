/**
 * ADMIN MIDDLEWARE
 * ================
 * Checks if the authenticated user has the 'admin' role.
 * Must be used AFTER authMiddleware (which sets req.user).
 * 
 * USAGE:
 *   router.delete('/message/:id', authMiddleware, adminMiddleware, handler);
 *   // Only admins can reach the handler
 * 
 * WHY separate from auth middleware?
 * → Single Responsibility Principle. Auth middleware handles "are you logged in?",
 *   admin middleware handles "are you an admin?". This lets us compose them:
 *   - Some routes need just auth (sending messages)
 *   - Some routes need auth + admin (banning users)
 */

module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin access required' });
  }
  next();
};
