/**
 * APP.JSX — Root Component
 * ========================
 * This is the top-level component that handles routing.
 * 
 * ROUTING LOGIC:
 * - If authenticated → show ChatPage
 * - If NOT authenticated → show AuthPage
 * - If loading (checking auth on mount) → show a loading screen
 * 
 * WHY NOT react-router <Routes>?
 * For a chat app, we really only have two states: logged in or not.
 * Using simple conditional rendering is cleaner than route-based auth guards.
 * However, we still use BrowserRouter so we CAN add more routes later
 * (like /settings, /admin, etc.)
 */

import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';

function App() {
  const { isAuthenticated, loading } = useAuth();

  // Show loading screen while checking auth status
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect width="56" height="56" rx="16" fill="url(#loading-grad)" />
              <path d="M16 20h24c1.5 0 3 1.2 3 3v10c0 1.8-1.5 3-3 3h-6l-6 5-6-5h-6c-1.5 0-3-1.2-3-3V23c0-1.8 1.5-3 3-3z" fill="white" fillOpacity="0.9"/>
              <defs>
                <linearGradient id="loading-grad" x1="0" y1="0" x2="56" y2="56">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="loading-spinner">
            <span className="spinner spinner-lg" />
          </div>
          <p className="loading-text">Loading ChatApp...</p>
        </div>
      </div>
    );
  }

  // Render based on auth state
  return isAuthenticated ? <ChatPage /> : <AuthPage />;
}

export default App;
