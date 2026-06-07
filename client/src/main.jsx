/**
 * MAIN.JSX — Application Entry Point
 * ====================================
 * This is where React mounts into the DOM.
 * 
 * PROVIDER ORDER MATTERS:
 * AuthProvider → SocketProvider → App
 * 
 * WHY THIS ORDER?
 * 1. AuthProvider FIRST — because SocketProvider needs user data
 *    (it only connects when user is authenticated)
 * 2. SocketProvider SECOND — wraps the entire app so any component
 *    can use useSocket()
 * 3. App LAST — the actual UI
 * 
 * Think of providers like layers of an onion:
 * The outermost (AuthProvider) is available to ALL inner components.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </AuthProvider>
  </StrictMode>
);
