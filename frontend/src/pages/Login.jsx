import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
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
    <main className="page-container" style={{ maxWidth: 440, paddingTop: '4rem' }}>
      <section className="panel-card">
        <div className="page-header">
          <h2>Sign in to Voxora AI</h2>
          <p>Access your AI sales voice agent and CRM workspace.</p>
        </div>
        {error && <div className="voice-error-banner" role="alert">{error}</div>}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="email"
            className="kb-file-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="kb-file-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/signup">Create account</Link>
          </div>
          <button type="submit" className="primary-button" disabled={isLoading}>
            <LogIn size={16} />
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
          <button type="button" className="secondary-button" onClick={handleGoogleLogin}>
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
