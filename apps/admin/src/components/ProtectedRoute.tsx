import { Navigate, Outlet } from 'react-router-dom';

import { useAdminAuth } from '../shared/useAdminAuth';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAdminAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
