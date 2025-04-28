import React, { useState, useEffect, useRef, useCallback } from 'react';
// Remove unused imports from jotai
// import { useAtomValue, useSetAtom, useAtom } from 'jotai'; 
import { 
  // Remove unused atom imports
  // activeCaseIdAtom, 
  // activeEditorItemAtom, 
  // editorTextToQueryAtom, 
  ActiveEditorItem
} from '@/atoms/appAtoms';
import { getConversationMessages, createConversation } from '../../services/chatService';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
// import { motion } from 'framer-motion'; // Unused
// import ReactMarkdown from 'react-markdown'; // Unused
import { supabase } from '../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { parseCommand } from '../../lib/commandParser';
import { handleUserTurn, DispatcherResponse } from '../../lib/taskDispatcher';
// import { exportAsTxt, exportAsDocx, exportAsPdf } from '../../utils/exportUtils'; // Unused
import HowToUsePanel from './HowToUsePanel';
import AIDraftModal from '../ai/AIDraftModal';
import TemplatePopulationModal from '@/components/templates/TemplatePopulationModal';

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
  onInsertContent?: (content: string) => void; // <-- Add prop
}

// Define component using function declaration instead of arrow function
function ChatInterface({ 
  conversationId: initialConversationId, 
  onInsertContent // <-- Destructure prop
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
  const [howToUseCollapsed, setHowToUseCollapsed] = useState(true);
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftContent, setAIDraftContent] = useState<string | null>(null);
  // State for Template Population Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [modalTemplateId, setModalTemplateId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Effect to load conversation messages when active conversation changes
  useEffect(() => {
    console.log('Conversation ID changed:', initialConversationId);
    
    if (!initialConversationId) {
      // No conversation ID provided
      console.log('No conversation ID, clearing messages');
      setActiveConversationId(undefined);
      setMessages([]);
    } else if (initialConversationId === 'new') {
      // New conversation requested
      console.log('New conversation requested');
      setActiveConversationId(undefined); // Start with undefined to ensure new creation
      setMessages([]); // Clear any existing messages
    } else {
      // Existing conversation, fetch messages
      console.log('Loading existing conversation:', initialConversationId);
      setActiveConversationId(initialConversationId);
      fetchMessages(initialConversationId);
    }
    
    // Scroll to bottom when conversation changes
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [initialConversationId, fetchMessages]);

  // Reset state and add initial system message when conversationId changes
  useEffect(() => {
    // Reset the state
    setActiveContext(null);
    setActiveDocumentName(null);
    setError(null);
  }, [initialConversationId]);

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

  // Loading messages that rotate while waiting for AI response
  const loadingMessages = [
    "Your AI is thinking...",
    "Processing your request...",
    "Analyzing legal context...",
    "Researching relevant information...",
    "Formulating a response...",
    "Connecting the dots..."
  ];

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

      // If it's a new chat and the task requires an ID, create the conversation first
      if (!currentConversationId && requiresConversationId) {
        console.log('Task requires conversation ID, creating new conversation first...');
        const { data: newConversation, error: createError } = await createConversation('New Chat'); // Use the imported function
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
      let loadingIndex = 0; // Restore loadingIndex declaration here
      let loadingInterval: NodeJS.Timeout | null = null; // Keep interval reference

      if (showImmediateFeedback) {
        // Add user message and assistant placeholder only if needed
        const userMessage: Message = {
          id: uuidv4(),
          role: 'user',
          content: content,
          timestamp: new Date().toISOString() // Ensure timestamp is string
        };
        const initialLoadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        const assistantMessage: Message = {
          id: placeholderId,
          role: 'assistant',
          content: initialLoadingMessage,
          timestamp: new Date().toISOString(), // Ensure timestamp is string
          isStreaming: true,
          conversation_id: currentConversationId ?? undefined
        };
        if (!suppressUserMessage) {
          setMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
        } else {
          setMessages(prevMessages => [...prevMessages, assistantMessage]);
        }
        // Set up loading interval
        loadingInterval = setInterval(() => {
          loadingIndex = (loadingIndex + 1) % loadingMessages.length; // Use loadingIndex
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
            if (messageIndex !== -1 && newMessages[messageIndex].isStreaming) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: loadingMessages[loadingIndex] // Use loadingIndex
              };
            }
            return newMessages;
          });
        }, 2000);
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
          if (loadingInterval && chunks.length === 0) {
            clearInterval(loadingInterval); // Clear interval on first chunk
            loadingInterval = null;
          }
          chunks.push(chunk);
          setMessages(prevMessages => {
             // ... existing message update logic for streaming ...
             const newMessages = [...prevMessages];
             const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
             if (messageIndex !== -1) {
                 newMessages[messageIndex] = { 
                   ...newMessages[messageIndex], 
                   content: chunks.join(''), 
                   isStreaming: true, 
                   conversation_id: currentConversationId ?? undefined,
                   timestamp: newMessages[messageIndex].timestamp || new Date().toISOString() // Ensure timestamp persists
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

      // Clear the loading interval if it's still running
      if (loadingInterval) clearInterval(loadingInterval);

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

  // Function to retry a previous message if needed
  // We'll keep this for future functionality but it's not used yet

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
      {/* HowToUsePanel fixed at the top, collapsible, not scrolling with chat */}
      {showWelcome && !howToUseCollapsed && (
        <div className="sticky top-0 z-20 bg-gray-900 pt-4 pb-2">
          <HowToUsePanel />
          <div className="w-full flex justify-center mb-4">
            <div className="text-gray-400 text-sm bg-gray-800 rounded-lg px-4 py-2 max-w-lg">
              <span>You can also upload a document to analyze, extract timelines, or use as context for your questions and agent tools.</span>
            </div>
          </div>
          <div className="flex justify-center mb-2">
            <button
              className="text-xs text-gray-400 hover:text-primary bg-gray-800 rounded px-2 py-1 transition-colors"
              onClick={() => setHowToUseCollapsed(true)}
              aria-label="Collapse how to use section"
            >
              Hide this section
            </button>
          </div>
          {/* Pinned example action buttons below the panel, only visible when expanded */}
          <div className="flex justify-center gap-4 mt-2 pb-2">
            <button
              className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-base text-left transition-colors text-white focus:outline-none focus:ring-2 focus:ring-primary min-w-[260px]"
              onClick={() => handleSendMessage('What are the key elements of a valid contract?')}
            >
              What are the key elements of a valid contract?
            </button>
            <button
              className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-base text-left transition-colors text-white focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
              onClick={() => {
                // Focus the input and type a slash
                const textarea = document.querySelector('textarea');
                if (textarea) {
                  textarea.focus();
                  setTimeout(() => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(textarea, '/');
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  }, 0);
                }
              }}
            >
              <span className="font-mono text-primary">/</span> Use AI Legal Tools
            </button>
            <button
              className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-base text-left transition-colors text-white focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
              onClick={() => {
                // Fill the input bar with /research prompt but do not submit
                const textarea = document.querySelector('textarea');
                if (textarea) {
                  textarea.focus();
                  setTimeout(() => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(textarea, '/research Miranda rights');
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  }, 0);
                }
              }}
            >
              <span className="font-mono text-primary">/research</span> Miranda rights
            </button>
          </div>
        </div>
      )}
      {showWelcome && howToUseCollapsed && (
        <div className="sticky top-0 z-20 bg-gray-900 pt-2 pb-2 flex justify-center">
          <button
            className="text-xs text-gray-400 hover:text-primary bg-gray-800 rounded px-2 py-1 transition-colors"
            onClick={() => setHowToUseCollapsed(false)}
            aria-label="Expand how to use section"
          >
            Show how to use
          </button>
        </div>
      )}
      
      {/* Document processing indicator */}
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
      
      {/* Error message display */}
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

      {/* Document context indicator */}
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

      {/* Main messages container */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {/* Welcome screen for new chats */}
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            {/* HowToUsePanel and upload message and buttons are now sticky above, so nothing here */}
          </div>
        ) : (
          <div className="w-full h-full">
            {/* Messages container with improved styling */}
            <div className="px-4 pt-6 pb-20 h-full flex flex-col overflow-y-auto space-y-6">
              {/* Map and render each message using ChatMessage component */}
              {messages.map((message) => (
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
              ))}

              {/* Old direct rendering logic - commented out or removed */} 
              {/* {messages.map((message, idx) => { ... })} */}

            </div>
          </div>
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

      {/* Input area at the bottom - add flex-shrink-0 */}
      <div className="px-4 py-2 bg-transparent sticky bottom-0 flex-shrink-0">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isUIDisabled} 
          onFileUpload={handleFiles}
          isNewChat={showWelcome}
          messagesCount={messages.length}
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

    </div>
  );
};

export default ChatInterface;