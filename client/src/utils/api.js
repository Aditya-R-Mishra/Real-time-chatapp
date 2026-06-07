/**
 * AXIOS API INSTANCE
 * ==================
 * A centralized Axios instance with automatic JWT token management.
 * 
 * WHY NOT USE fetch()?
 * - Axios has interceptors: middleware that runs before every request and after every response
 * - We use this to automatically attach the JWT token to every request
 * - And to automatically refresh expired tokens without the user knowing
 * 
 * HOW THE INTERCEPTOR PATTERN WORKS:
 * 
 *   Request Interceptor (runs BEFORE every request):
 *   1. Check if we have an accessToken in memory
 *   2. If yes, add it to the Authorization header
 *   3. The server's authMiddleware reads this header
 * 
 *   Response Interceptor (runs AFTER every response):
 *   1. If response is 401 (token expired)...
 *   2. Try to call /api/auth/refresh (uses the httpOnly cookie)
 *   3. If refresh succeeds, retry the original request with the new token
 *   4. If refresh fails, redirect to login (session is truly expired)
 * 
 * WHY STORE TOKEN IN MEMORY (not localStorage)?
 * - localStorage is accessible to ANY JavaScript on the page
 * - If there's an XSS vulnerability, attackers can steal the token
 * - In-memory tokens are lost on page refresh, but we handle that
 *   with the refresh token in the httpOnly cookie
 */

import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: '/api',        // Vite proxy forwards this to http://localhost:5000/api
  withCredentials: true,  // IMPORTANT: Send cookies with every request (for refresh token)
});

// ─── In-memory token storage ────────────────────────────────
// NOT in localStorage (XSS risk). Lost on refresh, but restored via refresh token.
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

// ─── Request Interceptor ────────────────────────────────────
// Runs BEFORE every request — attaches the JWT if we have one
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ───────────────────────────────────
// Runs AFTER every response — handles token expiry automatically
let isRefreshing = false;
let failedQueue = [];

/**
 * WHY THE QUEUE?
 * If 3 API calls fail at the same time (all get 401),
 * we don't want to send 3 refresh requests.
 * We queue them and retry all 3 after one successful refresh.
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response, // Success: pass through
  async (error) => {
    const originalRequest = error.config;

    // Only try refresh on 401 (Unauthorized) and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another refresh is in progress — queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to get a new access token using the refresh token cookie
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        // Don't redirect here — let AuthContext handle it
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
