import { useCallback, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { friendlyAuthError, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOutsideClick } from '../hooks/useOutsideClick';

function initialsOf(user) {
  const source = user.displayName || user.email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

export default function AppNavbar() {
  const { user, logout, resendVerification, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const userRef = useRef(null);
  const closeUser = useCallback(() => setUserOpen(false), []);
  useOutsideClick(userRef, closeUser, userOpen);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Could not sign out. Please try again.');
    }
  };

  const handleResend = async () => {
    setVerifyBusy(true);
    try {
      await resendVerification();
      toast.success(`Verification email sent to ${user.email}. Check your inbox (and spam folder).`);
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleRecheck = async () => {
    setVerifyBusy(true);
    try {
      const verified = await refreshUser();
      if (verified) toast.success('Email verified. Thank you!');
      else toast.info('Your email is not verified yet. Open the link in the email we sent you, then check again.');
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setVerifyBusy(false);
    }
  };

  const verified = Boolean(user.emailVerified);
  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`;

  return (
    <nav className="navbar navbar-expand-md sf-navbar sticky-top">
      <div className="container-xl">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-semibold" to="/" onClick={() => setMenuOpen(false)}>
          <span className="sf-logo" aria-hidden="true">
            <i className="bi bi-ui-checks-grid" />
          </span>
          SurveyHub
        </Link>

        <button
          className="navbar-toggler border-0"
          type="button"
          aria-controls="sf-nav"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'} fs-4`} />
        </button>

        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`} id="sf-nav">
          <ul className="navbar-nav me-auto mb-2 mb-md-0">
            <li className="nav-item">
              <NavLink end to="/" className={linkClass} onClick={() => setMenuOpen(false)}>
                <i className="bi bi-grid me-1" aria-hidden="true" /> Surveys
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/surveys/new" className={linkClass} onClick={() => setMenuOpen(false)}>
                <i className="bi bi-plus-circle me-1" aria-hidden="true" /> New survey
              </NavLink>
            </li>
          </ul>

          <div className="position-relative" ref={userRef}>
            <button
              type="button"
              className="btn btn-light d-flex align-items-center gap-2 border sf-user-btn"
              aria-haspopup="menu"
              aria-expanded={userOpen}
              onClick={() => setUserOpen((o) => !o)}
            >
              <span className="sf-avatar-wrap">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" width="28" height="28" className="rounded-circle" referrerPolicy="no-referrer" />
                ) : (
                  <span className="sf-avatar" aria-hidden="true">
                    {initialsOf(user)}
                  </span>
                )}
                {!verified && (
                  <i className="bi bi-exclamation-circle-fill sf-verify-badge sf-unverified" title="Email not verified" role="img" aria-label="Email not verified" />
                )}
              </span>
              <span className="d-none d-md-inline text-truncate" style={{ maxWidth: 140 }}>
                {user.displayName || user.email}
              </span>
              {verified && <i className="bi bi-patch-check-fill sf-verified d-none d-md-inline" title="Email verified" role="img" aria-label="Email verified" />}
              <i className="bi bi-chevron-down small" aria-hidden="true" />
            </button>
            <div className={`dropdown-menu dropdown-menu-end sf-user-menu shadow ${userOpen ? 'show' : ''}`} role="menu">
              <div className="px-3 py-2 small text-secondary">
                Signed in as
                <div className="text-body fw-semibold text-break">{user.email}</div>
                {verified ? (
                  <div className="sf-verified small mt-1" data-testid="email-verified">
                    <i className="bi bi-patch-check-fill me-1" aria-hidden="true" />
                    Email verified
                  </div>
                ) : (
                  <div className="small mt-1" data-testid="email-unverified">
                    <div className="sf-unverified">
                      <i className="bi bi-exclamation-circle-fill me-1" aria-hidden="true" />
                      Email not verified
                    </div>
                    <div className="mt-1">Open the link in the email we sent you, or get a new one.</div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleResend} disabled={verifyBusy}>
                        Send link again
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleRecheck} disabled={verifyBusy}>
                        I've verified
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="dropdown-divider" />
              <button type="button" className="dropdown-item" role="menuitem" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
