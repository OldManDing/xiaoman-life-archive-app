import { AuthProvider } from '../shared/AuthContext';
import { AppRouter } from './AppRouter';

export const App = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};
