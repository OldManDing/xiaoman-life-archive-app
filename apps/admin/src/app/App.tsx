import { AuthProvider } from '../shared/auth';
import { AppRouter } from './AppRouter';

export const App = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};
