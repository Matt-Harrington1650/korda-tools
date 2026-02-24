import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AddToolPage } from '../pages/AddToolPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ToolDetailPage } from '../pages/ToolDetailPage';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'tools/new', element: <AddToolPage /> },
      { path: 'tools/:toolId', element: <ToolDetailPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
