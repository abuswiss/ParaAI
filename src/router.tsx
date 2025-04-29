// React is implicitly used in the JSX
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import DashboardPage from './pages/DashboardPage';
import Documents from './pages/Documents';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Chat from './pages/Chat';
import AppLayout from './components/layout/AppLayout';
import DatabaseDiagnostic from './utils/DatabaseDiagnostic';
import TemplateManager from './pages/TemplateManager';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EditPage from './pages/EditPage';
// Placeholder imports for new viewer pages
import DocumentViewPage from './pages/DocumentViewPage';
import TemplateViewPage from './pages/TemplateViewPage';

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
            element: <DashboardPage />,
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
          {
            path: 'edit/:type/:id?',
            element: <EditPage />,
          },
          // --- New Viewer Routes ---
          {
            path: 'view/document/:id',
            element: <DocumentViewPage />,
          },
          {
            path: 'view/template/:id',
            element: <TemplateViewPage />,
          },
        ],
      },
    ],
  },
]);

export default router;
