import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SetupNotice from './components/SetupNotice';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { isFirebaseConfigured } from './firebase';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import PublicSurvey from './pages/PublicSurvey';
import SurveyBuilder from './pages/SurveyBuilder';
import SurveyDetail from './pages/SurveyDetail';
import SurveyResults from './pages/SurveyResults';

function Root() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </ToastProvider>
  );
}

export const routes = [
  {
    element: <Root />,
    children: [
      { path: '/s/:shareId', element: <PublicSurvey /> },
      { path: '/login', element: <Login /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/surveys/new', element: <SurveyBuilder /> },
          { path: '/surveys/:id/edit', element: <SurveyBuilder /> },
          { path: '/surveys/:id/results', element: <SurveyResults /> },
          { path: '/surveys/:id', element: <SurveyDetail /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = isFirebaseConfigured ? createBrowserRouter(routes) : null;

export default function App() {
  if (!router) return <SetupNotice />;
  return <RouterProvider router={router} />;
}
