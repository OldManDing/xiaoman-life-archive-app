import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { 
  LoginPage, SplashPage, HomePage, TimelinePage, CreateRecordPage, 
  SearchPage, ViewRecordPage, EditRecordPage, FamilyPage, FamilyChildPage, 
  FamilyMembersPage, FamilyMemberDetailPage, FamilyInvitePage, ProfilePage, AccountPage, 
  SettingsPage, LegalPage, ReportsPage, ExportBackupPage, MembershipPage,
  SecurityPage, HelpFeedbackPage, AboutPage, AccountDeletionPage, ErrorPage, OnboardingChildPage
} from '../pages/index';

const authRoutes = new Set(['/auth/login', '/splash', '/onboarding/child']);
const tabRoutes = new Set(['/home', '/timeline', '/family', '/profile']);

const NativeBackButtonHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/legal') {
        navigate('/auth/login');
        return;
      }

      if (location.pathname === '/profile/legal') {
        navigate('/profile');
        return;
      }

      if (canGoBack && !authRoutes.has(location.pathname) && !tabRoutes.has(location.pathname)) {
        navigate(-1);
        return;
      }

      void CapacitorApp.exitApp();
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = () => void handle.remove();
    });

    return () => {
      active = false;
      removeListener?.();
    };
  }, [location.pathname, navigate]);

  return null;
};

export const AppRouter = () => {
  const { isBootstrapping, isAuthenticated, needsOnboarding } = useAuth();

  if (isBootstrapping) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#faf8f5',
          color: '#57534e',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        正在进入年轮…
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <NativeBackButtonHandler />
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
          <Route path="/legal" element={<LegalPage />} />
        </Route>
        
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to={needsOnboarding ? '/onboarding/child' : '/home'} replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="record/create" element={<CreateRecordPage />} />
            <Route path="record/:record_no" element={<ViewRecordPage />} />
            <Route path="record/:record_no/edit" element={<EditRecordPage />} />
            <Route path="family" element={<FamilyPage />} />
            <Route path="family/child" element={<FamilyChildPage />} />
            <Route path="family/members" element={<FamilyMembersPage />} />
            <Route path="family/members/:user_no" element={<FamilyMemberDetailPage />} />
            <Route path="family/invite" element={<FamilyInvitePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/account" element={<AccountPage />} />
            <Route path="profile/reports" element={<ReportsPage />} />
            <Route path="profile/export" element={<ExportBackupPage />} />
            <Route path="profile/membership" element={<MembershipPage />} />
            <Route path="profile/security" element={<SecurityPage />} />
            <Route path="profile/account-delete" element={<AccountDeletionPage />} />
            <Route path="profile/help" element={<HelpFeedbackPage />} />
            <Route path="profile/settings" element={<SettingsPage />} />
            <Route path="profile/legal" element={<LegalPage />} />
            <Route path="profile/about" element={<AboutPage />} />
          </Route>
        </Route>
        
        <Route path="/error" element={<ErrorPage />} />
        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
