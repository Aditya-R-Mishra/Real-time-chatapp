/**
 * LOGIN FORM COMPONENT
 * ====================
 * A controlled form that handles user login.
 * 
 * "CONTROLLED FORM" means React manages the form state:
 * - Every input value is stored in React state (useState)
 * - Every keystroke updates the state (onChange handlers)
 * - On submit, we read from state (not from the DOM)
 * 
 * WHY CONTROLLED?
 * - Single source of truth (state, not DOM)
 * - Easy to validate before submit
 * - Easy to clear/reset form after submission
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent page refresh (default form behavior)
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // AuthContext sets the user → App.jsx redirects to ChatPage
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#logo-gradient)" />
            <path d="M12 14h16c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2h-4l-4 4-4-4h-4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2z" fill="white" fillOpacity="0.9"/>
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#6366f1"/>
                <stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to continue to your conversations</p>
      </div>

      <form onSubmit={handleSubmit} id="login-form">
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0v3a1 1 0 11-2 0V5zm1 7a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            minLength={6}
          />
        </div>

        <button
          type="submit"
          className="auth-button"
          disabled={loading}
          id="login-submit"
        >
          {loading ? (
            <span className="button-loader">
              <span className="spinner" />
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="auth-switch">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="auth-link" id="switch-to-register">
          Create one
        </button>
      </div>
    </div>
  );
}
