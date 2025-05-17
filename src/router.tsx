// React is implicitly used in the JSX
import React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
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
// import EditPage from './pages/EditPage'; // Deprecated
// Placeholder imports for new viewer pages - Deprecated
// import DocumentViewPage from './pages/DocumentViewPage';
// import TemplateViewPage from './pages/TemplateViewPage';
// Import FileManager page/component if it's intended as a route element
import FileManager from './components/common/FileManager'; // Import the actual component
// import FileManagerPage from './pages/FileManagerPage'; // Remove import for the missing page
import SettingsPage from './pages/SettingsPage'; // Import the new Settings page
// ChatInterface import removed
import ClaudeChatInterface from './components/claude/ClaudeChatInterface'; // Import the new Claude chat interface
import DocumentComparisonPage from './pages/DocumentComparisonPage';
import LegalConceptExplainerPage from './pages/explain-concept'; // Import the page
import QuickScanPage from './pages/QuickScanPage'; // Assuming QuickScanPage is also needed

// Import the new modules
import NewDocumentReviewerModule from './pages/cases/[caseId]/NewDocumentReviewerModule'; // Updated import path
import AIDraftingTemplateModule from './pages/AIDraftingTemplateModule';
import TemplateFiller from './pages/templates/[templateId]/fill/TemplateFiller'; // Added import for new TemplateFillerPage

// Import new AI Tools pages
import IntelligentTranslationsPage from './pages/tools/IntelligentTranslationsPage';
import IntelligentDraftingPage from './pages/tools/IntelligentDraftingPage';
import CopilotMainInterfacePage from '@/pages/tools/discovery-copilot'; // Import the new page

// Import the Landing Page
import LandingPage from './pages/LandingPage'; // <<< NEW IMPORT

// Helper components for redirects
const ReviewDocumentRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/app/review/document/${id}`} replace />; // <<< UPDATED PATH
};

const FillTemplateRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/app/ai/templates/${id}/fill`} replace />; // <<< UPDATED PATH
};

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/', // <<< NEW LANDING PAGE ROUTE
    element: <LandingPage />,
  },
  {
    path: '/app', // <<< NEW APP BASE PATH
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> }, // <<< UPDATED PATH
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            // FileManager remains for browsing files/cases/templates
            path: 'files',
            element: <FileManager />,
          },
          {
            // Explicit path for templates view via FileManager (leads to template management)
            path: 'templates',
            element: <Navigate to="/app/ai/templates/manage" replace />, // <<< UPDATED PATH
          },
          {
            // Redirect old /documents to /files (general file browsing)
            path: 'documents',
            element: <Navigate to="/app/files" replace />, // <<< UPDATED PATH
          },
          {
            // Redirect old /cases to /files (general file browsing)
            path: 'cases',
            element: <Navigate to="/app/files" replace />, // <<< UPDATED PATH
          },
          {
            // Keeping case detail, but interactions might change
            path: 'cases/:id',
            element: <CaseDetail />,
          },
          // Legal Assistant Routes REMOVED (as per previous phases, assuming this is still desired)
          // {
          //   path: 'claude',
          //   element: <ClaudeChatInterface />,
          // },
          // {
          //   path: 'claude/:conversationId',
          //   element: <ClaudeChatInterface />,
          // },

          // --- DEPRECATED Routes (ensure these are covered by new redirects) ---
          // {
          //   path: 'edit/:type/:id?',
          //   element: <EditPage />, // Should be redirected
          // },
          // {
          //   path: 'view/document/:id',
          //   element: <DocumentViewPage />, // Should be redirected
          // },
          // {
          //   path: 'view/template/:id',
          //   element: <TemplateViewPage />, // Should be redirected
          // },

          // --- NEW Module Routes ---
          {
            // Handles viewing and analyzing existing documents
            path: 'review/document/:id',
            element: <NewDocumentReviewerModule />,
          },
          {
            // Handles AI template generation management (listing, initiating new generation)
            path: 'ai/templates/manage',
            element: <AIDraftingTemplateModule />,
          },
          {
            // Handles visual filling of an AI-generated template
            path: 'ai/templates/:id/fill',
            element: <TemplateFiller />,
          },
          {
            // Handles viewing/editing an AI-generated document draft
            path: 'draft/document/:id', // Drafts are saved and reviewed/edited like other documents
            element: <NewDocumentReviewerModule />,
          },
          // Restore QuickScanPage and LegalConceptExplainerPage routes
          {
            path: 'quick-scan',
            element: <QuickScanPage />,
          },
          {
            path: 'explain-concept',
            element: <LegalConceptExplainerPage />,
          },
          
          // --- NEW AI Tools Routes ---
          {
            path: 'tools/intelligent-translations',
            element: <IntelligentTranslationsPage />,
          },
          {
            path: 'tools/intelligent-drafting',
            element: <IntelligentDraftingPage />,
          },
          {
            path: 'tools/discovery-copilot', // <<< Route being tested
            element: <CopilotMainInterfacePage />,
          },
          
          // --- Existing Routes ---
          {
            path: 'settings',
            element: <SettingsPage />,
            // Adding a child route for /settings/subscription that also renders SettingsPage
            // This ensures that if ProtectedRoute or other links navigate to /settings/subscription,
            // it resolves correctly. SettingsPage itself now includes SubscriptionManagement.
            children: [
              {
                path: 'subscription',
                element: <SettingsPage />,
              }
            ]
          },
          {
            path: 'cases/:caseId/compare',
            element: <DocumentComparisonPage />,
          },

           // --- Redirect old view routes to new review/fill routes ---
          {
            path: 'view/document/:id',
            element: <ReviewDocumentRedirect />,
          },
          {
            path: 'view/template/:id',
            element: <FillTemplateRedirect />,
          },
          // Redirect old edit routes
          {
            path: 'edit/document/:id',
            element: <ReviewDocumentRedirect />,
          },
          {
            path: 'edit/template/:id',
            element: <FillTemplateRedirect />,
          },
          // Redirect for old /draft/template path (if users had it bookmarked for general template work)
          // This now points to template management. Specific template editing (filling) is /app/ai/templates/:id/fill
          {
            path: 'draft/template/:id?',
            element: <Navigate to="/app/ai/templates/manage" replace />, // <<< UPDATED PATH
          },
           // Redirect for old /draft/ai (generic AI draft) to template management as starting point
          {
            path: 'draft/ai',
            element: <Navigate to="/app/ai/templates/manage" replace />, // <<< UPDATED PATH
          },

        ],
      },
    ],
  },
]);

export default router;
