/**
 * AUTH CONTEXT
 * ============
 * This is the "single source of truth" for authentication state.
 * 
 * WHAT IS CONTEXT?
 * React Context is a way to share data across components without
 * passing props down through every level (called "prop drilling").
 * 
 * Instead of: App → Layout → Sidebar → UserInfo (passing user through each)
 * With context: Any component can call useAuth() to get the user
 * 
 * WHAT THIS CONTEXT MANAGES:
 * 1. user — The currently logged-in user object (or null)
 * 2. loading — Whether we're still checking auth status on page load
 * 3. login() — Sends credentials, stores token, sets user
 * 4. register() — Creates account, stores token, sets user
 * 5. logout() — Clears everything, redirects to login
 * 
 * SILENT REFRESH ON MOUNT:
 * When the page first loads (or is refreshed), the access token in
 * memory is gone. But the refresh token cookie is still there!
 * So we call /api/auth/refresh to get a new access token silently.
 * The user never sees a login screen if their session is still valid.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, clearAccessToken } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start true — we're checking auth

  /**
   * On mount: Try to restore the session.
   * 
   * FLOW:
   * 1. Call /api/auth/refresh (sends the httpOnly cookie automatically)
   * 2. If it works → we get a new access token + user data
   * 3. If it fails → user needs to log in (that's okay, not an error)
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        // No valid refresh token — user needs to log in
        // This is expected for first-time visitors
        clearAccessToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * LOGIN
   * Sends email + password to the server.
   * On success: stores access token in memory, sets user state.
   * The refresh token is automatically stored as an httpOnly cookie by the server.
   */
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  /**
   * REGISTER
   * Creates a new account and logs the user in immediately.
   */
  const register = useCallback(async (username, email, password) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  /**
   * LOGOUT
   * 1. Calls the server to clear the refresh token cookie
   * 2. Clears the access token from memory
   * 3. Sets user to null (triggers redirect to login)
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if logout API fails, clear local state
    }
    clearAccessToken();
    setUser(null);
  }, []);

  /**
   * UPDATE USER
   * For when the user changes their profile (avatar, username, etc.)
   */
  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access auth context.
 * Throws an error if used outside AuthProvider — 
 * this catches bugs early during development.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
