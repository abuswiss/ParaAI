import React, { useState, /* useRef, */ useCallback, useEffect } from 'react'; // Removed useRef
import { Outlet, useNavigate } from 'react-router-dom'; // Keep Outlet, useNavigate
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { useAuth } from '@/hooks/useAuth';
import {
  activeCaseIdAtom,
  caseDocumentsAtom,
  isCaseDocumentsLoadingAtom,
  caseDocumentsFetchErrorAtom,
  loadCaseDocumentsAtom,
  uploadModalOpenAtom,
  activeEditorItemAtom,
  selectTemplateModalOpenAtom,
  fillTemplateModalTriggerAtom,
  newAITemplateDraftModalOpenAtom,
  // Keep atoms needed by AppLayout or passed down:
} from '@/atoms/appAtoms';
// import { DocumentEditorRef } from '@/components/documents/DocumentEditor'; // Removed DocumentEditorRef import
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import UploadModal from '@/components/documents/UploadModal';
import NewAIDocumentDraftModal from '@/components/documents/NewAIDraftModal'; // <-- Import the document-specific one
import NewAITemplateDraftModal from '@/components/templates/NewAITemplateDraftModal';
import SelectTemplateModal from '@/components/templates/SelectTemplateModal';
import FillTemplateModal from '@/components/templates/FillTemplateModal';
import * as templateService from '@/services/templateService';
import * as documentService from '@/services/documentService';
import NavigationPanel from './NavigationPanel'; // Import the new component
import ChatInterface from '@/components/chat/ChatInterface'; // Import ChatInterface for AssistantPanel
// REMOVED import MainWorkAreaPanel from './MainWorkAreaPanel'; 
// REMOVED import AssistantPanel from './AssistantPanel'; 

// Define placeholder regex globally or import if defined elsewhere
const PLACEHOLDER_REGEX = /%%\s*\[(.*?)\]\s*%%/g;

// --- Keep MainWorkAreaPanel and AssistantPanel definitions here for now --- 

// Main Work Area Panel Component (Placeholder - renders Outlet for now)
const MainWorkAreaPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface overflow-hidden">
      <Outlet />
    </div>
  );
};

// Assistant Panel Props (Keep definition)
interface AssistantPanelProps {
  onInsertContent: (content: string) => void;
}

// Assistant Panel Component (Keep definition)
const AssistantPanel: React.FC<AssistantPanelProps> = ({ onInsertContent }) => {
  return (
    <div className="border-l border-neutral-200 dark:border-surface-lighter flex flex-col h-full overflow-hidden">
      <ChatInterface onInsertContent={onInsertContent} />
    </div>
  );
};

