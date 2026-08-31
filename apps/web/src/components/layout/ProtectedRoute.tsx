import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '@ai-interview/contracts';

interface ProtectedRouteProps {
  requiredRole?: UserRole;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isSessionRestoring, mfaEnrollmentRequired, user } = useAuthStore();
  const location = useLocation();

  if (isSessionRestoring) {
    return (
      <div role="status" aria-live="polite" className="p-6 text-center">
        Restoring session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mfaEnrollmentRequired && location.pathname !== '/profile') {
    return <Navigate to="/profile?setupMfa=1" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
