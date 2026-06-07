/**
 * AUTH CONTROLLER
 * ===============
 * Contains all authentication-related business logic.
 * 
 * Each function follows a consistent pattern:
 * 1. Validate input (check for missing fields)
 * 2. Do database work (find/create users, compare passwords)
 * 3. Return response (user data + tokens, or error)
 * 
 * FLOW FOR LOGIN:
 * Client → POST /api/auth/login { email, password }
 * → auth.controller.login()
 *   → Find user by email
 *   → Compare password with bcrypt
 *   → Sign access + refresh tokens
 *   → Set refresh token as HTTP-only cookie
 *   → Return { user, accessToken }
 * 
 * WHY HTTP-ONLY COOKIE for refresh token?
 * → JavaScript can't access HTTP-only cookies (document.cookie won't see it)
 * → This protects against XSS attacks (malicious scripts can't steal it)
 * → The browser automatically sends it with every request to our domain
 */

const User = require('../models/User.model');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

/**
 * REGISTER — Create a new user account
 * POST /api/auth/register
 * Body: { username, email, password }
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]  // Check both email AND username
    });
    if (existingUser) {
      return res.status(409).json({
        error: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken'
      });
    }

    // Create user — password will be hashed by the pre-save hook
    const user = await User.create({ username, email, password });

    // Sign tokens
    const accessToken = signAccess(user._id);
    const refreshToken = signRefresh(user._id);

    // Set refresh token as HTTP-only cookie
    // httpOnly: true → JS can't access this cookie (XSS protection)
    // sameSite: 'strict' → Cookie only sent to same site (CSRF protection)
    // secure: true in production → Cookie only sent over HTTPS
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    // Return user data (without password) and access token
    res.status(201).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * LOGIN — Authenticate an existing user
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email. We need the password for comparison,
    // so we explicitly include it with .select('+password')
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned' });
    }

    // Compare the provided password with the stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // ↑ Notice we use the SAME error message for wrong email AND wrong password.
    // This prevents attackers from figuring out which emails are registered.

    // Sign tokens
    const accessToken = signAccess(user._id);
    const refreshToken = signRefresh(user._id);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * REFRESH — Exchange a refresh token for a new access token
 * POST /api/auth/refresh
 * No body needed — refresh token comes from the HTTP-only cookie
 * 
 * This is called silently by the frontend when the access token expires.
 * The user never sees this happening.
 */
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    // Verify the refresh token
    const decoded = verifyRefresh(refreshToken);

    // Find the user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned' });
    }

    // Issue a new access token
    const accessToken = signAccess(user._id);

    // Also rotate the refresh token (best practice)
    const newRefreshToken = signRefresh(user._id);
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

/**
 * LOGOUT — Revoke the refresh token
 * POST /api/auth/logout
 * Auth: Required (Bearer token)
 */
exports.logout = async (req, res) => {
  // Clear the refresh token cookie
  // By setting maxAge to 0, the browser immediately deletes the cookie
  res.cookie('refreshToken', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  res.json({ message: 'Logged out successfully' });
};

/**
 * ME — Get the currently authenticated user's profile
 * GET /api/auth/me
 * Auth: Required (Bearer token)
 * 
 * The auth middleware already verified the token and set req.user,
 * so we just return it.
 */
exports.me = async (req, res) => {
  res.json(req.user);
};
