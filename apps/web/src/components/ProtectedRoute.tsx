import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext';
import { hasSeenWelcomeIntro } from '../shared/welcome';

export const ProtectedRoute = () => {
  const { isAuthenticated, needsOnboarding } = useAuth();
  
  if (!isAuthenticated) {
    if (!hasSeenWelcomeIntro()) {
      return <Navigate to="/welcome" replace />;
    }
    return <Navigate to="/auth/login" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding/child" replace />;
  }
  
  return <Outlet />;
};
