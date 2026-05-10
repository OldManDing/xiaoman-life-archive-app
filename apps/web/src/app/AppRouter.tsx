import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { 
  LoginPage, SplashPage, HomePage, TimelinePage, CreateRecordPage, 
  ViewRecordPage, EditRecordPage, FamilyPage, FamilyChildPage, 
  FamilyMembersPage, FamilyInvitePage, ProfilePage, AccountPage, 
  SettingsPage, LegalPage, ErrorPage, OnboardingChildPage, FamilyInviteAcceptPage
} from '../pages/index';

export const AppRouter = () => {
  const { isBootstrapping, isAuthenticated, needsOnboarding } = useAuth();

  if (isBootstrapping) {
    return <div>Auth Bootstrap Loading</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/splash" element={<SplashPage />} />
          <Route
            path="/auth/login"
            element={isAuthenticated ? <Navigate to={needsOnboarding ? '/onboarding/child' : '/home'} replace /> : <LoginPage />}
          />
          <Route
            path="/onboarding/child"
            element={isAuthenticated ? <OnboardingChildPage /> : <Navigate to="/auth/login" replace />}
          />
        </Route>
        
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to={needsOnboarding ? '/onboarding/child' : '/home'} replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="record/create" element={<CreateRecordPage />} />
            <Route path="record/:record_no" element={<ViewRecordPage />} />
            <Route path="record/:record_no/edit" element={<EditRecordPage />} />
            <Route path="family" element={<FamilyPage />} />
            <Route path="family/child" element={<FamilyChildPage />} />
            <Route path="family/members" element={<FamilyMembersPage />} />
            <Route path="family/invite" element={<FamilyInvitePage />} />
            <Route path="family/invite/:token/accept" element={<FamilyInviteAcceptPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/account" element={<AccountPage />} />
            <Route path="profile/settings" element={<SettingsPage />} />
            <Route path="profile/legal" element={<LegalPage />} />
          </Route>
        </Route>
        
        <Route path="/error" element={<ErrorPage />} />
        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
