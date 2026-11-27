import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { supabase } from '../lib/supabase.js';

function getPasswordStrength(pw) {
  if (!pw) return '';
  if (pw.length >= 10 && /[A-Z]/.test(pw) && /\d/.test(pw)) return 'Strong';
  if (pw.length >= 6) return 'Medium';
  return 'Weak';
}

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

  const strength = getPasswordStrength(password);

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
      setError('Please accept the Terms and Privacy Policy.');
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

  const handleGoogleSignup = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <AuthLayout>
      <h2 className="auth-card-title">Create your Voxora account</h2>
      <p className="auth-card-subtitle">
        Start automating sales conversations in minutes.
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="auth-success" role="status">{success}</div>}

      <form className="auth-form" onSubmit={handleSignup}>
        <input
          type="text"
          className="auth-input"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          type="email"
          className="auth-input"
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          className="auth-input"
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
            className="auth-input"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        )}
        <input
          type="password"
          className="auth-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {strength && (
          <div style={{ fontSize: '0.75rem', color: '#A78BFA' }}>
            Password strength: {strength}
          </div>
        )}
        <input
          type="password"
          className="auth-input"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <label style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: '#A1A1B5' }}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>I accept the Terms and Privacy Policy</span>
        </label>
        <button type="submit" className="auth-btn-primary" disabled={isLoading}>
          <UserPlus size={16} />
          <span>{isLoading ? 'Creating account...' : 'Create Account'}</span>
        </button>
        <button type="button" className="auth-btn-google" onClick={handleGoogleSignup}>
          Continue with Google
        </button>
        <div style={{ fontSize: '0.875rem', textAlign: 'center', color: '#A1A1B5' }}>
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
