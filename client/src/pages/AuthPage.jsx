/**
 * AUTH PAGE
 * =========
 * Landing page for unauthenticated users.
 * Toggles between Login and Register forms.
 * 
 * WHY A SINGLE AUTH PAGE (not separate /login and /register)?
 * - Smoother UX — no page navigation for switching forms
 * - Shared styling — both forms live in the same visual context
 * - Common in modern apps (Notion, Linear, etc.)
 */

import { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-bg-gradient" />
        <div className="auth-bg-grid" />
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
      </div>

      {/* Form container */}
      <div className="auth-container">
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
}
