import { useCallback, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
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

  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`;

  return (
    <nav className="navbar navbar-expand-md sf-navbar sticky-top">
      <div className="container-xl">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-semibold" to="/" onClick={() => setMenuOpen(false)}>
          <span className="sf-logo" aria-hidden="true">
            <i className="bi bi-ui-checks-grid" />
          </span>
          SurveyForge
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
              {user.photoURL ? (
                <img src={user.photoURL} alt="" width="28" height="28" className="rounded-circle" referrerPolicy="no-referrer" />
              ) : (
                <span className="sf-avatar" aria-hidden="true">
                  {initialsOf(user)}
                </span>
              )}
              <span className="d-none d-md-inline text-truncate" style={{ maxWidth: 140 }}>
                {user.displayName || user.email}
              </span>
              <i className="bi bi-chevron-down small" aria-hidden="true" />
            </button>
            <div className={`dropdown-menu dropdown-menu-end sf-user-menu shadow ${userOpen ? 'show' : ''}`} role="menu">
              <div className="px-3 py-2 small text-secondary">
                Signed in as
                <div className="text-body fw-semibold text-break">{user.email}</div>
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