// Main App Layout Component
const AppLayout: React.FC = () => {
  // REMOVED editorRef
  const [showDocumentAIDraftModal, setShowDocumentAIDraftModal] = useState(false); // <-- ADD state for specific Document AI Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useAtom(uploadModalOpenAtom);
  const [showSelectTemplateModal, setShowSelectTemplateModal] = useAtom(selectTemplateModalOpenAtom);
  const [fillTemplateTriggerData, setFillTemplateTriggerData] = useAtom(fillTemplateModalTriggerAtom);
  const [isNewAITemplateModalOpen, setIsNewAITemplateModalOpen] = useAtom(newAITemplateDraftModalOpenAtom); // <-- USE atom for Template AI Modal
  const navigate = useNavigate();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const { user } = useAuth();

  // Document List State/Logic - Kept here as NavigationPanel needs this data via props
  const documents = useAtomValue(caseDocumentsAtom);
  const isDocumentsLoading = useAtomValue(isCaseDocumentsLoadingAtom);
  const documentsError = useAtomValue(caseDocumentsFetchErrorAtom);
  const triggerLoadDocuments = useSetAtom(loadCaseDocumentsAtom);
  const activeEditorItem = useAtomValue(activeEditorItemAtom);
  const activeDocumentId = activeEditorItem?.type === 'document' ? activeEditorItem.id : null;

  useEffect(() => {
    if (activeCaseId) {
      triggerLoadDocuments(activeCaseId);
    }
  }, [activeCaseId, triggerLoadDocuments]);

  // Document Selection Handler - Passed to NavigationPanel
  const handleSelectDocument = useCallback((docId: string) => {
    navigate(`/view/document/${docId}`);
  }, [navigate]);

  // Modal Close Handlers
  const handleUploadModalClose = (refreshNeeded?: boolean) => {
    setIsUploadModalOpen(false);
    if (refreshNeeded && activeCaseId) {
      triggerLoadDocuments(activeCaseId);
    }
  };

  // Handler for inserting content from AssistantPanel
  const handleInsertContent = (/* content: string */) => { // Comment out unused content param
    console.warn("handleInsertContent in AppLayout - functionality depends on editor exposure");
  };

  // Handlers for modal success actions
  const handleDraftCreatedFromModal = (draftId: string) => {
    // This handler is now specifically for the Document AI Modal
    setShowDocumentAIDraftModal(false); // Close the specific modal
    navigate(`/edit/document/${draftId}`); 
  };

  const handleAITemplateDraftCreated = (templateId: string) => {
    // This handler is specifically for the Template AI Modal
    setIsNewAITemplateModalOpen(false); // Close via atom
    navigate(`/edit/template/${templateId}`);
  };

  // Template Usage Handlers
  const handleTemplateSelected = async (templateId: string) => {
    setShowSelectTemplateModal(false);
    try {
      const { data: template, error } = await templateService.getTemplateById(templateId);
      if (error) throw error;
      if (!template || !template.content) {
        throw new Error('Selected template content not found.');
      }
      setFillTemplateTriggerData({ id: template.id, name: template.name, content: template.content });
    } catch (err) {
      console.error("Error fetching selected template:", err);
      alert("Error loading template details.");
    }
  };

  const handleGenerateDocumentFromTemplate = async (placeholderValues: Record<string, string>) => {
    if (!fillTemplateTriggerData || !activeCaseId || !user) {
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
      const initialDocData = {
        filename: `${currentTemplateData.name} - ${new Date().toLocaleTimeString()}.txt`,
        content: generatedContent,
      };
      const { data: newDocumentRef, error: createError } = await documentService.createDocument(
        user.id, activeCaseId, initialDocData
      );
      if (createError) throw createError;
      if (!newDocumentRef || !newDocumentRef.id) {
        throw new Error('Failed to create document, no ID returned.');
      }
      navigate(`/edit/document/${newDocumentRef.id}`);
    } catch (err) {
      console.error("Error generating document from template:", err);
      alert("Error generating document.");
    } finally {
      setFillTemplateTriggerData(null);
    }
  };

  return (
    <div className={`flex h-screen bg-neutral-100 dark:bg-background text-neutral-900 dark:text-text-primary overflow-hidden`}>
      <NavigationPanel
        setShowDocumentAIDraftModal={setShowDocumentAIDraftModal} // <-- Pass the correct setter prop
        documents={documents}
        isDocumentsLoading={isDocumentsLoading}
        documentsError={documentsError}
        activeDocumentId={activeDocumentId}
        onSelectDocument={handleSelectDocument}
      />
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={65} minSize={30}>
          <MainWorkAreaPanel />
        </Panel>
        <PanelResizeHandle className="w-1 bg-neutral-200 dark:bg-surface-lighter hover:bg-primary dark:hover:bg-primary transition-colors duration-200 cursor-col-resize" />
        <Panel defaultSize={35} minSize={20} maxSize={50}>
          <AssistantPanel onInsertContent={handleInsertContent} />
        </Panel>
      </PanelGroup>

      {/* Modals */}
      <NewAIDocumentDraftModal // Use the one from @/components/documents
        isOpen={showDocumentAIDraftModal}
        onClose={() => setShowDocumentAIDraftModal(false)}
        onSuccess={handleDraftCreatedFromModal}
      />
      <UploadModal 
          isOpen={isUploadModalOpen}
          onClose={handleUploadModalClose}
      />
      <NewAITemplateDraftModal // Use the one from @/components/templates
        isOpen={isNewAITemplateModalOpen} // Controlled by atom
        onClose={() => setIsNewAITemplateModalOpen(false)} // Close via atom
        onSuccess={handleAITemplateDraftCreated} // Use specific handler
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