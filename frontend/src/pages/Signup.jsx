import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [companyName, setCompanyName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the terms and conditions.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    const { error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          account_type: accountType,
          company_name: accountType === 'company' ? companyName : null,
        },
      },
    });
    setIsLoading(false);

    if (authErr) {
      setError(authErr.message);
      return;
    }
    setSuccess('Account created! Please check your email to verify your account.');
  };

  return (
    <main className="page-container" style={{ maxWidth: 480, paddingTop: '3rem' }}>
      <section className="panel-card">
        <div className="page-header">
          <h2>Create your Voxora AI account</h2>
          <p>Start with an individual or company workspace.</p>
        </div>
        {error && <div className="voice-error-banner" role="alert">{error}</div>}
        {success && <div className="kb-success-banner" role="status">{success}</div>}
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="text"
            className="kb-file-input"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            type="email"
            className="kb-file-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            className="kb-file-input"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            aria-label="Account type"
          >
            <option value="individual">Individual Workspace</option>
            <option value="company">Company Workspace</option>
          </select>
          {accountType === 'company' && (
            <input
              type="text"
              className="kb-file-input"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            className="kb-file-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="kb-file-input"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>I accept the Terms and Conditions</span>
          </label>
          <button type="submit" className="primary-button" disabled={isLoading}>
            <UserPlus size={16} />
            <span>{isLoading ? 'Creating account...' : 'Create Account'}</span>
          </button>
          <div style={{ fontSize: '0.875rem', textAlign: 'center' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
