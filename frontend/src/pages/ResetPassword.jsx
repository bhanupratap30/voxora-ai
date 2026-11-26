import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(err.message);
    else {
      setSuccess('Password updated! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    }
  };

  return (
    <main className="page-container" style={{ maxWidth: 440, paddingTop: '4rem' }}>
      <section className="panel-card">
        <div className="page-header">
          <h2>Reset Password</h2>
          <p>Choose a new password for your account.</p>
        </div>
        {error && <div className="voice-error-banner">{error}</div>}
        {success && <div className="kb-success-banner">{success}</div>}
        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="password"
            className="kb-file-input"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="kb-file-input"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <button type="submit" className="primary-button">Update Password</button>
        </form>
      </section>
    </main>
  );
}
