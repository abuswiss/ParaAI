import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { useAuth } from '@/hooks/useAuth';
import {
  activeCaseDetailsAtom,
  isCaseDetailsLoadingAtom,
  caseDetailsFetchErrorAtom,
  activeEditorItemAtom,
  activeCaseIdAtom,
  caseDocumentsAtom,
  isCaseDocumentsLoadingAtom,
  caseDocumentsFetchErrorAtom,
  loadCaseDocumentsAtom,
  uploadModalOpenAtom,
  isNavCollapsedAtom,
  activeEditorTypeAtom,
  aiDraftContextAtom,
  selectTemplateModalOpenAtom,
  newAITemplateDraftModalOpenAtom,
} from '@/atoms/appAtoms';
import ChatInterface from '@/components/chat/ChatInterface'; // Assuming this might be needed if refactoring further later
import CaseSelector from '@/components/cases/CaseSelector';
import DocumentList from '@/components/documents/DocumentList';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { DocumentMetadata } from '@/services/documentService';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Define props for NavigationPanel
// This interface needs to exactly match the props passed from AppLayout
export interface NavigationPanelProps {
  setShowDocumentAIDraftModal: (show: boolean) => void;
  documents: DocumentMetadata[] | null;
  isDocumentsLoading: boolean;
  documentsError: string | null;
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
}

