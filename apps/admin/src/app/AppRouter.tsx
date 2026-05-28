import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { useAdminAuth } from '../shared/useAdminAuth';
import {
  AIJobsPage,
  ArchiveExportRequestsPage,
  AuditLogsPage,
  ChildrenPage,
  ContentRisksPage,
  DashboardPage,
  FamiliesPage,
  InvitesPage,
  LoginPage,
  MediaPage,
  OpsReadinessPage,
  RecordsPage,
  SupportTicketsPage,
  SystemConfigPage,
  UsersPage,
} from '../pages';

export const AppRouter = () => {
  const { admin } = useAdminAuth();

  return (
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
          <Route path="/content-risks" element={<ContentRisksPage />} />
          <Route path="/support-tickets" element={<SupportTicketsPage />} />
          <Route path="/archive-export-requests" element={<ArchiveExportRequestsPage />} />
          <Route path="/ops-readiness" element={<OpsReadinessPage />} />
          <Route path="/system-config" element={<SystemConfigPage />} />
          <Route path="/audit-logs" element={admin?.role === 'super_admin' ? <AuditLogsPage /> : <Navigate to="/users" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
