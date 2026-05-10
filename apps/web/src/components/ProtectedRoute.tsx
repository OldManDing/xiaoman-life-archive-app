import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext';

export const ProtectedRoute = () => {
  const { isAuthenticated, needsOnboarding } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding/child" replace />;
  }
  
  return <Outlet />;
};
