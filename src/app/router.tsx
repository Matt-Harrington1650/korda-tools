import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AddToolPage } from '../pages/AddToolPage';
import { AddCustomToolPage } from '../pages/AddCustomToolPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ChatPage } from '../pages/ChatPage';
import { ToolDetailPage } from '../pages/ToolDetailPage';
import { ToolsLibraryPage } from '../pages/ToolsLibraryPage';
import { CustomToolDetailPage } from '../pages/CustomToolDetailPage';
import { WorkflowsPage } from '../pages/WorkflowsPage';
import { HelpCenterPage } from '../pages/HelpCenterPage';
import { RecordsGovernancePage } from '../pages/RecordsGovernancePage';
import { SophonLayout } from '../pages/sophon/SophonLayout';
import { SophonDashboardPage } from '../pages/sophon/SophonDashboardPage';
import { SophonSourcesPage } from '../pages/sophon/SophonSourcesPage';
import { SophonIngestionJobsPage } from '../pages/sophon/SophonIngestionJobsPage';
import { SophonIndexPage } from '../pages/sophon/SophonIndexPage';
import { SophonRetrievalLabPage } from '../pages/sophon/SophonRetrievalLabPage';
import { SophonModelsTuningPage } from '../pages/sophon/SophonModelsTuningPage';
import { SophonPoliciesAuditPage } from '../pages/sophon/SophonPoliciesAuditPage';
import { SophonBackupRestorePage } from '../pages/sophon/SophonBackupRestorePage';
import { SophonSettingsPage } from '../pages/sophon/SophonSettingsPage';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'tools', element: <ToolsLibraryPage /> },
      { path: 'tools/new', element: <AddCustomToolPage /> },
      { path: 'tools/:toolId', element: <CustomToolDetailPage /> },
      { path: 'registry/new', element: <AddToolPage /> },
      { path: 'registry/:toolId', element: <ToolDetailPage /> },
      { path: 'chat', element: <ChatPage /> },
      {
        path: 'sophon',
        element: <SophonLayout />,
        children: [
          { index: true, element: <SophonDashboardPage /> },
          { path: 'dashboard', element: <SophonDashboardPage /> },
          { path: 'sources', element: <SophonSourcesPage /> },
          { path: 'ingestion-jobs', element: <SophonIngestionJobsPage /> },
          { path: 'index', element: <SophonIndexPage /> },
          { path: 'retrieval-lab', element: <SophonRetrievalLabPage /> },
          { path: 'models-tuning', element: <SophonModelsTuningPage /> },
          { path: 'policies-audit', element: <SophonPoliciesAuditPage /> },
          { path: 'backup-restore', element: <SophonBackupRestorePage /> },
          { path: 'settings', element: <SophonSettingsPage /> },
        ],
      },
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'records', element: <RecordsGovernancePage /> },
      { path: 'help', element: <HelpCenterPage /> },
      { path: 'help/:slug', element: <HelpCenterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
