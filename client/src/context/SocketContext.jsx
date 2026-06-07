/**
 * SOCKET CONTEXT
 * ==============
 * Provides a Socket.io connection to the entire React app.
 * 
 * WHY A CONTEXT FOR SOCKET?
 * The socket connection is a "singleton resource" — you want exactly ONE
 * connection shared by all components. Without context, each component
 * would create its own connection (wasteful and broken).
 * 
 * LIFECYCLE:
 * 1. User logs in → AuthContext sets user
 * 2. SocketProvider detects user → creates socket connection
 * 3. Socket connects with JWT token in handshake (auth)
 * 4. All components can use useSocket() to emit/listen to events
 * 5. User logs out → socket disconnects
 * 
 * IMPORTANT: The socket is only created when the user is authenticated.
 * Unauthenticated users don't get a socket connection.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../utils/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    // Create socket connection with JWT auth
    const socket = io('/', {
      auth: {
        token: getAccessToken(),
      },
      // These are reconnection settings:
      reconnection: true,          // Auto-reconnect on disconnect
      reconnectionAttempts: 10,    // Try 10 times before giving up
      reconnectionDelay: 1000,     // Wait 1 second between attempts
      reconnectionDelayMax: 5000,  // Max wait of 5 seconds
    });

    socketRef.current = socket;

    // ─── Connection lifecycle events ─────────────────────
    socket.on('connect', () => {
      console.log('🟢 Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    // ─── Online users tracking ───────────────────────────
    socket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    // Cleanup on unmount or user logout
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user]);

  /**
   * Emit a socket event.
   * Returns false if socket is not connected (so callers can handle it).
   */
  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    console.warn(`Socket not connected. Cannot emit: ${event}`);
    return false;
  }, []);

  /**
   * Subscribe to a socket event.
   * Returns an unsubscribe function (for cleanup in useEffect).
   */
  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
    return () => socketRef.current?.off(event, callback);
  }, []);

  /**
   * Unsubscribe from a socket event.
   */
  const off = useCallback((event, callback) => {
    socketRef.current?.off(event, callback);
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    emit,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Custom hook to access the socket context.
 * Usage: const { emit, on, isConnected } = useSocket();
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
