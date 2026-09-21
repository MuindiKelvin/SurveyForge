import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { friendlyAuthError, useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import payoneerLogo from '../assets/payoneer-logo-circle.png';

const POINTS = [
  { icon: 'bi-ui-checks-grid', text: 'Build surveys with any mix of question types' },
  { icon: 'bi-link-45deg', text: 'Share a link that stops working after 24 hours' },
  { icon: 'bi-file-earmark-spreadsheet', text: 'Download every result as Excel or PDF' },
];

export default function Login() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (loading) return <Loader fullPage label="Checking your session..." />;
  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const isSignUp = mode === 'signup';

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (isSignUp) await signUpWithEmail(name, email, password);
      else await signInWithEmail(email, password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Enter your email address above, then choose "Forgot password?".');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Password reset email sent. Check your inbox (and spam folder).');
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  return (
    <div className="sf-login">
      <div className="sf-login-brand d-none d-lg-flex">
        <div>
          <div className="d-flex align-items-center gap-2 mb-5">
            <img src={payoneerLogo} alt="Payoneer" className="sf-brand-logo sf-brand-logo-lg" />
            <span className="fs-4 fw-semibold">SurveyForge</span>
          </div>
          <h1 className="display-6 fw-semibold mb-4">Ask better questions. Get answers you can use.</h1>
          <ul className="list-unstyled d-grid gap-3 mb-0">
            {POINTS.map((p) => (
              <li key={p.text} className="d-flex align-items-center gap-3">
                <i className={`bi ${p.icon} fs-4`} aria-hidden="true" />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sf-login-form">
        <div className="w-100" style={{ maxWidth: 420 }}>
          <div className="d-flex align-items-center gap-2 mb-4 d-lg-none">
            <img src={payoneerLogo} alt="Payoneer" className="sf-brand-logo" />
            <span className="fs-5 fw-semibold">SurveyForge</span>
          </div>

          <h1 className="h3 mb-1">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-secondary mb-4">{isSignUp ? 'Start building surveys in a minute.' : 'Sign in to build and review surveys with your team.'}</p>

          <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2" onClick={handleGoogle} disabled={busy}>
            <i className="bi bi-google" aria-hidden="true" />
            Continue with Google
          </button>

          <div className="sf-divider my-4">
            <span>or use your email</span>
          </div>

          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="mb-3">
                <label htmlFor="name" className="form-label">
                  Your name
                </label>
                <input id="name" type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="mb-2">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={isSignUp ? 6 : undefined}
                  required
                />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {isSignUp && <div className="form-text">At least 6 characters.</div>}
            </div>

            {!isSignUp && (
              <div className="mb-3 text-end">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={handleReset}>
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="alert alert-danger py-2 small mt-3" role="alert">
                {error}
              </div>
            )}
            {info && (
              <div className="alert alert-success py-2 small mt-3" role="status">
                {info}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-100 py-2 mt-2" disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              {isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-center mt-4 mb-0 text-secondary">
            {isSignUp ? 'Already have an account?' : 'New to SurveyForge?'}{' '}
            <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}>
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          <p className="text-center mt-4 mb-0 small text-secondary">
            Designed and developed by{' '}
            <a href="https://muindikelvin.github.io" target="_blank" rel="noopener noreferrer">
              MuindiKelvin
            </a>{' '}
            for{' '}
            <a href="https://www.payoneerltd.com/" target="_blank" rel="noopener noreferrer">
              PAYONEER Research &amp; Analytics
            </a>
            <br />
            <span className="text-body-tertiary">Market Research | Business Intelligence | Strategy Consulting</span>
          </p>
        </div>
      </div>
    </div>
  );
}