import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'; // Import Outlet, Link, useNavigate, useLocation
import { useAtomValue, useSetAtom, useAtom } from 'jotai'; // Import Jotai hooks
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
  caseDocumentsFetchErrorAtom,
  loadCaseDocumentsAtom,
  uploadModalOpenAtom,
  isNavCollapsedAtom,
  activeEditorTypeAtom,
  aiDraftContextAtom,
  selectTemplateModalOpenAtom,
  fillTemplateModalTriggerAtom
} from '@/atoms/appAtoms'; // Import atoms
import ChatInterface from '@/components/chat/ChatInterface';
import CaseSelector from '@/components/cases/CaseSelector'; // Import CaseSelector
import DocumentList from '@/components/documents/DocumentList';
import { DocumentEditorRef } from '@/components/documents/DocumentEditor'; // Only import Ref type
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"; // Import resizable panel components
import { motion, AnimatePresence } from 'framer-motion'; // Import framer-motion
import { Icons } from '@/components/ui/Icons'; // Correct import path
import { Button } from '@/components/ui/Button'; // Import Button
import AIDraftModal from '@/components/ai/AIDraftModal'; // Import AIDraftModal
import UploadModal from '@/components/documents/UploadModal'; // Import Upload Modal
import NewAITemplateDraftModal from '@/components/templates/NewAITemplateDraftModal'; // Import the new modal
import SelectTemplateModal from '@/components/templates/SelectTemplateModal'; // <-- Import SelectTemplateModal
import FillTemplateModal from '@/components/templates/FillTemplateModal'; // <-- Import FillTemplateModal
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"; // Import Dropdown components
import { DocumentMetadata } from '@/services/documentService'; // Correct import path
import { ChevronLeft, ChevronRight } from 'lucide-react'; // <-- Import icons for toggle
import * as templateService from '@/services/templateService'; // Import template service
import * as documentService from '@/services/documentService'; // Import document service

// Define placeholder regex globally or import if defined elsewhere
const PLACEHOLDER_REGEX = /%%\s*\[(.*?)\]\s*%%/g;

// Define props for NavigationPanel to receive modal setters and action handlers
interface NavigationPanelProps {
  setShowAIDraftModal: (show: boolean) => void;
  setShowAITemplateDraftModal: (show: boolean) => void;
  documents: DocumentMetadata[] | null;
  isDocumentsLoading: boolean;
  documentsError: string | null;
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
}

// Navigation Panel Component
const NavigationPanel: React.FC<NavigationPanelProps> = ({ 
  setShowAIDraftModal, 
  setShowAITemplateDraftModal,
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
  // --- Read atoms for conditional rendering and collapse --- 
  const [isCollapsed, setIsCollapsed] = useAtom(isNavCollapsedAtom);
  const activeEditorType = useAtomValue(activeEditorTypeAtom);
  const setAIDraftContext = useSetAtom(aiDraftContextAtom);
  const setShowSelectTemplateModal = useSetAtom(selectTemplateModalOpenAtom);
  
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
                           setAIDraftContext('document');
                           setShowAIDraftModal(true); 
                        }} 
                        disabled={!activeCaseId}
                        className="hover:bg-neutral-100 dark:hover:bg-surface-lighter"
                     >
                       <Icons.Sparkles className="mr-2 h-4 w-4" />
                       <span>AI Document Draft</span>
                     </DropdownMenuItem>
                     <DropdownMenuItem 
                        onClick={() => setShowAITemplateDraftModal(true)} 
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
          activeEditorType === 'document' ? (
            // Render Document Sidebar Area ONLY if NOT collapsed
            !isCollapsed && (
                <div className="p-4 text-sm text-neutral-500 italic">Document Sidebar Area</div>
            )
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
           className="w-full flex justify-center p-1 text-xs text-neutral-500 dark:text-text-secondary hover:bg-neutral-100 dark:hover:bg-surface-lighter rounded"
           title={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
         >
           {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />} 
         </button>
       </div>
    </div>
  );
};

