/**
 * JWT UTILITIES
 * =============
 * JWT (JSON Web Token) is our authentication mechanism.
 * 
 * HOW JWT WORKS:
 * 1. User logs in with email + password
 * 2. Server verifies credentials, then creates two tokens:
 *    - Access Token (short-lived, 15 min) — sent in every API request
 *    - Refresh Token (long-lived, 7 days) — stored in HTTP-only cookie
 * 3. Client sends access token in the Authorization header:
 *    "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
 * 4. When access token expires, client uses refresh token to get a new one
 *    (this happens silently — the user never sees it)
 * 
 * WHY TWO TOKENS?
 * - Access tokens are stored in memory/localStorage (easy for JS to use)
 * - But localStorage is vulnerable to XSS attacks
 * - If an attacker steals it, it only works for 15 minutes
 * - Refresh tokens are in HTTP-only cookies (JavaScript CAN'T access them)
 * - This is the industry-standard "defense in depth" approach
 * 
 * JWT STRUCTURE (3 parts separated by dots):
 * eyJhbGciOiJIUzI1NiIs.eyJpZCI6IjY0YTFi.SflKxwRJSMeKKF2QT4fw
 * ↑ Header (algorithm)    ↑ Payload (data)    ↑ Signature (proof)
 */

const jwt = require('jsonwebtoken');

/**
 * Sign an access token with the user's ID embedded.
 * Expires in 15 minutes — after that, the client must refresh.
 */
const signAccess = (userId) =>
  jwt.sign(
    { id: userId },                      // Payload: what data to embed
    process.env.JWT_ACCESS_SECRET,       // Secret key: used to sign & verify
    { expiresIn: '15m' }                 // Expiry: token becomes invalid after this
  );

/**
 * Sign a refresh token. Expires in 7 days.
 * This is stored in an HTTP-only cookie, not in localStorage.
 */
const signRefresh = (userId) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

/**
 * Verify an access token. Returns the decoded payload { id: userId }
 * or throws an error if the token is invalid/expired.
 */
const verifyAccess = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

/**
 * Verify a refresh token. Same as above but uses the refresh secret.
 */
const verifyRefresh = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
