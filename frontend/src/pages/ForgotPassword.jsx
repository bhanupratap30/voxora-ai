import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setError('');
    setSuccess('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
    else setSuccess('Password reset email sent. Check your inbox.');
  };

  return (
    <main className="page-container" style={{ maxWidth: 440, paddingTop: '4rem' }}>
      <section className="panel-card">
        <div className="page-header">
          <h2>Forgot Password</h2>
          <p>Enter your email to receive a password reset link.</p>
        </div>
        {error && <div className="voice-error-banner">{error}</div>}
        {success && <div className="kb-success-banner">{success}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="email"
            className="kb-file-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="primary-button">Send Reset Link</button>
          <Link to="/login" style={{ fontSize: '0.875rem', textAlign: 'center' }}>Back to Sign In</Link>
        </form>
      </section>
    </main>
  );
}