// Navigation Panel Component (Moved from AppLayout.tsx)
const NavigationPanel: React.FC<NavigationPanelProps> = ({
  setShowDocumentAIDraftModal,
  documents,
  isDocumentsLoading,
  documentsError,
  activeDocumentId,
  onSelectDocument
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const activeCaseDetails = useAtomValue(activeCaseDetailsAtom);
  const isCaseDetailsLoading = useAtomValue(isCaseDetailsLoadingAtom);
  const caseDetailsError = useAtomValue(caseDetailsFetchErrorAtom);
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const [isCollapsed, setIsCollapsed] = useAtom(isNavCollapsedAtom);
  const activeEditorType = useAtomValue(activeEditorTypeAtom);
  const setShowSelectTemplateModal = useSetAtom(selectTemplateModalOpenAtom);
  const setIsNewAITemplateModalOpen = useSetAtom(newAITemplateDraftModalOpenAtom);

  const detailsVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: 'auto' },
  };

  return (
    <div className={`flex-shrink-0 border-r border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'}`}>

      {/* --- Top Section (Always Visible) --- */}
      <div className="flex-shrink-0 p-3">
        {!isCollapsed && <h2 className="text-base font-semibold mb-3 text-neutral-800 dark:text-text-primary px-1">Navigation</h2>}
        {!isCollapsed && <CaseSelector />} {/* Hide CaseSelector when collapsed */}
        {/* Main Links (Always visible, adapt appearance) */}
        <div className={`mt-3 space-y-1 px-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
           <Link to="/dashboard" title="Dashboard" className={`flex items-center text-sm font-medium p-2 rounded-md transition-colors ${isCollapsed ? 'justify-center' : ''} ${location.pathname.startsWith('/dashboard') ? 'bg-neutral-100 dark:bg-surface-lighter text-orange-500' : 'text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter'}`}>
            <Icons.Square className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2'}`} />
             {!isCollapsed && <span className="truncate">Dashboard</span>}
          </Link>
          <Link to="/cases" title="Manage Cases" className={`flex items-center text-sm font-medium p-2 rounded-md transition-colors ${isCollapsed ? 'justify-center' : ''} ${location.pathname.startsWith('/cases') ? 'bg-neutral-100 dark:bg-surface-lighter text-orange-500' : 'text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter'}`}>
            <Icons.Folder className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2'}`} />
             {!isCollapsed && <span className="truncate">Manage Cases</span>}
          </Link>
          <Link to="/documents" title="Manage Documents" className={`flex items-center text-sm font-medium p-2 rounded-md transition-colors ${isCollapsed ? 'justify-center' : ''} ${location.pathname.startsWith('/documents') ? 'bg-neutral-100 dark:bg-surface-lighter text-orange-500' : 'text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter'}`}>
            <Icons.Document className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2'}`} />
             {!isCollapsed && <span className="truncate">Manage Documents</span>}
          </Link>
          <Link to="/templates" title="Manage Templates" className={`flex items-center text-sm font-medium p-2 rounded-md transition-colors ${isCollapsed ? 'justify-center' : ''} ${location.pathname.startsWith('/templates') ? 'bg-neutral-100 dark:bg-surface-lighter text-orange-500' : 'text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter'}`}>
             <Icons.FileText className={`h-4 w-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-2'}`} />
            {!isCollapsed && <span className="truncate">Manage Templates</span>}
          </Link>
        </div>
        {/* Create Actions Section (Only show when expanded and not in editor mode) */}
        {!isCollapsed && !activeEditorType && (
            <div className="mt-4 space-y-1 px-1 flex-shrink-0 border-t border-neutral-200 dark:border-surface-lighter pt-3">
                <Button variant="outline" size="sm" onClick={() => setUploadModalOpen(true)} className="w-full justify-start" disabled={!activeCaseId}>
                   <Icons.Upload className="h-4 w-4 mr-2" /> Upload Document
                 </Button>
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="primary" size="sm" className="w-full justify-start">
                       <Icons.Plus className="h-4 w-4 mr-2" />
                       Create New...
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent
                     align="start"
                     side="bottom"
                     className="w-56 mb-1 bg-popover text-popover-foreground border border-border shadow-md dark:bg-surface dark:text-text-primary dark:border-surface-lighter"
                   >
                     <DropdownMenuItem
                        onClick={() => navigate('/edit/document')}
                        disabled={!activeCaseId}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                      >
                       <Icons.File className="mr-2 h-4 w-4" />
                       <span>Blank Document</span>
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        onClick={() => {
                           setShowDocumentAIDraftModal(true);
                        }}
                        disabled={!activeCaseId}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                     >
                       <Icons.Sparkles className="mr-2 h-4 w-4" />
                       <span>AI Document Draft</span>
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        onClick={() => setIsNewAITemplateModalOpen(true)}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                     >
                       <Icons.FileText className="mr-2 h-4 w-4" />
                       <span>AI Template Draft</span>
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        onClick={() => navigate('/edit/template')}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                     >
                        <Icons.Document className="mr-2 h-4 w-4" />
                       <span>New Template (Manual)</span>
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        onClick={() => {
                          setShowSelectTemplateModal(true);
                        }}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                     >
                        <Icons.FileText className="mr-2 h-4 w-4" />
                       <span>Document from Template...</span>
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
            </div>
        )}
      </div>

      {/* --- Middle Section (Conditionally Rendered, Scrolling) --- */}
      <div className="flex-grow overflow-y-auto border-t border-neutral-200 dark:border-surface-lighter">
        {
          activeEditorType ? (
            // When in editor mode, show nothing in the middle scrolling section
            // Or potentially show template variables if type is 'template' - TBD
             !isCollapsed && activeEditorType === 'document' && (
                // Render Document Sidebar Area ONLY if NOT collapsed AND type is document
                <div className="p-4 text-sm text-neutral-500 italic">Document Sidebar Area</div>
             )
             // Add potential template variable list here if needed for activeEditorType === 'template'
          ) : (
            // Render Standard Middle Content only when NOT in editor and NOT collapsed
            !isCollapsed && (
                <div className="px-1 py-2 space-y-3">
                  <div>
                      <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-1 px-2">Case Details</h3>
                      <AnimatePresence>
                          {activeCaseId && (
                              <motion.div
                                  key={activeCaseId}
                                  initial="hidden"
                                  animate="visible"
                                  exit="hidden"
                                  variants={detailsVariants}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="text-xs px-1"
                              >
                                  {isCaseDetailsLoading && <p className="text-neutral-500 dark:text-text-secondary italic">Loading details...</p>}
                                  {caseDetailsError && <p className="text-error dark:text-error">Error: {caseDetailsError}</p>}
                                  {activeCaseDetails && (
                                      <>
                                          <p className="text-neutral-700 dark:text-text-primary font-medium truncate">{activeCaseDetails.name}</p>
                                          <p className="text-neutral-500 dark:text-text-secondary truncate">Client: {activeCaseDetails.client_name || 'N/A'}</p>
                                          <p className="text-neutral-500 dark:text-text-secondary truncate">Number: {activeCaseDetails.case_number || 'N/A'}</p>
                                      </>
                                  )}
                              </motion.div>
                          )}
                      </AnimatePresence>
                      {!activeCaseId && (
                          <p className="text-xs text-neutral-500 dark:text-text-secondary italic px-1">Select a case.</p>
                      )}
                  </div>
                  <div>
                      <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-1 px-2">Documents in Case</h3>
                      {activeCaseId ? (
                        <DocumentList documents={documents || []} isLoading={isDocumentsLoading} error={documentsError} activeDocumentId={activeDocumentId} onSelectDocument={onSelectDocument} />
                      ) : (
                        <p className="text-xs text-neutral-500 dark:text-text-secondary italic px-1">Select a case.</p>
                      )}
                  </div>
                </div>
            )
          )
        }
      </div>

      {/* --- Footer Area (Always Visible) --- */}
      <div className="flex-shrink-0 border-t border-neutral-200 dark:border-surface-lighter p-2">
        {/* User Info (Only show when expanded) */}
        {user && !isCollapsed && (
          <div className={`flex items-center justify-between text-xs mb-1`}>
            <span className="text-neutral-600 dark:text-text-secondary truncate" title={user.email}>{user.email}</span>
            <button onClick={signOut} className={`p-2 text-neutral-500 dark:text-text-secondary hover:text-neutral-700 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter rounded ml-2`} aria-label="Logout">
              <Icons.Logout className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Toggle Button (Always visible) */}
         <button
           onClick={() => setIsCollapsed(!isCollapsed)}
           className="w-full flex items-center justify-center p-1 text-neutral-500 dark:text-text-secondary hover:text-neutral-700 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter rounded"
           title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
         >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

export default NavigationPanel; 