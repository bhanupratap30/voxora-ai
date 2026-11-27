import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setIsLoading(true);
    setError('');
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    navigate('/');
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <AuthLayout>
      <h2 className="auth-card-title">Welcome back</h2>
      <p className="auth-card-subtitle">
        Sign in to your Voxora AI sales workspace.
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleLogin}>
        <input
          type="email"
          className="auth-input"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="auth-btn-google"
            style={{ padding: '0 0.75rem' }}
            onClick={() => setShowPassword((v) => !v)}
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          <Link to="/signup" className="auth-link">Create Account</Link>
        </div>

        <button type="submit" className="auth-btn-primary" disabled={isLoading}>
          <LogIn size={16} />
          <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
        </button>

        <button type="button" className="auth-btn-google" onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </form>
    </AuthLayout>
  );
}
