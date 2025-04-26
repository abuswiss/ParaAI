// React is implicitly used in the JSX
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Chat from './pages/Chat';
import MainLayout from './components/layout/MainLayout';
import DatabaseDiagnostic from './utils/DatabaseDiagnostic';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
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
      // Add more routes for other features here as they are implemented
    ],
  },
]);

export default router;
