import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppNavbar from './AppNavbar';
import Loader from './Loader';

/** Layout for every page that needs a signed-in user. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader fullPage label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <>
      <AppNavbar />
      <main className="sf-main">
        <Outlet />
      </main>
    </>
  );
}
