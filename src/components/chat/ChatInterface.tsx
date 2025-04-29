import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { 
  ActiveEditorItem,
  resetChatTriggerAtom
} from '@/atoms/appAtoms';
import { getConversationMessages, createConversation } from '../../services/chatService';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
import { supabase } from '../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { parseCommand } from '../../lib/commandParser';
import { handleUserTurn, DispatcherResponse } from '../../lib/taskDispatcher';
import AIDraftModal from '../ai/AIDraftModal';
import TemplatePopulationModal from '@/components/templates/TemplatePopulationModal';
import { BarChart2, Globe, Search, MessageCircle, Wand2, HelpCircle } from 'lucide-react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '../ui/Modal';

// Import the separate components
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';

// Define interface for Perplexity sources (replace with actual structure if known)
interface PerplexitySource {
  url: string;
  title: string;
  snippet: string;
}

// Define interfaces
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  // Ensure timestamp is always a string or provide a default
  timestamp: string; // Changed from timestamp? / created_at?
  isStreaming?: boolean;
  documentContext?: string; // Reference to document context, if any
  analysisContext?: DocumentAnalysisResult; // Reference to analysis context, if any
  isEditing?: boolean; // For editing mode
  conversation_id?: string; // For Supabase compatibility
}

interface ChatInterfaceProps {
  conversationId?: string;
  onInsertContent?: (content: string) => void;
  initialInputValue?: string;
}

