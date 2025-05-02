// React is implicitly used in the JSX
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import DashboardPage from './pages/DashboardPage';
// import Documents from './pages/Documents'; // Deleted
// import Cases from './pages/Cases'; // To be deleted
import CaseDetail from './pages/CaseDetail';
import AppLayout from './components/layout/AppLayout';
// import Chat from './pages/Chat'; // Removed import
// import DatabaseDiagnostic from './utils/DatabaseDiagnostic'; // Removed import
// Removed import of TemplateManager
// import TemplateManager from './pages/TemplateManager'; 
import ProtectedRoute from './components/auth/ProtectedRoute';
import EditPage from './pages/EditPage';
// Placeholder imports for new viewer pages
import DocumentViewPage from './pages/DocumentViewPage';
import TemplateViewPage from './pages/TemplateViewPage';
// Import FileManager page/component if it's intended as a route element
import FileManager from './components/common/FileManager'; // Import the actual component
// import FileManagerPage from './pages/FileManagerPage'; // Remove import for the missing page
import SettingsPage from './pages/SettingsPage'; // Import the new Settings page
import ChatInterface from './components/chat/ChatInterface'; // Re-add import

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
            element: <FileManager />,
          },
          {
            path: 'files',
            element: <FileManager />,
          },
          {
            // Route for templates, using FileManager
            path: 'templates',
            element: <FileManager />,
          },
          {
            // Redirect /cases to /files
            path: 'cases',
            element: <Navigate to="/files" replace />,
          },
          {
            path: 'cases/:id',
            element: <CaseDetail />,
          },
          // --- Remove Chat Routes --- 
          // {
          //   path: 'chat', 
          //   element: <ChatInterface />,
          // },
          // {
          //   path: 'chat/:conversationId', 
          //   element: <ChatInterface />,
          // },
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
          // --- Add Settings Route ---
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);

export default router;
