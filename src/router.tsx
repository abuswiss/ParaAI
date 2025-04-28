// React is implicitly used in the JSX
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Chat from './pages/Chat';
import AppLayout from './components/layout/AppLayout';
import DatabaseDiagnostic from './utils/DatabaseDiagnostic';
import TemplateManager from './pages/TemplateManager';
import ProtectedRoute from './components/auth/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <Dashboard />,
          },
          {
            path: 'documents',
            element: <Documents />,
          },
          {
            path: 'cases',
            element: <Cases />,
          },
          {
            path: 'cases/:id',
            element: <CaseDetail />,
          },
          {
            path: 'chat/:id',
            element: <Chat />,
          },
          {
            path: 'diagnostic',
            element: <DatabaseDiagnostic />,
          },
          {
            path: 'templates',
            element: <TemplateManager />,
          },
        ],
      },
    ],
  },
]);

export default router;
