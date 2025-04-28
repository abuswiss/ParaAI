import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom'; // Import Outlet, Link, and useNavigate
import { useAtomValue, useSetAtom } from 'jotai'; // Import Jotai hooks
import { useAuth } from '@/hooks/useAuth'; // Import useAuth hook
import { 
  activeCaseDetailsAtom, 
  isCaseDetailsLoadingAtom, 
  caseDetailsFetchErrorAtom,
  activeEditorItemAtom, 
  activeCaseIdAtom,
  // Import new document list atoms
  caseDocumentsAtom,
  isCaseDocumentsLoadingAtom,
  caseDocumentsFetchErrorAtom
} from '@/atoms/appAtoms'; // Import atoms
import ChatInterface from '@/components/chat/ChatInterface';
import CaseSelector from '@/components/cases/CaseSelector'; // Import CaseSelector
import { Spinner } from '@/components/ui/Spinner'; // Import Spinner
import DocumentList from '@/components/documents/DocumentList';
import DocumentEditor, { DocumentEditorRef } from '@/components/documents/DocumentEditor'; // Import Ref from correct path
import * as documentService from '@/services/documentService'; // Import documentService
import * as templateService from '@/services/templateService'; // Re-add templateService import
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"; // Import resizable panel components
import { motion, AnimatePresence } from 'framer-motion'; // Import framer-motion
import { Icons } from '@/components/ui/Icons'; // Correct import path
import { Button } from '@/components/ui/Button'; // Import Button
import AIDraftModal from '@/components/ai/AIDraftModal'; // Import AI Draft Modal
import UploadModal from '@/components/documents/UploadModal'; // Import Upload Modal
import NewAITemplateDraftModal from '@/components/templates/NewAITemplateDraftModal'; // Import the new modal
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"; // Import Dropdown components
import { Document } from '@/types/document'; // Import Document type

// Define props for NavigationPanel to receive modal setters and action handlers
interface NavigationPanelProps {
  setShowAIDraftModal: (show: boolean) => void;
  setAIDraftContext: (context: 'template' | 'document') => void; // Context type updated
  setShowUploadModal: (show: boolean) => void;
  setShowAITemplateDraftModal: (show: boolean) => void; // Add the setter prop
  handleNewBlankDocument: () => void; // Add handler for new blank doc
  // Document List related props
  documents: Document[] | null;
  isDocumentsLoading: boolean;
  documentsError: string | null;
  activeDocumentId: string | null; // For highlighting the active document
  onSelectDocument: (docId: string) => void;
}

