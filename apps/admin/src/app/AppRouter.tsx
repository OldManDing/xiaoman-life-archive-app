import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { useAdminAuth } from '../shared/useAdminAuth';

// 页面级代码分割：首屏只加载路由壳，切换页面时按需加载对应 chunk。
// 页面标题由各页 PageShell 按 title 设置（document.title）。
const lazyPage = (loader: () => Promise<{ [key: string]: ComponentType }>, exportName: string) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const LoginPage = lazyPage(() => import('../pages/login-page'), 'LoginPage');
const DashboardPage = lazyPage(() => import('../pages/dashboard-page'), 'DashboardPage');
const UsersPage = lazyPage(() => import('../pages/list-pages'), 'UsersPage');
const FamiliesPage = lazyPage(() => import('../pages/list-pages'), 'FamiliesPage');
const InvitesPage = lazyPage(() => import('../pages/invites-page'), 'InvitesPage');
const ChildrenPage = lazyPage(() => import('../pages/list-pages'), 'ChildrenPage');
const RecordsPage = lazyPage(() => import('../pages/list-pages'), 'RecordsPage');
const MediaPage = lazyPage(() => import('../pages/list-pages'), 'MediaPage');
const AIJobsPage = lazyPage(() => import('../pages/list-pages'), 'AIJobsPage');
const AiSettingsPage = lazyPage(() => import('../pages/ai-settings-page'), 'AiSettingsPage');
const ContentRisksPage = lazyPage(() => import('../pages/content-risk-page'), 'ContentRisksPage');
const NotificationsPage = lazyPage(() => import('../pages/list-pages'), 'NotificationsPage');
const SupportTicketsPage = lazyPage(() => import('../pages/list-pages'), 'SupportTicketsPage');
const ArchiveExportRequestsPage = lazyPage(() => import('../pages/list-pages'), 'ArchiveExportRequestsPage');
const OpsReadinessPage = lazyPage(() => import('../pages/ops-readiness-page'), 'OpsReadinessPage');
const SystemConfigPage = lazyPage(() => import('../pages/system-config-page'), 'SystemConfigPage');
const AuditLogsPage = lazyPage(() => import('../pages/list-pages'), 'AuditLogsPage');

const RouteFallback = () => (
  <div className="admin-route-fallback" role="status" aria-live="polite">
    页面加载中…
  </div>
);

export const AppRouter = () => {
  const { admin } = useAdminAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/families" element={<FamiliesPage />} />
            <Route path="/invites" element={<InvitesPage />} />
            <Route path="/children" element={<ChildrenPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/ai-jobs" element={<AIJobsPage />} />
            <Route path="/ai-settings" element={<AiSettingsPage />} />
            <Route path="/content-risks" element={<ContentRisksPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/support-tickets" element={<SupportTicketsPage />} />
            <Route path="/archive-export-requests" element={<ArchiveExportRequestsPage />} />
            <Route path="/ops-readiness" element={<OpsReadinessPage />} />
            <Route path="/system-config" element={<SystemConfigPage />} />
            <Route path="/audit-logs" element={admin?.role === 'super_admin' ? <AuditLogsPage /> : <Navigate to="/users" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};