// Define component using function declaration instead of arrow function
function ChatInterface({ 
  conversationId: initialConversationId, 
  onInsertContent, 
  initialInputValue // <-- Destructure new prop
}: ChatInterfaceProps) {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [documentProcessingProgress, setDocumentProcessingProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUIDisabled, setIsUIDisabled] = useState(false);
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftContent, setAIDraftContent] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [modalTemplateId, setModalTemplateId] = useState<string | null>(null);
  const [showTipsModal, setShowTipsModal] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Get the trigger value
  const resetTriggerValue = useAtomValue(resetChatTriggerAtom);
  const isInitialMount = useRef(true); // Ref to track initial mount

  // State to store the active conversation ID (possibly created on demand)
  // FIXME: Replace dummy implementation for activeCaseId and setActiveEditorItem
  // const { activeCaseId, setActiveEditorItem } = useAppStore(); // Original line causing error
  const activeCaseId = null; // Dummy value to satisfy linter
  // Use the imported ActiveEditorItem type
  const setActiveEditorItem = (item: ActiveEditorItem) => { console.warn("setActiveEditorItem not implemented", item); }; // Dummy function
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId);

  // State for Perplexity sources - Use the defined interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars 
  const [perplexitySources, setPerplexitySources] = useState<{ [messageId: string]: PerplexitySource[] }>({});

  // Content for Tips modal (copied from HowToUsePanel)
  const howToUseTips = [
    {
      icon: <MessageCircle className="h-6 w-6 text-primary" />,
      title: 'Ask a Legal Question',
      desc: 'Type any legal question or prompt and get instant answers.',
      example: 'What are the key elements of a valid contract?'
    },
    {
      icon: <Wand2 className="h-6 w-6 text-purple-400" />,
      title: 'Use AI Legal Tools',
      desc: 'Type / to access powerful document and legal tools (agents).',
      example: '/timeline from [doc_id]'
    },
    {
      icon: <Search className="h-6 w-6 text-blue-400" />,
      title: 'Advanced Legal Research',
      desc: 'Type /research to search case law and legal sources with AI (e.g., Perplexity).',
      example: '/research Miranda rights'
    }
  ];

  // --- NEW: Function to reset chat state --- 
  const resetChat = () => {
    console.log('Resetting chat state...');
    setMessages([]);
    setError(null);
    setActiveDocumentName(null);
    setActiveContext(null);
    setIsProcessingDocument(false);
    setDocumentProcessingProgress(0);
    setIsSendingMessage(false);
    setIsUIDisabled(false);
    setActiveConversationId(undefined); // Ensure conversation ID is cleared
    setPerplexitySources({}); // Clear sources
    // We don't necessarily navigate, just reset the state of this component.
    // If navigation is truly desired, it should be handled by the parent 
    // or a different button.
  };

  // --- NEW: Effect to reset chat when trigger atom changes --- 
  useEffect(() => {
    // Skip the effect on the initial render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Only reset if the trigger value actually changed (which it always will if incremented)
    if (resetTriggerValue > 0) { // Check > 0 to ensure it was triggered
      console.log('Reset chat triggered by atom change.');
      resetChat();
    }
  }, [resetTriggerValue]); // Depend only on the trigger value

  // Function to fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId || conversationId === 'new') return;
    
    try {
      setIsUIDisabled(true);
      const { data, error } = await getConversationMessages(conversationId);
      
      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
      
      if (data) {
        // Ensure timestamp exists and is a string before setting state
        const formattedMessages = data.map(msg => ({
          ...msg,
          timestamp: msg.timestamp || new Date().toISOString(), // Provide default if missing
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setError('Failed to load conversation messages.');
    } finally {
      setIsUIDisabled(false);
    }
  }, []);

  // Effect to load conversation messages or reset for 'new'
  useEffect(() => {
    console.log('Conversation ID changed:', initialConversationId);
    
    if (!initialConversationId) {
      resetChat(); // Use reset function
    } else if (initialConversationId === 'new') {
      resetChat(); // Use reset function
    } else {
      // Existing conversation, fetch messages
      console.log('Loading existing conversation:', initialConversationId);
      setActiveConversationId(initialConversationId);
      fetchMessages(initialConversationId);
      // Clear local state like errors/context when loading existing
      setError(null);
      setActiveContext(null);
      setActiveDocumentName(null);
    }
    
    // Scroll to bottom when conversation changes
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // Dependencies updated to include resetChat
  }, [initialConversationId, fetchMessages /* Removed resetChat from deps, causes loop */]);

  // Scroll to bottom effect for messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Debug messages array contents
  useEffect(() => {
    console.log('Current messages state:', messages);
  }, [messages]);

  // Helper function to add a message to the chat
  const addMessage = (message: Message) => {
    // Ensure timestamp is always a string when adding
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    setMessages(prevMessages => [...prevMessages, messageWithTimestamp]);
  };

  // Function to handle sending a new message
  const handleSendMessage = async (
    content: string,
    documentContexts?: string[],
    analysisContext?: DocumentAnalysisResult,
    suppressUserMessage?: boolean
  ) => {
    if (!content.trim() || isSendingMessage) return;
    
    console.log('Sending message:', content);
    
    // Parse the command first
    const task = parseCommand(content);

    // Decide if this command should show immediate UI feedback (user message + assistant placeholder)
    // For now, only the /use template command will *not* show immediate feedback.
    const showImmediateFeedback = task?.type !== 'use_template';

    try {
      setIsSendingMessage(true);
      setIsUIDisabled(true);
      
      let currentConversationId = activeConversationId;
      // Determine if the task requires an existing conversation ID
      // TODO: Refine this logic - maybe add a property to Task definition
      const requiresConversationId = (task?.type === 'agent' && task.agent !== 'help') || task?.type === 'research'; 

      // If it's a new chat (activeConversationId is undefined) AND the task requires one,
      // create the conversation *before* sending the message.
      if (!currentConversationId && requiresConversationId) {
        console.log('Task requires conversation ID, creating new conversation first...');
        // Reset chat first ONLY IF the user explicitly hit the reset button?
        // No, createConversation should handle starting fresh.
        // resetChat(); // Maybe not needed here? Test this.
        const { data: newConversation, error: createError } = await createConversation('New Chat'); 
        if (createError || !newConversation) {
          console.error('Failed to create conversation before sending message:', createError);
          setError('Failed to start the conversation. Please try again.');
          setIsSendingMessage(false);
          setIsUIDisabled(false);
          return;
        }
        currentConversationId = newConversation.id;
        setActiveConversationId(currentConversationId); // Update state
        console.log('New conversation created with ID:', currentConversationId);
        // Optionally update URL here if needed, e.g., window.history.pushState({}, '', `/chat/${currentConversationId}`);
        // Note: This might be better handled by a router context if using one
      }

      // Create a placeholder message ID for streaming updates
      const placeholderId = uuidv4();

      if (showImmediateFeedback) {
        const userMessage: Message = {
          id: uuidv4(),
          role: 'user',
          content: content,
          timestamp: new Date().toISOString()
        };
        // Use a simpler placeholder content
        const assistantMessage: Message = {
          id: placeholderId,
          role: 'assistant',
          content: '', // Set initial content to empty or just '...'
          timestamp: new Date().toISOString(),
          isStreaming: true,
          conversation_id: currentConversationId ?? undefined
        };
        if (!suppressUserMessage) {
          setMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
        } else {
          setMessages(prevMessages => [...prevMessages, assistantMessage]);
        }
      } else {
         // If not showing immediate feedback (e.g., /use template), maybe add just the user message?
         // Or add nothing yet, wait for the dispatcher response.
         // Let's add just the user message optimistically.
         if (!suppressUserMessage) {
           const userMessage: Message = { 
             id: uuidv4(), 
             role: 'user', 
             content: content, 
             timestamp: new Date().toISOString() // Ensure timestamp is string
           };
           setMessages(prevMessages => [...prevMessages, userMessage]);
         }
      }

      // ... set up buffer, context, etc. ...
      const chunks: string[] = [];

      console.log('Calling handleUserTurn with case ID:', activeCaseId, 'and conversation ID:', currentConversationId);

      // Dispatch the task
      const response: DispatcherResponse = await handleUserTurn({
        task,
        message: content,
        onChunk: (chunk) => {
          chunks.push(chunk);
          setMessages(prevMessages => {
             const newMessages = [...prevMessages];
             const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
             if (messageIndex !== -1) {
                 // Ensure content starts empty and appends chunks
                 newMessages[messageIndex] = { 
                   ...newMessages[messageIndex], 
                   content: chunks.join(''), // Build content from chunks
                   isStreaming: true, 
                   conversation_id: currentConversationId ?? undefined,
                   timestamp: newMessages[messageIndex].timestamp || new Date().toISOString()
                 };
             }
             return newMessages;
          });
        },
        conversationId: currentConversationId ?? undefined,
        caseId: activeCaseId ?? undefined,
        documentContext: documentContexts,
        analysisContext: analysisContext ? JSON.stringify(analysisContext) : undefined,
        params: { wsContext: (chunk: string) => console.log('WS Chunk:', chunk) }
      });

      console.log('Dispatcher response:', response);

      // Handle specific actions returned by the dispatcher
      if (response.action === 'show_template_modal' && response.templateId) {
        setModalTemplateId(response.templateId);
        setShowTemplateModal(true);
        // Clear any potential placeholder assistant message if it was added (though we tried to avoid it)
        setMessages(prev => prev.filter(m => !(m.id === placeholderId && m.isStreaming)));
      } else if (showImmediateFeedback) {
          // Update the final assistant message state only if we showed immediate feedback
          setMessages(prevMessages => {
            const finalMessages = [...prevMessages];
            const messageIndex = finalMessages.findIndex(m => m.id === placeholderId);
            if (messageIndex !== -1) {
              finalMessages[messageIndex] = {
                ...finalMessages[messageIndex],
                content: chunks.length > 0 ? chunks.join('') : (response.error ? `Error: ${response.error.message}` : 'Completed.'), // Show 'Completed' or error
                isStreaming: false, // Mark streaming as complete
                conversation_id: currentConversationId ?? undefined,
                timestamp: finalMessages[messageIndex].timestamp || new Date().toISOString() // Ensure timestamp persists
              };
              if (response.sources) {
                setPerplexitySources(prevSources => ({
                  ...prevSources,
                  [placeholderId]: response.sources as PerplexitySource[]
                }));
              }
            } else if (response.error) {
                // If placeholder wasn't found but there was an error, add a system error message
                 finalMessages.push({ 
                   id: uuidv4(), 
                   role: 'system', 
                   content: `Error: ${response.error.message}`, 
                   timestamp: new Date().toISOString() // Ensure timestamp is string
                 });
            }
            return finalMessages;
          });
      }

      // Handle implicit conversation creation
      if (response.newConversationId && !currentConversationId) {
         console.log("New conversation was created by backend:", response.newConversationId);
         setActiveConversationId(response.newConversationId);
         // Optionally update URL
         // window.history.pushState({}, '', `/chat/${response.newConversationId}`);
      }

      console.log('Message sending complete');
    } catch (error: unknown) {
      console.error('Error sending message:', error as Error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
      setIsUIDisabled(false);
    }
  };

  // Effect to reset UI states when component unmounts
  useEffect(() => {
    return () => {
      setIsSendingMessage(false);
      setIsUIDisabled(false);
    };
  }, []);

  // Effect to scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Add CSS styles for markdown rendering
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      .markdown-content {
        font-size: 0.875rem;
        line-height: 1.5;
      }
      .markdown-content p {
        margin-bottom: 1em;
      }
      .markdown-content h1, 
      .markdown-content h2, 
      .markdown-content h3, 
      .markdown-content h4 {
        font-weight: bold;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        line-height: 1.2;
      }
      .markdown-content h1 {
        font-size: 1.5rem;
      }
      .markdown-content h2 {
        font-size: 1.25rem;
      }
      .markdown-content h3 {
        font-size: 1.125rem;
      }
      .markdown-content ul {
        list-style-type: disc;
        padding-left: 1.5em;
        margin-bottom: 1em;
      }
      .markdown-content ol {
        list-style-type: decimal;
        padding-left: 1.5em;
        margin-bottom: 1em;
      }
      .markdown-content li {
        margin-bottom: 0.25em;
      }
      .markdown-content pre {
        background-color: rgba(30, 30, 30, 0.7);
        border-radius: 4px;
        padding: 0.75em;
        margin: 1em 0;
        overflow-x: auto;
      }
      .markdown-content code {
        font-family: monospace;
        background-color: rgba(30, 30, 30, 0.7);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-size: 0.85em;
      }
      .markdown-content pre code {
        background-color: transparent;
        padding: 0;
      }
      .markdown-content blockquote {
        border-left: 3px solid rgba(200, 200, 200, 0.5);
        padding-left: 1em;
        margin: 1em 0;
        font-style: italic;
        color: rgba(255, 255, 255, 0.8);
      }
      .markdown-content a {
        color: #F2A494;
        text-decoration: underline;
      }
      .markdown-content strong {
        font-weight: bold;
      }
      .markdown-content em {
        font-style: italic;
      }
      .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
      }
      .markdown-content th,
      .markdown-content td {
        border: 1px solid rgba(200, 200, 200, 0.2);
        padding: 0.5em;
        text-align: left;
      }
      .markdown-content th {
        background-color: rgba(30, 30, 30, 0.5);
      }
      .markdown-content hr {
        border: 0;
        border-top: 1px solid rgba(200, 200, 200, 0.2);
        margin: 1.5em 0;
      }
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Handle file upload and processing
  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    try {
      setIsProcessingDocument(true);
      setDocumentProcessingProgress(10);
      setError(null);
      // Import the document services
      const { uploadDocument, processDocument } = await import('../../services/documentService');
      // Get current user ID from Supabase
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        throw new Error('User not authenticated. Please sign in to upload documents.');
      }
      // Upload and process each file
      const docIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setDocumentProcessingProgress(10 + Math.floor((80 / files.length) * i));
        const file = files[i];
        const uploadResult = await uploadDocument(file, userId);
        const docId = uploadResult.id;
        if (!docId) {
          throw new Error(`Failed to upload document: No document ID returned for ${file.name}`);
        }
        // Process document
        setDocumentProcessingProgress(30 + Math.floor((50 / files.length) * i));
        const { error: processError } = await processDocument(docId);
        if (processError) {
          setError(`Processing failed for ${file.name}: ${processError.message}`);
          continue;
        }
        docIds.push(docId);
      }
      // Fetch processed documents for context display
      if (docIds.length > 0) {
        setDocumentProcessingProgress(90);
        const docNames: string[] = [];
        for (const docId of docIds) {
          const { data: processedDoc } = await import('../../services/documentService').then(m => m.getDocumentById(docId));
          if (processedDoc && processedDoc.filename) {
            docNames.push(processedDoc.filename);
          }
        }
        setActiveContext(docIds.join(', ')); // Store as comma-separated string for UI
        setActiveDocumentName(docNames.join(', '));
        setDocumentProcessingProgress(100);
        addMessage({
          id: uuidv4(),
          role: 'system',
          content: `Documents uploaded and processed: ${docNames.join(', ')}`,
          timestamp: new Date().toISOString(),
          documentContext: docIds.join(', ')
        });
      }
      setTimeout(() => {
        setDocumentProcessingProgress(0);
        setIsProcessingDocument(false);
      }, 1000);
    } catch (error) {
      setError(`Error processing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDocumentProcessingProgress(0);
      setIsProcessingDocument(false);
    }
  };

  // Show welcome state ONLY for new conversations with no messages
  // This ensures we don't show the welcome screen when messages exist in the database
  const showWelcome = messages.length === 0 && (!initialConversationId || initialConversationId === 'new');
  
  // File upload handling functions
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep the isDraggingFile state true during dragover
    setIsDraggingFile(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set to false if we're leaving the drop zone
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    
    setIsDraggingFile(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      handleFiles(filesArray);
    }
  };
  
  return (
    <div 
      className={`flex flex-col h-full relative ${isDraggingFile ? 'bg-opacity-90' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header Area (Buttons, Indicators) - Should not grow */}
      <div className="flex-shrink-0">
        {/* Header Buttons Container - Positioned absolutely, so doesn't affect flex layout directly */}
        <div className="absolute top-4 right-4 z-30 flex items-center space-x-2">
          {/* Tips Button */}
          <button
            onClick={() => setShowTipsModal(true)}
            className="
              p-2 rounded-full 
              text-text-secondary hover:text-text-primary
              hover:bg-surface-lighter
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
            "
            aria-label="Show usage tips"
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          {/* New Chat Button - Updated onClick */}
          <button
            onClick={resetChat} // <-- Call resetChat directly
            className="
              bg-primary hover:bg-primary-hover text-white
              rounded-lg py-1.5 px-3 
              flex items-center space-x-2
              transition-all duration-200
              shadow-sm
              font-medium text-sm
            "
            aria-label="Start new chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>New Chat</span>
          </button>
        </div>
        
        {/* Conditionally Rendered Indicators (Processing, Error, Context) */}
        {isProcessingDocument && (
          <div className="px-4 py-2 bg-gray-800 flex items-center space-x-3 text-sm border-b border-gray-700 text-text-secondary">
            <div className="w-5 h-5 relative">
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span>Processing document...</span>
                <span className="text-xs">{documentProcessingProgress}%</span>
              </div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out rounded-full" 
                  style={{ width: `${documentProcessingProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="px-4 py-2 bg-gray-800 flex items-center space-x-2 text-sm border-b border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-gray-400 hover:text-white"
              aria-label="Dismiss error"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        {activeContext && activeDocumentName && !isProcessingDocument && (
          <div className="px-4 py-2 bg-gray-800 flex items-center space-x-2 text-sm border-b border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <span>Using document context: {activeDocumentName}</span>
            <button 
              onClick={() => { setActiveContext(null); setActiveDocumentName(null); }}
              className="ml-auto text-gray-400 hover:text-white"
              aria-label="Remove document context"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Main messages container - Should grow and scroll */}
      {/* Apply flex-grow and overflow-y-auto here */}
      <div className="flex-grow overflow-y-auto px-4 pt-4 pb-2 space-y-4">
        {/* Welcome screen or Messages */}
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            {/* HowToUsePanel and upload message and buttons are now sticky above, so nothing here */}
          </div>
        ) : (
          // Map and render each message using ChatMessage component
          messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={message.isStreaming}
                // Pass down relevant handlers, including onInsertContent
                onInsertContent={onInsertContent} // <-- Pass prop here
                // Add other handlers as needed (onEditMessage, onRegenerateResponse, etc.)
                onCopyContent={(content) => navigator.clipboard.writeText(content)}
                onRegenerateResponse={(messageId) => {
                  // Find the user message that preceded this AI message
                  const messageIndex = messages.findIndex(m => m.id === messageId);
                  if (messageIndex > 0) {
                    const userMessage = messages[messageIndex - 1];
                    if (userMessage.role === 'user') {
                      // Remove the AI message
                      setMessages(prevMessages => {
                        const newMessages = [...prevMessages];
                        newMessages.splice(messageIndex, 1);
                        return newMessages;
                      });
                      // Regenerate using the same user message, but suppress adding a new user message
                      handleSendMessage(userMessage.content, undefined, undefined, true);
                    }
                  }
                }}
                // onEditMessage={(messageId, newContent) => handleEditMessage(messageId, newContent)} // Example if needed
              />
          ))
        )}
        
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display with dismissible option */}
      {error && (
        <div className="p-4 bg-red-900 bg-opacity-50 border border-red-600 text-red-100 rounded-md shadow-sm mx-4 mb-4 flex justify-between items-start">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="ml-2 text-red-100 hover:text-white focus:outline-none"
            aria-label="Dismiss error"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Input area at the bottom - flex-shrink-0 ensures it doesn't shrink */}
      {/* Added bg-background to match the theme */}
      <div className="flex-shrink-0 px-4 py-2 bg-background sticky bottom-0">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isUIDisabled} 
          onFileUpload={handleFiles}
          isNewChat={showWelcome}
          messagesCount={messages.length}
          initialValue={initialInputValue}
        />
      </div>

      {/* Template Population Modal */}
      <TemplatePopulationModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templateId={modalTemplateId}
        onDraftCreated={(draftId: string) => {
            console.log("Draft created with ID:", draftId, " - Loading into editor.");
            setActiveEditorItem({ type: 'draft', id: draftId });
            setShowTemplateModal(false);
        }}
      />

      {/* AIDraftModal */}
      <AIDraftModal
        isOpen={showAIDraftModal}
        onClose={() => {
          setShowAIDraftModal(false);
          setAIDraftContent(null);
        }}
        context="document"
        initialContent={aiDraftContent || ''}
      />

      {/* Tips Modal */}
      <Modal isOpen={showTipsModal} onClose={() => setShowTipsModal(false)} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Tips for Using the Assistant</ModalHeader>
          <ModalCloseButton onClick={() => setShowTipsModal(false)} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
              {howToUseTips.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center text-center p-4 bg-surface-lighter rounded-lg h-full border border-gray-700">
                  <div className="mb-3 p-2 bg-surface rounded-full">{item.icon}</div>
                  <div className="font-medium text-text-primary mb-1.5">{item.title}</div>
                  <div className="text-text-secondary text-sm mb-3 flex-grow">{item.desc}</div>
                  <div className="bg-surface-darker text-primary text-xs px-2 py-1 rounded font-mono select-all w-full truncate">{item.example}</div>
                </div>
              ))}
            </div>
            {/* Add the placeholder text hints here */}
            <div className="mt-4 pt-4 border-t border-gray-700 text-center text-text-secondary text-sm">
              Shift+Enter = new line • / = Commands • Attach files with document button
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

    </div>
  );
};

export default ChatInterface;