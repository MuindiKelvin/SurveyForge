import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
      <i className="bi bi-compass display-3 text-secondary" aria-hidden="true" />
      <h1 className="h3 mt-3">Page not found</h1>
      <p className="text-secondary">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn btn-primary">
        <i className="bi bi-house me-2" aria-hidden="true" />
        Go to surveys
      </Link>
    </div>
  );
}
