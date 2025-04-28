import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet } from 'react-router-dom'; // Import Outlet
import { useAtomValue, useSetAtom } from 'jotai'; // Import Jotai hooks
import { useAuth } from '@/hooks/useAuth'; // Import useAuth hook
import { 
  activeCaseDetailsAtom, 
  isCaseDetailsLoadingAtom, 
  caseDetailsFetchErrorAtom,
  activeEditorItemAtom, 
  DocumentEditorRef, // Keep Ref type
  activeCaseAtom,
  activeCaseIdAtom // Need activeCaseId to trigger animation
} from '@/atoms/appAtoms'; // Import atoms
import ChatInterface from '@/components/chat/ChatInterface';
import CaseSelector from '@/components/cases/CaseSelector'; // Import CaseSelector
import { Spinner } from '@/components/ui/Spinner'; // Import Spinner
import DocumentList from '@/components/documents/DocumentList';
import DocumentEditor from '@/components/documents/DocumentEditor';
import * as documentService from '@/services/documentService'; // Import documentService
import * as templateService from '@/services/templateService'; // Import templateService
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"; // Import resizable panel components
import { motion, AnimatePresence } from 'framer-motion'; // Import framer-motion

// Navigation Panel - Now includes CaseSelector, Case Details, DocumentList, and User Info/Logout
const NavigationPanel: React.FC = () => {
  const { user, signOut } = useAuth(); // Get user and signOut function
  const activeCaseId = useAtomValue(activeCaseIdAtom); // Get active case ID
  const activeCaseDetails = useAtomValue(activeCaseDetailsAtom);
  const isCaseDetailsLoading = useAtomValue(isCaseDetailsLoadingAtom);
  const caseDetailsError = useAtomValue(caseDetailsFetchErrorAtom);

  const detailsVariants = { // Define variants for details animation
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: 'auto' },
  };

  const listVariants = { // Define variants for list animation
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <div className="w-64 flex-shrink-0 border-r border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface p-4 flex flex-col h-full overflow-hidden"> {/* Added h-full overflow-hidden */}
      <div className="flex-shrink-0"> {/* Section for non-scrolling content */}
        <h2 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-text-primary">Navigation</h2> {/* Added text color */}
        <CaseSelector />

        {/* Display Case Details Section with Animation */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-surface-lighter overflow-hidden"> {/* Add overflow-hidden */}
          <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-2">Case Details</h3>
          <AnimatePresence initial={false}> {/* Animate presence of details based on activeCaseId */}
            {activeCaseId && ( // Conditionally render based on activeCaseId
              <motion.div
                key="case-details-content"
                variants={detailsVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.3 }}
              >
                {isCaseDetailsLoading && (
                  <div className="flex items-center justify-center py-2">
                    <Spinner size="small" />
                    <span className="ml-2 text-xs text-neutral-500 dark:text-text-secondary">Loading details...</span>
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
                    <p><span className="font-medium">Court:</span> {activeCaseDetails.court || 'N/A'}</p>
                    {/* Add other details as needed */}
                  </div>
                )}
                {/* Render placeholder only when not loading, no error, but details are still null/undefined */}
                {!isCaseDetailsLoading && !caseDetailsError && !activeCaseDetails && (
                   <p className="text-xs text-neutral-500 dark:text-text-secondary italic">Details unavailable.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Message when no case is selected */}
          {!activeCaseId && (
              <p className="text-xs text-neutral-500 dark:text-text-secondary italic">Select a case to view details.</p>
          )}
        </div>
      </div>

      {/* Document List Section with Animation */}
      <div className="mt-4 border-t border-neutral-200 dark:border-surface-lighter min-h-0 overflow-y-auto mb-auto"> 
        <AnimatePresence mode='wait'>
          <motion.div
            key={activeCaseId || 'no-case'} // Change key based on activeCaseId to trigger animation
            variants={listVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="h-full" // Ensure motion div takes full height
          >
            <DocumentList />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* User Info and Logout Section */}
      {user && (
        <div className="mt-auto flex-shrink-0 pt-4 border-t border-neutral-200 dark:border-surface-lighter">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-600 dark:text-text-secondary truncate" title={user.email}> 
              {user.email} 
            </span>
            <button
              onClick={signOut}
              className="ml-2 px-2 py-1 text-neutral-500 dark:text-text-secondary hover:text-neutral-700 dark:hover:text-text-primary hover:bg-neutral-100 dark:hover:bg-surface-lighter rounded"
            >
              Logout
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
          // Ensure extractedText is not null/undefined, default to empty paragraph string
          fetchedContent = data?.extractedText || '<p></p>'; 
        } else if (activeEditorItem.type === 'draft') {
          const { data, error: fetchError } = await templateService.getDraftById(activeEditorItem.id);
          if (fetchError) throw fetchError;
          // Ensure content is not null/undefined, default to empty paragraph string
          fetchedContent = data?.content || '<p></p>'; 
        }
        setContent(fetchedContent || '<p><em>Content unavailable or empty.</em></p>');
      } catch (err) {
        console.error("Error fetching item content:", err);
        setError("Failed to load content.");
        setContent('<p></p>'); // Reset to empty paragraph on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchItemContent();
  }, [activeEditorItem]); // Depend on the whole item object

  return (
    // Use theme colors: bg-white -> bg-white (light), dark:bg-gray-900 -> dark:bg-background
    <div className="p-4 overflow-auto bg-white dark:bg-background relative h-full"> {/* Ensure h-full */}
      {/* Animate presence of the editor/outlet content */}
      <AnimatePresence mode='wait'>
        {activeEditorItem ? (
          <motion.div 
            key={`editor-${itemType}-${activeEditorItem.id}`} // Ensure key changes when item changes
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.2 }} // Add transition duration
            className="h-full" // Ensure motion div takes full height if needed
          >
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <Spinner size="large" />
                {/* Text: text-gray-500 -> text-neutral-500 (light), dark:text-gray-400 -> dark:text-text-secondary */}
                <span className="ml-3 text-neutral-500 dark:text-text-secondary">Loading content...</span>
              </div>
            )}
            {error && (
              // Text: text-red-600 -> text-error, dark:text-red-400 -> dark:text-error
              <div className="flex items-center justify-center h-full text-error dark:text-error">
                Error: {error}
              </div>
            )}
            {!isLoading && !error && (
              <DocumentEditor
                ref={editorRef}
                key={`${itemType}-${activeEditorItem.id}-editor`} // Use a distinct key for editor itself if needed
                initialContent={content}
                editorItem={activeEditorItem} // Pass item type and ID
              />
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="outlet" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.2 }}
            className="h-full" // Ensure motion div takes full height if needed
          >
            <Outlet />
          </motion.div>
        )}
      </AnimatePresence>
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

  // Define the callback function
  const handleInsertContent = useCallback((content: string) => {
    // Call the exposed method via the ref
    editorRef.current?.insertContent(content);
  }, []); // Empty dependency array as it only uses the ref

  return (
    <div className="flex h-screen bg-white dark:bg-background text-neutral-900 dark:text-text-primary">
      <NavigationPanel />
      <PanelGroup direction="horizontal" className="flex-1"> {/* Wrap panels */} 
        <Panel defaultSize={70} minSize={30} className="flex-1 flex flex-col overflow-hidden"> {/* Main area panel */} 
          <MainWorkAreaPanel editorRef={editorRef} />
        </Panel>
        <PanelResizeHandle className="w-2 bg-neutral-200 dark:bg-surface-lighter hover:bg-primary/50 dark:hover:bg-primary/50 active:bg-primary/75 dark:active:bg-primary/75 transition-colors flex items-center justify-center">
           {/* Optional: Add visual indicator for handle */} 
           <div className="w-1 h-10 bg-neutral-400 dark:bg-text-tertiary rounded-full"></div>
        </PanelResizeHandle>
        <Panel defaultSize={30} minSize={15} maxSize={50} className="flex flex-col overflow-hidden"> {/* Assistant panel */} 
          <AssistantPanel onInsertContent={handleInsertContent} />
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default AppLayout; 