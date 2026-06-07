/**
 * REGISTER FORM COMPONENT
 * =======================
 * Similar to LoginForm but with additional fields and validation.
 * 
 * CLIENT-SIDE VALIDATION:
 * We validate on the client for better UX (instant feedback),
 * but the server also validates (never trust the client alone!).
 * 
 * The pattern is called "defense in depth" — validate at every layer.
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function RegisterForm({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation (server also validates)
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password);
      // AuthContext sets user → redirect to chat
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#logo-gradient-reg)" />
            <path d="M20 10c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="white" fillOpacity="0.9"/>
            <defs>
              <linearGradient id="logo-gradient-reg" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#8b5cf6"/>
                <stop offset="1" stopColor="#ec4899"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>Create account</h1>
        <p>Join the conversation today</p>
      </div>

      <form onSubmit={handleSubmit} id="register-form">
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0v3a1 1 0 11-2 0V5zm1 7a1 1 0 100-2 1 1 0 000 2z"/>
            </svg>
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            type="text"
            placeholder="johndoe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-confirm-password">Confirm Password</label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="auth-button"
          disabled={loading}
          id="register-submit"
        >
          {loading ? (
            <span className="button-loader">
              <span className="spinner" />
              Creating account...
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="auth-link" id="switch-to-login">
          Sign in
        </button>
      </div>
    </div>
  );
}