// Props for MainWorkAreaPanel 
// Removed empty interface MainWorkAreaPanelProps

// Main Work Area Panel - Now always renders Outlet
const MainWorkAreaPanel: React.FC = (/* { editorRef } */) => {
  // Remove state and effect related to loading editor content here
  // const activeEditorItem = useAtomValue(activeEditorItemAtom); 
  // const [content, setContent] = useState<string>('<p></p>');
  // const [itemType, setItemType] = useState<'document' | 'draft' | null>(null);
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);
  // useEffect(() => { ... fetchItemContent ... }, [activeEditorItem]);

  // Always render the Outlet to let the router handle content
  return (
    <div className="flex-1 bg-neutral-50 dark:bg-background p-4 md:p-6 overflow-auto">
      <Outlet />
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

// Main App Layout Component
const AppLayout: React.FC = () => {
  const editorRef = useRef<DocumentEditorRef>(null); 
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [showAITemplateDraftModal, setShowAITemplateDraftModal] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);
  // --- State for template usage modals --- 
  const [showSelectTemplateModal, setShowSelectTemplateModal] = useAtom(selectTemplateModalOpenAtom);
  const [fillTemplateTriggerData, setFillTemplateTriggerData] = useAtom(fillTemplateModalTriggerAtom);
  const navigate = useNavigate();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const { user } = useAuth(); // Get user from auth hook

  // --- Document List State/Logic (Keep these) --- 
  const documents = useAtomValue(caseDocumentsAtom);
  const isDocumentsLoading = useAtomValue(isCaseDocumentsLoadingAtom);
  const documentsError = useAtomValue(caseDocumentsFetchErrorAtom);
  const triggerLoadDocuments = useSetAtom(loadCaseDocumentsAtom);
  const activeEditorItem = useAtomValue(activeEditorItemAtom);
  const activeDocumentId = activeEditorItem?.type === 'document' ? activeEditorItem.id : null;

  useEffect(() => {
      if(activeCaseId) {
          triggerLoadDocuments(activeCaseId);
      }
  }, [activeCaseId, triggerLoadDocuments]);
  
  // --- Document Selection Handler (Keep this one) --- 
  const handleSelectDocument = useCallback((docId: string) => {
      navigate(`/view/document/${docId}`);
  }, [navigate]); 

  // --- Other Handlers (Keep these) ---
  const handleUploadModalClose = (refreshNeeded?: boolean) => {
      setIsUploadModalOpen(false);
      if (refreshNeeded && activeCaseId) {
          triggerLoadDocuments(activeCaseId);
      }
  };

  const handleInsertContent = (content: string) => {
    editorRef.current?.insertContent(content);
  };

  const handleDraftCreatedFromModal = (draftId: string) => {
    console.log(`AI Draft created with ID: ${draftId}, navigating to editor.`);
    navigate(`/edit/document/${draftId}`); 
  };

  const handleAITemplateDraftCreated = (templateId: string) => {
      console.log(`AI Template Draft created with ID: ${templateId}, navigating to editor.`);
      navigate(`/edit/template/${templateId}`);
  };

  // --- Template Usage Handlers --- 
  const handleTemplateSelected = async (templateId: string) => {
      console.log('[AppLayout] Template selected:', templateId);
      setShowSelectTemplateModal(false); // Close selection modal first
      // TODO: Add loading state indicator?
      try {
          const { data: template, error } = await templateService.getTemplateById(templateId);
          if (error) throw error;
          if (!template || !template.content) {
              throw new Error('Selected template content not found.');
          }
          // Store template data needed for the next step
          setFillTemplateTriggerData({ id: template.id, name: template.name, content: template.content }); 
      } catch (err) {
          console.error("Error fetching selected template:", err);
          // TODO: Show error notification to user (e.g., using a toast library)
          alert("Error loading template details."); // Simple alert for now
      }
  };

  const handleGenerateDocumentFromTemplate = async (placeholderValues: Record<string, string>) => {
      console.log('[AppLayout] Generating document with values:', placeholderValues);
      if (!fillTemplateTriggerData || !activeCaseId || !user) {
          console.error("Missing template data, active case ID, or user for generation.");
          alert("Cannot generate document: Missing required information.");
          setFillTemplateTriggerData(null); 
          return;
      }
      
      const currentTemplateData = fillTemplateTriggerData;

      try {
          let generatedContent = currentTemplateData.content;
          generatedContent = generatedContent.replaceAll(PLACEHOLDER_REGEX, (match: string, prompt: string) => {
              const trimmedPrompt = prompt?.trim();
              return trimmedPrompt && placeholderValues[trimmedPrompt] !== undefined 
                  ? placeholderValues[trimmedPrompt] 
                  : match; 
          });

          // --- Create New Document Payload (matching service function) --- 
          const initialDocData = {
              filename: `${currentTemplateData.name} - ${new Date().toLocaleTimeString()}.txt`, // Use filename, add extension
              content: generatedContent,
              // Note: Metadata like sourceTemplateId cannot be passed directly here
              // It would need to be added via an updateDocument call later if needed
          };

          console.log("Creating document with data for user:", user.id, "case:", activeCaseId, initialDocData);
          
          // Call with correct signature
          const { data: newDocumentRef, error: createError } = await documentService.createDocument(
              user.id, // Pass userId
              activeCaseId, 
              initialDocData // Pass initialData object
          );

          if (createError) throw createError;
          if (!newDocumentRef || !newDocumentRef.id) { // Check for returned ID
            throw new Error('Failed to create document, no ID returned.');
          }

          console.log("Document created with ID:", newDocumentRef.id);
          navigate(`/edit/document/${newDocumentRef.id}`);

      } catch (err) {
          console.error("Error generating document from template:", err);
          alert("Error generating document.");
      } finally {
          setFillTemplateTriggerData(null); 
      }
  };
  // --------

  const aiDraftContextValue = useAtomValue(aiDraftContextAtom); // Read the atom value

  return (
    <div className={`flex h-screen bg-neutral-100 dark:bg-background text-neutral-900 dark:text-text-primary overflow-hidden transition-all duration-300 ease-in-out`}>
      <NavigationPanel 
        setShowAIDraftModal={setShowAIDraftModal}
        setShowAITemplateDraftModal={setShowAITemplateDraftModal}
        documents={documents}
        isDocumentsLoading={isDocumentsLoading}
        documentsError={documentsError}
        activeDocumentId={activeDocumentId} 
        onSelectDocument={handleSelectDocument} 
      />
      <PanelGroup direction="horizontal" className="flex-1"> {/* Wrap panels */} 
        <Panel defaultSize={65} minSize={30}> {/* Main Work Area */} 
          <MainWorkAreaPanel /* editorRef={editorRef} */ />
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
        context={aiDraftContextValue} // Pass the atom value
        onDraftCreated={handleDraftCreatedFromModal}
      />
      
      {/* Control Upload Modal with atom state */}
      <UploadModal 
          isOpen={isUploadModalOpen} // <-- Use atom value
          onClose={handleUploadModalClose}
      />
      <NewAITemplateDraftModal 
        isOpen={showAITemplateDraftModal}
        onClose={() => setShowAITemplateDraftModal(false)}
        onSuccess={handleAITemplateDraftCreated} // Pass the new success handler
      />
      <SelectTemplateModal 
         isOpen={showSelectTemplateModal}
         onClose={() => setShowSelectTemplateModal(false)}
         onSelect={handleTemplateSelected}
      />
      {fillTemplateTriggerData && (
          <FillTemplateModal
              isOpen={true}
              onClose={() => {
                  setFillTemplateTriggerData(null);
              }}
              templateContent={fillTemplateTriggerData.content}
              onGenerate={handleGenerateDocumentFromTemplate}
          />
      )}
    </div>
  );
};

export default AppLayout; 