// Navigation Panel - Now includes CaseSelector, Case Details, DocumentList, and User Info/Logout
const NavigationPanel: React.FC<NavigationPanelProps> = ({ 
  setShowAIDraftModal, 
  setAIDraftContext, 
  setShowUploadModal,
  setShowAITemplateDraftModal,
  handleNewBlankDocument,
  // Destructure document list props
  documents,
  isDocumentsLoading,
  documentsError,
  activeDocumentId,
  onSelectDocument
}) => {
  const { user, signOut } = useAuth(); // Get user and signOut function
  const navigate = useNavigate(); // Hook for navigation
  const activeCaseId = useAtomValue(activeCaseIdAtom); // Get active case ID
  const activeCaseDetails = useAtomValue(activeCaseDetailsAtom);
  const isCaseDetailsLoading = useAtomValue(isCaseDetailsLoadingAtom);
  const caseDetailsError = useAtomValue(caseDetailsFetchErrorAtom);
  
  const detailsVariants = { // Define variants for details animation
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: 'auto' },
  };

  return (
    <div className="w-64 flex-shrink-0 border-r border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface p-3 flex flex-col h-full overflow-hidden"> {/* Added h-full overflow-hidden */}
      <div className="flex-shrink-0"> {/* Section for non-scrolling content */}
        <h2 className="text-base font-semibold mb-3 text-neutral-800 dark:text-text-primary px-1">Navigation</h2> {/* Added text color */}
        <CaseSelector />

        {/* Links Section */}
        <div className="mt-3 space-y-1 px-1">
          <Link 
            to="/cases" 
            className="flex items-center text-sm font-medium text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter p-2 rounded-md"
          >
            <Icons.Folder className="h-4 w-4 mr-2 flex-shrink-0" /> 
            <span className="truncate">Manage Cases</span>
          </Link>
          <Link 
            to="/documents" 
            className="flex items-center text-sm font-medium text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter p-2 rounded-md"
          >
            <Icons.Document className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Manage Documents</span>
          </Link>
          <Link 
            to="/templates" 
            className="flex items-center text-sm font-medium text-neutral-600 dark:text-text-secondary hover:text-neutral-900 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter p-2 rounded-md"
          >
            <Icons.FileText className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Manage Templates</span>
          </Link>
        </div>

        {/* Create Actions Section */} 
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-surface-lighter flex flex-col space-y-2 px-1">
          <Button 
            variant="outline" // Corrected variant
            size="sm" 
            onClick={() => setShowUploadModal(true)} 
            className="w-full justify-start"
          >
            <Icons.Upload className="h-4 w-4 mr-2" />
            Upload Document
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
              side="bottom" // Changed side to bottom for better positioning if space allows
              className="w-56 mb-1 bg-popover text-popover-foreground border border-border shadow-md dark:bg-surface dark:text-text-primary dark:border-surface-lighter" // Added dark mode styles
            > 
              <DropdownMenuItem onClick={handleNewBlankDocument} className="hover:bg-neutral-100 dark:hover:bg-surface-lighter">
                <Icons.File className="mr-2 h-4 w-4" />
                <span>Blank Document</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setAIDraftContext('document'); // Correct context
                setShowAIDraftModal(true); 
              }} className="hover:bg-neutral-100 dark:hover:bg-surface-lighter">
                <Icons.Sparkles className="mr-2 h-4 w-4" />
                <span>AI Document Draft</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAITemplateDraftModal(true)} className="hover:bg-neutral-100 dark:hover:bg-surface-lighter">
                <Icons.FileText className="mr-2 h-4 w-4" />
                <span>AI Template Draft</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/templates', { state: { action: 'create' } })} className="hover:bg-neutral-100 dark:hover:bg-surface-lighter">
                 <Icons.Document className="mr-2 h-4 w-4" />
                <span>New Template (Manual)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scrolling Middle Section (Case Details & Documents) */}
      <div className="flex-1 mt-2 pt-2 border-t border-neutral-200 dark:border-surface-lighter overflow-y-auto px-1 space-y-3"> 
          {/* Case Details Section */}
          <div className="overflow-hidden"> {/* Keep overflow-hidden for animation */}
              <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-1">Case Details</h3>
              <AnimatePresence initial={false}> 
                  {activeCaseId && ( 
                  <motion.div
                      key="case-details-content"
                      variants={detailsVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      transition={{ duration: 0.3 }}
                      className="px-1" // Add padding inside animation
                  >
                      {isCaseDetailsLoading && (
                      <div className="flex items-center justify-center py-1">
                          <Spinner size="xs" />
                          <span className="ml-2 text-xs text-neutral-500 dark:text-text-secondary">Loading...</span>
                      </div>
                      )}
                      {caseDetailsError && (
                      <p className="text-xs text-error dark:text-error">Error: {caseDetailsError}</p>
                      )}
                      {!isCaseDetailsLoading && !caseDetailsError && activeCaseDetails && (
                      <div className="space-y-1 text-xs text-neutral-700 dark:text-text-primary">
                          <p><span className="font-medium">Client:</span> {activeCaseDetails.client_name || 'N/A'}</p>
                          <p><span className="font-medium">Opposing:</span> {activeCaseDetails.opposing_party || 'N/A'}</p>
                          <p><span className="font-medium">Case No:</span> {activeCaseDetails.case_number || 'N/A'}</p>
                          {/* Add more details if needed */}
                      </div>
                      )}
                      {!isCaseDetailsLoading && !caseDetailsError && !activeCaseDetails && (
                      <p className="text-xs text-neutral-500 dark:text-text-secondary italic">Details unavailable.</p>
                      )}
                  </motion.div>
                  )}
              </AnimatePresence>
              {!activeCaseId && (
                  <p className="text-xs text-neutral-500 dark:text-text-secondary italic px-1">Select a case.</p>
              )}
          </div>

          {/* Document List Section - Pass props down */}
          <div>
              <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-1">Documents in Case</h3>
              {/* Pass required props to DocumentList */} 
              {activeCaseId ? (
                <DocumentList 
                  documents={documents || []} // Pass fetched documents or empty array
                  isLoading={isDocumentsLoading}
                  error={documentsError}
                  activeDocumentId={activeDocumentId} // Pass active ID for highlighting
                  onSelectDocument={onSelectDocument} // Pass selection handler
                />
              ) : (
                <p className="text-xs text-neutral-500 dark:text-text-secondary italic px-1">Select a case.</p>
              )}
          </div>
      </div>


      {/* User Info and Logout Section (Bottom, Fixed) */}
      {user && (
        <div className="flex-shrink-0 mt-auto pt-3 border-t border-neutral-200 dark:border-surface-lighter px-1"> {/* Added px-1 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-600 dark:text-text-secondary truncate" title={user.email}> 
              {user.email} 
            </span>
            <button
              onClick={signOut}
              className="ml-2 px-2 py-1 text-neutral-500 dark:text-text-secondary hover:text-neutral-700 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter rounded"
              aria-label="Logout" // Added aria-label
            >
              <Icons.Logout className="h-4 w-4" /> {/* Added Logout Icon */}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// Props for MainWorkAreaPanel including the ref callback
interface MainWorkAreaPanelProps {
  editorRef: React.RefObject<DocumentEditorRef>;
}

// Main Work Area Panel - Renders Outlet OR DocumentEditor based on activeEditorItem
const MainWorkAreaPanel: React.FC<MainWorkAreaPanelProps> = ({ editorRef }) => {
  const activeEditorItem = useAtomValue(activeEditorItemAtom); // Use Jotai atom
  const [content, setContent] = useState<string>('<p></p>'); // Initialize with empty paragraph for Tiptap
  const [itemType, setItemType] = useState<'document' | 'draft' | null>(null); // Track type for editor key
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEditorItem) {
      setContent('<p></p>'); // Reset to empty paragraph
      setError(null);
      setIsLoading(false);
      setItemType(null);
      return;
    }

    const fetchItemContent = async () => {
      setIsLoading(true);
      setError(null);
      setItemType(activeEditorItem.type); // Set item type for key prop
      try {
        let fetchedContent: string | undefined;
        if (activeEditorItem.type === 'document') {
          const { data, error: fetchError } = await documentService.getDocumentById(activeEditorItem.id);
          if (fetchError) throw fetchError;
          fetchedContent = data?.extractedText ?? '<p>Error loading document content.</p>'; // Corrected property name
        } else if (activeEditorItem.type === 'draft') {
          // Placeholder for draft loading
          fetchedContent = '<p>Draft content loading not implemented yet.</p>'; 
        } else {
            console.warn("Unknown active editor item type:", activeEditorItem.type);
            fetchedContent = '<p>Unknown item type.</p>';
        }
        setContent(fetchedContent || '<p></p>'); // Ensure string is passed
      } catch (err: unknown) { // Changed to unknown
        console.error("Error fetching item content:", err);
        let message = 'Failed to load content';
        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === 'string') {
            message = err;
        }
        setError(message);
        setContent('<p>Error loading content.</p>'); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchItemContent();
  }, [activeEditorItem]); // Dependency array includes activeEditorItem

  return (
    <div className="flex-1 bg-neutral-50 dark:bg-background p-4 md:p-6 overflow-auto"> {/* Added overflow-auto */}
      {isLoading && (
        <div className="flex items-center justify-center h-full">
          <Spinner size="md" /> {/* Corrected size */}
          <span className="ml-2 text-neutral-500 dark:text-text-secondary">Loading Editor...</span>
        </div>
      )}
      {error && !isLoading && (
        <div className="text-error dark:text-error p-4 bg-red-100 dark:bg-red-900/20 rounded border border-red-300 dark:border-red-600">
            Error loading content: {error}
        </div>
      )}
      {!isLoading && !error && (
        activeEditorItem ? (
          <DocumentEditor 
            key={`${itemType}-${activeEditorItem.id}`} // Ensure re-render on item change
            initialContent={content} 
            editorItem={activeEditorItem} // Pass editorItem prop
            ref={editorRef} // Pass the ref
           />
        ) : (
          <Outlet /> // Render child routes (like ChatInterface) when no document is active
        )
      )}
    </div>
  );
};

// Props for AssistantPanel
interface AssistantPanelProps {
  onInsertContent: (content: string) => void;
}

// Assistant Panel (Right) - Integrates ChatInterface
const AssistantPanel: React.FC<AssistantPanelProps> = ({ onInsertContent }) => {
  // Collapse state is now handled by the Panel component (by resizing to minSize)
  // const [isCollapsed, setIsCollapsed] = React.useState(false);
  // const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="border-l border-neutral-200 dark:border-surface-lighter flex flex-col h-full overflow-hidden"> 
      {/* Remove collapse button */}
      {/* <button onClick={toggleCollapse} ... /> */}
      
      {/* ChatInterface is now the direct child, ensure it fills height */}
      <ChatInterface onInsertContent={onInsertContent} /> 
    </div>
  );
};

