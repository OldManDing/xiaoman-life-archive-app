import { useContext } from 'react';

import { AuthContext } from './authContext';

export const useAdminAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AuthProvider');
  }
  return context;
};
