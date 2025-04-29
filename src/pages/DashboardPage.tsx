import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { /* activeEditorItemAtom, */ uploadModalOpenAtom, resetChatTriggerAtom } from '@/atoms/appAtoms';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { FolderPlus } from 'lucide-react';
import { getUserCases, Case } from '@/services/caseService';
import { getUserDocuments, DocumentMetadata } from '@/services/documentService';
import { getAvailableTemplates, DocumentTemplate } from '@/services/templateService';
import { getUserConversations, Conversation } from '@/services/chatService';
import UseTemplateModal from '@/components/templates/UseTemplateModal';

const dynamicPhrases = [
  "edit a document?",
  "draft a motion?",
  "research case law?",
  "search recent legal matters?",
  "use a template?"
];

const DashboardPage: React.FC = () => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const navigate = useNavigate();
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const triggerChatReset = useSetAtom(resetChatTriggerAtom);
  
  // Data states - Use imported types directly
  const [cases, setCases] = useState<Case[] | null>(null);
  const [isCasesLoading, setIsCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentMetadata[] | null>(null);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<DocumentTemplate[] | null>(null);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  // State for UseTemplateModal
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [templateToUseId, setTemplateToUseId] = useState<string | null>(null);

  // Dynamic text effect
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % dynamicPhrases.length);
    }, 4000); // Change phrase every 4 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  // Data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      // Fetch Cases
      setIsCasesLoading(true); setCasesError(null);
      try {
        const { data, error } = await getUserCases(); // Use actual service call
        if (error) throw error;
        setCases((data || []).slice(0, 5)); // Show max 5
      } catch (err) { setCasesError(err instanceof Error ? err.message : 'Unknown error'); } 
      finally { setIsCasesLoading(false); }

      // Fetch Documents (user-wide)
      setIsDocumentsLoading(true); setDocumentsError(null);
      try {
        const { data, error } = await getUserDocuments(); // Use actual service call (no caseId)
        if (error) throw error;
        setDocuments((data || []).slice(0, 5)); // Show max 5
      } catch (err) { setDocumentsError(err instanceof Error ? err.message : 'Unknown error'); } 
      finally { setIsDocumentsLoading(false); }

      // Fetch Templates
      setIsTemplatesLoading(true); setTemplatesError(null);
      try {
        const { data, error } = await getAvailableTemplates(); // Use actual service call
        if (error) throw error;
        setTemplates((data || []).slice(0, 5)); // Show max 5
      } catch (err) { setTemplatesError(err instanceof Error ? err.message : 'Unknown error'); } 
      finally { setIsTemplatesLoading(false); }
      
      // Fetch Conversations
      setIsConversationsLoading(true); setConversationsError(null);
      try {
        const { data, error } = await getUserConversations(); // Use actual service call
        if (error) throw error;
        setConversations((data || []).slice(0, 5)); // Show max 5
      } catch (err) { setConversationsError(err instanceof Error ? err.message : 'Unknown error'); } 
      finally { setIsConversationsLoading(false); }
    };

    fetchData();
  }, []);

  // --- Action Handlers for Buttons --- 
  const handleNewCase = () => {
    // Navigate to the cases page, potentially passing state to indicate creation
    navigate('/cases', { state: { action: 'create' } }); 
  };

  const handleUploadDocument = () => {
    // Use the atom setter to open the modal
    setUploadModalOpen(true); 
  };

  const handleNewChat = () => {
    // Trigger chat reset instead of navigating
    console.log('Triggering chat reset from Dashboard...');
    triggerChatReset(c => c + 1);
  };

  const handleOpenDocument = (docId: string) => {
    // Navigate to the new viewer page instead of the editor
    navigate(`/view/document/${docId}`); 
  };

  const handleUseTemplate = (templateId: string) => {
    // Open the UseTemplateModal instead of navigating
    console.log(`Opening modal to use template ${templateId}`);
    setTemplateToUseId(templateId);
    setIsUseModalOpen(true);
  };

  // Helper to render loading/error/content for sections
  const renderSection = <T extends { id: string },>(
    title: string,
    data: T[] | null,
    isLoading: boolean,
    error: string | null,
    renderItem: (item: T) => React.ReactNode,
    viewAllLink?: string
  ) => (
    <div className="bg-white dark:bg-surface rounded-lg shadow p-4 border border-neutral-200 dark:border-surface-lighter flex flex-col min-h-[200px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-text-primary">{title}</h3>
        {viewAllLink && !isLoading && data && data.length > 0 && (
           <Link to={viewAllLink} className="text-sm text-primary hover:underline">View All</Link>
        )}
      </div>
      <div className="flex-grow overflow-y-auto relative">
        {isLoading && (
            <div className="absolute inset-0 flex justify-center items-center bg-white/50 dark:bg-surface/50">
                <Spinner />
            </div>
        )}
        {error && <p className="text-sm text-error dark:text-error p-2">Error: {error}</p>}
        {!isLoading && !error && data && data.length > 0 && (
          <ul className="space-y-2">
            {data.map((item) => <li key={item.id}>{renderItem(item)}</li>)}
          </ul>
        )}
        {!isLoading && !error && data && data.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-text-secondary italic px-2 py-4 text-center">No {title.toLowerCase()} found.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 h-full overflow-y-auto bg-neutral-100 dark:bg-background">
      {/* Dynamic Text Area */}
      <div className="text-center mb-8">
        {/* Combine static and dynamic text, ensure consistent size */}
        <h1 className="text-3xl font-semibold text-neutral-800 dark:text-text-primary">
          <span>What would you like to do today: </span>
          <span className="text-primary inline-block min-w-[250px] text-left"> {/* Adjust min-w as needed */} 
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPhraseIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="inline-block" // Keep inline-block for animation
              >
                {dynamicPhrases[currentPhraseIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 flex justify-center space-x-4">
         <Button variant="outline" onClick={handleNewCase}> 
           <FolderPlus className="mr-2 h-4 w-4" /> New Case
         </Button>
         <Button variant="outline" onClick={handleUploadDocument}> 
           <Icons.Upload className="mr-2 h-4 w-4" /> Upload Document
         </Button>
         <Button variant="primary" onClick={handleNewChat}> 
            <Icons.Plus className="mr-2 h-4 w-4" /> Start New Chat
         </Button>
      </div>

      {/* Main Content Grid - Adjusted for 2x2 layout */} 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Simplified grid */} 
        {/* Cases Section */}
        {renderSection<Case>(
          "Recent Cases",
          cases,
          isCasesLoading,
          casesError,
          (item) => (
            <Link to={`/cases/${item.id}`} className="block p-2 -m-2 rounded hover:bg-neutral-100 dark:hover:bg-surface-lighter transition-colors">
              <p className="font-medium text-neutral-800 dark:text-text-primary truncate">{item.name || item.client_name || 'Untitled Case'}</p>
              <p className="text-xs text-neutral-500 dark:text-text-secondary">{item.case_number || 'No case number'}</p>
            </Link>
          ),
          '/cases'
        )}

        {/* Documents Section */}
        {renderSection<DocumentMetadata>(
          "Recent Documents",
          documents,
          isDocumentsLoading,
          documentsError,
          (item) => (
            <button onClick={() => handleOpenDocument(item.id)} className="block w-full text-left p-2 -m-2 rounded hover:bg-neutral-100 dark:hover:bg-surface-lighter transition-colors">
              <p className="font-medium text-neutral-800 dark:text-text-primary truncate">{item.filename}</p>
              <p className="text-xs text-neutral-500 dark:text-text-secondary">Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}</p>
            </button>
          ),
          '/documents'
        )}

        {/* Templates Section */}
        {renderSection<DocumentTemplate>(
          "Available Templates",
          templates,
          isTemplatesLoading,
          templatesError,
          (item) => (
             <button onClick={() => handleUseTemplate(item.id)} className="block w-full text-left p-2 -m-2 rounded hover:bg-neutral-100 dark:hover:bg-surface-lighter transition-colors">
              <p className="font-medium text-neutral-800 dark:text-text-primary truncate">{item.name}</p>
              <p className="text-xs text-neutral-500 dark:text-text-secondary truncate">{item.description || 'No description'}</p>
            </button>
          ),
          '/templates'
        )}
        
        {/* Chat History Section */}
         {renderSection<Conversation>(
          "Recent Chats",
          conversations,
          isConversationsLoading,
          conversationsError,
          (item) => (
            <Link to={`/chat/${item.id}`} className="block p-2 -m-2 rounded hover:bg-neutral-100 dark:hover:bg-surface-lighter transition-colors">
              <p className="font-medium text-neutral-800 dark:text-text-primary truncate">{item.title || 'Untitled Chat'}</p>
              <p className="text-xs text-neutral-500 dark:text-text-secondary">Last active: {new Date(item.updatedAt).toLocaleTimeString()}</p>
            </Link>
          ),
          '/chat'
        )}
      </div>

      {/* Modals */} 
      {templateToUseId && (
        <UseTemplateModal
          isOpen={isUseModalOpen}
          onClose={() => {
            setIsUseModalOpen(false);
            setTemplateToUseId(null);
          }}
          templateId={templateToUseId}
        />
      )}

    </div>
  );
};

export default DashboardPage; 