const AppLayout: React.FC = () => {
  // Create the ref for the editor
  const editorRef = useRef<DocumentEditorRef>(null);
  
  // Modal states
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftContext, setAIDraftContext] = useState<'template' | 'document'>('document');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAITemplateDraftModal, setShowAITemplateDraftModal] = useState(false); // Add state for new modal
  
  // Get document list state from atoms
  const documents = useAtomValue(caseDocumentsAtom);
  const isDocumentsLoading = useAtomValue(isCaseDocumentsLoadingAtom);
  const documentsError = useAtomValue(caseDocumentsFetchErrorAtom);
  // Get editor state
  const activeEditorItem = useAtomValue(activeEditorItemAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  // Get active case ID
  const activeCaseId = useAtomValue(activeCaseIdAtom); 
  
  // Calculate activeDocumentId based on activeEditorItem
  const activeDocumentId = activeEditorItem?.type === 'document' ? activeEditorItem.id : null;

  const handleInsertContent = useCallback((content: string) => {
    editorRef.current?.insertContent(content);
  }, []); 
  
  // Updated handler for creating a new blank document
  const handleNewBlankDocument = useCallback(async () => {
    console.log("Creating new blank document...");
    // TODO: Add user feedback for loading/error states
    try {
      const { data: newDraft, error } = await templateService.createBlankDraft(activeCaseId);
      if (error) {
        throw error;
      }
      if (newDraft) {
        console.log("Blank draft created, setting active editor item:", newDraft.id);
        // Set the new blank draft as the active item in the editor
        setActiveEditorItem({ type: 'draft', id: newDraft.id });
      } else {
        // This case should ideally be handled by the error check, but just in case
        throw new Error("Failed to create blank draft: No data returned.");
      }
    } catch (err) {
      console.error('Error creating blank document:', err);
      // TODO: Show user-facing error message (e.g., toast notification)
      alert(`Error creating blank document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [activeCaseId, setActiveEditorItem]); // Add dependencies

  const handleUploadModalClose = (refreshNeeded?: boolean) => {
    setShowUploadModal(false);
    if (refreshNeeded) {
        console.log("Refresh document list needed (placeholder)");
        // TODO: Add logic to manually trigger `loadCaseDocumentsAtom` if needed after upload
        // Example: Might need a dedicated atom/setter `refreshCaseDocumentsAtom` 
        //          that `loadCaseDocumentsAtom` can also listen to, or pass `setLoadDocs` down.
    }
  };

  // Handler for selecting a document from the list
  const handleSelectDocument = useCallback((docId: string) => {
    // Check if it's already selected to avoid unnecessary updates
    if (activeEditorItem?.type !== 'document' || activeEditorItem?.id !== docId) {
      setActiveEditorItem({ type: 'document', id: docId });
    }
  }, [activeEditorItem, setActiveEditorItem]);

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-background text-neutral-900 dark:text-text-primary overflow-hidden">
      {/* Pass modal setters and action handlers down */}
      <NavigationPanel 
        setShowAIDraftModal={setShowAIDraftModal}
        setAIDraftContext={setAIDraftContext} 
        setShowUploadModal={setShowUploadModal}
        setShowAITemplateDraftModal={setShowAITemplateDraftModal}
        handleNewBlankDocument={handleNewBlankDocument} // Pass handler
        // Pass document list props
        documents={documents}
        isDocumentsLoading={isDocumentsLoading}
        documentsError={documentsError}
        activeDocumentId={activeDocumentId}
        onSelectDocument={handleSelectDocument}
      />
      <PanelGroup direction="horizontal" className="flex-1"> {/* Wrap panels */} 
        <Panel defaultSize={65} minSize={30}> {/* Main Work Area */} 
          <MainWorkAreaPanel editorRef={editorRef} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-neutral-200 dark:bg-surface-lighter hover:bg-primary dark:hover:bg-primary transition-colors duration-200 cursor-col-resize" />
        <Panel defaultSize={35} minSize={20} maxSize={50}> {/* Assistant Panel - Added maxSize */} 
          <AssistantPanel onInsertContent={handleInsertContent} />
        </Panel>
      </PanelGroup>
      
      {/* Render AI Draft Modal globally if needed */} 
      <AIDraftModal
        isOpen={showAIDraftModal}
        onClose={() => setShowAIDraftModal(false)}
        context={aiDraftContext}
        // TODO: Define a proper onExport for global context
        onExport={(content: string) => { 
          console.log('AI Draft exported globally:', content); 
          setShowAIDraftModal(false); // Close modal after export
        }}
      />
      
      {/* Render Upload Modal globally */} 
      <UploadModal 
          isOpen={showUploadModal} 
          onClose={handleUploadModalClose}
      />
      <NewAITemplateDraftModal 
        isOpen={showAITemplateDraftModal}
        onClose={() => setShowAITemplateDraftModal(false)}
      />
    </div>
  );
};

export default AppLayout; 