import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext';
import { webApi } from '../shared/api/webApi';
import { initializeHmsPush } from '../shared/hmsPush';
import { registerNativeNotificationTapHandler, scheduleNativeNotificationsForNewItems } from '../shared/nativeNotifications';
import { markWelcomeIntroSeen } from '../shared/welcome';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { BrandBootMotion } from '../components/BrandBootMotion';
import {
  LoginPage, SplashPage, WelcomePage, HomePage, TimelinePage, CreateRecordPage,
  SearchPage, ViewRecordPage, EditRecordPage, FamilyPage, FamilyChildPage,
  FamilyMembersPage, FamilyMemberDetailPage, FamilyInvitePage, ProfilePage, MessagesPage, NotificationSettingsPage, AccountPage,
  SettingsPage, LegalPage, ReportsPage, ExportBackupPage, MembershipPage,
  SecurityPage, HelpFeedbackPage, AboutPage, ContactPage, AccountDeletionPage, ErrorPage, OnboardingChildPage
} from '../pages/index';

const authRoutes = new Set(['/auth/login', '/splash', '/welcome', '/onboarding/child']);
const tabRoutes = new Set(['/home', '/timeline', '/family', '/profile']);
const bootRecoveryDelayMs = 8000;
const bootMinimumVisibleMs = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true' ? 0 : 3000;

const RouteSurfaceReady = ({ onReady }: { onReady: () => void }) => {
  useEffect(() => {
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (!cancelled) onReady();
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [onReady]);

  return null;
};

const NativeBackButtonHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const backEvent = new CustomEvent('nianlun:native-back-button', {
        cancelable: true,
        detail: { pathname: location.pathname },
      });
      if (!window.dispatchEvent(backEvent)) return;

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

const NativeNotificationBridge = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => registerNativeNotificationTapHandler(navigate), [navigate]);

  useEffect(() => {
    if (!isAuthenticated || !Capacitor.isNativePlatform()) return undefined;

    let cancelled = false;
    let appStateRemove: (() => void) | undefined;
    let hmsPushRemove: (() => void) | undefined;
    const syncNotifications = async () => {
      try {
        const notifications = await webApi.listNotifications({ page: 1, page_size: 5 });
        if (!cancelled) await scheduleNativeNotificationsForNewItems(notifications.list);
      } catch {
        // In-app message center remains the source of truth if a background check fails.
      }
    };

    void initializeHmsPush(navigate).then((remove) => {
      if (cancelled) {
        remove();
        return;
      }
      hmsPushRemove = remove;
      void syncNotifications();
    });
    const timer = window.setInterval(() => void syncNotifications(), 60_000);
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncNotifications();
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      appStateRemove = () => void handle.remove();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      appStateRemove?.();
      hmsPushRemove?.();
    };
  }, [isAuthenticated, navigate]);

  return null;
};

export const AppRouter = () => {
  const { isBootstrapping, isAuthenticated, needsOnboarding, clearSession } = useAuth();
  const [showBootRecovery, setShowBootRecovery] = useState(false);
  const [bootMinimumElapsed, setBootMinimumElapsed] = useState(() => bootMinimumVisibleMs <= 0);
  const [routeSurfaceReady, setRouteSurfaceReady] = useState(false);
  const markRouteSurfaceReady = useCallback(() => setRouteSurfaceReady(true), []);

  useEffect(() => {
    if (!isBootstrapping) {
      setShowBootRecovery(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setShowBootRecovery(true), bootRecoveryDelayMs);
    return () => window.clearTimeout(timer);
  }, [isBootstrapping]);

  useEffect(() => {
    if (bootMinimumVisibleMs <= 0) {
      setBootMinimumElapsed(true);
      return undefined;
    }
    setBootMinimumElapsed(false);
    const timer = window.setTimeout(() => setBootMinimumElapsed(true), bootMinimumVisibleMs);
    return () => window.clearTimeout(timer);
  }, []);

  const shouldMountRoutes = !isBootstrapping && bootMinimumElapsed;

  if (!shouldMountRoutes) {
    return (
      <BrandBootMotion
        showRecovery={showBootRecovery}
        onRetry={() => window.location.reload()}
        onExit={() => {
          markWelcomeIntroSeen();
          clearSession();
        }}
      />
    );
  }

  return (
    <>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <RouteSurfaceReady onReady={markRouteSurfaceReady} />
        <NativeBackButtonHandler />
        <NativeNotificationBridge />
        <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/welcome" element={isAuthenticated ? <Navigate to={needsOnboarding ? '/onboarding/child' : '/home'} replace /> : <WelcomePage />} />
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
            <Route path="profile/messages" element={<MessagesPage />} />
            <Route path="profile/notifications" element={<NotificationSettingsPage />} />
            <Route path="profile/account" element={<AccountPage />} />
            <Route path="profile/reports" element={<Navigate to="/profile" replace />} />
            <Route path="profile/export" element={<Navigate to="/profile" replace />} />
            <Route path="profile/membership" element={<Navigate to="/profile" replace />} />
            <Route path="profile/security" element={<SecurityPage />} />
            <Route path="profile/account-delete" element={<AccountDeletionPage />} />
            <Route path="profile/help" element={<HelpFeedbackPage />} />
            <Route path="profile/settings" element={<SettingsPage />} />
            <Route path="profile/legal" element={<LegalPage />} />
            <Route path="profile/about" element={<AboutPage />} />
            <Route path="profile/contact" element={<ContactPage />} />
          </Route>
        </Route>
        
        <Route path="/error" element={<ErrorPage />} />
        <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
      </BrowserRouter>
      {!routeSurfaceReady ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--nl-page-bg)' }}>
          <BrandBootMotion />
        </div>
      ) : null}
    </>
  );
};
