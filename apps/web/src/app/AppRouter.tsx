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
        aria-busy="true"
        aria-label="正在进入年轮"
        style={{
          minHeight: '100dvh',
          boxSizing: 'border-box',
          padding: 'max(22px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom))',
          background: 'var(--nl-page-bg)',
          color: 'var(--nl-muted-strong)',
          display: 'grid',
          alignContent: 'start',
          gap: '18px',
        }}
      >
        <style>
          {`
            @keyframes nlBootPulse {
              0%, 100% { opacity: 0.52; transform: translateY(0); }
              50% { opacity: 0.95; transform: translateY(-1px); }
            }
          `}
        </style>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '15px',
                background: 'rgba(var(--nl-primary-rgb),0.18)',
                border: '1px solid var(--nl-border)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--nl-primary)',
                fontSize: '16px',
                fontWeight: 900,
              }}
            >
              年
            </div>
            <div style={{ display: 'grid', gap: '5px', minWidth: 0 }}>
              <strong style={{ color: 'var(--nl-ink)', fontSize: '17px', lineHeight: 1.1 }}>年轮</strong>
              <span style={{ color: 'var(--nl-muted)', fontSize: '12px', fontWeight: 700 }}>正在进入家庭时间线</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '999px', background: 'rgba(var(--nl-surface-rgb),0.7)', border: '1px solid var(--nl-border)', animation: 'nlBootPulse 1.6s ease-in-out infinite' }} />
        </header>

        <main style={{ display: 'grid', gap: '14px' }}>
          <section
            style={{
              borderRadius: '24px',
              border: '1px solid var(--nl-border)',
              background: 'rgba(var(--nl-surface-rgb),0.72)',
              padding: '18px',
              display: 'grid',
              gap: '14px',
              boxShadow: 'var(--nl-shadow-sm)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ width: '42%', height: '13px', borderRadius: '999px', background: 'rgba(var(--nl-surface-strong-rgb),0.9)', animation: 'nlBootPulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '82%', height: '26px', borderRadius: '999px', background: 'rgba(var(--nl-primary-rgb),0.18)', animation: 'nlBootPulse 1.55s ease-in-out infinite' }} />
            <div style={{ width: '64%', height: '13px', borderRadius: '999px', background: 'rgba(var(--nl-surface-strong-rgb),0.72)', animation: 'nlBootPulse 1.7s ease-in-out infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '2px' }}>
              {[0, 1, 2].map((item) => (
                <div key={item} style={{ height: '42px', borderRadius: '16px', background: 'rgba(var(--nl-surface-rgb),0.62)', border: '1px solid var(--nl-border)', animation: `nlBootPulse ${1.45 + item * 0.08}s ease-in-out infinite` }} />
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gap: '10px' }}>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                style={{
                  minHeight: '78px',
                  borderRadius: '20px',
                  border: '1px solid var(--nl-border)',
                  background: 'rgba(var(--nl-surface-rgb),0.58)',
                  padding: '14px',
                  display: 'grid',
                  gap: '10px',
                  animation: `nlBootPulse ${1.55 + item * 0.1}s ease-in-out infinite`,
                }}
              >
                <div style={{ width: item === 0 ? '72%' : item === 1 ? '58%' : '66%', height: '14px', borderRadius: '999px', background: 'rgba(var(--nl-surface-strong-rgb),0.72)' }} />
                <div style={{ width: item === 0 ? '46%' : item === 1 ? '70%' : '52%', height: '12px', borderRadius: '999px', background: 'rgba(var(--nl-surface-strong-rgb),0.58)' }} />
              </div>
            ))}
          </section>
        </main>
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
