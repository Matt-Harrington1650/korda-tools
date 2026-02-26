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
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'help', element: <HelpCenterPage /> },
      { path: 'help/:slug', element: <HelpCenterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
