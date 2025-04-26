import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessageStream, getConversationMessages } from '../../services/chatService';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Import the separate components - only using ChatInput now since we're rendering messages directly
import ChatInput from './ChatInput';

// Define interfaces
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  // Support both timestamp (frontend) and created_at (Supabase schema) for compatibility
  timestamp?: string;
  created_at?: string;
  isStreaming?: boolean;
  documentContext?: string; // Reference to document context, if any
  analysisContext?: DocumentAnalysisResult; // Reference to analysis context, if any
  isEditing?: boolean; // For editing mode
  conversation_id?: string; // For Supabase compatibility
}

interface ChatInterfaceProps {
  conversationId?: string;
}

// Define component using function declaration instead of arrow function
function ChatInterface({ conversationId }: ChatInterfaceProps) {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [documentProcessingProgress, setDocumentProcessingProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUIDisabled, setIsUIDisabled] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State to store the active conversation ID (possibly created on demand)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

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
        setMessages(data);
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
    console.log('Conversation ID changed:', conversationId);
    
    if (!conversationId) {
      // No conversation ID provided
      console.log('No conversation ID, clearing messages');
      setActiveConversationId(null);
      setMessages([]);
    } else if (conversationId === 'new') {
      // New conversation requested
      console.log('New conversation requested');
      setActiveConversationId(null); // Start with null to ensure new creation
      setMessages([]); // Clear any existing messages
    } else {
      // Existing conversation, fetch messages
      console.log('Loading existing conversation:', conversationId);
      setActiveConversationId(conversationId);
      fetchMessages(conversationId);
    }
    
    // Scroll to bottom when conversation changes
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationId, fetchMessages]);

  // Reset state and add initial system message when conversationId changes
  useEffect(() => {
    // Reset the state
    setActiveContext(null);
    setActiveDocumentName(null);
    setActiveAnalysis(null);
    setError(null);
  }, [conversationId]);

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

  // Format timestamp for display
  const formatMessageTime = (message: Message): string => {
    const timestamp = message.created_at || message.timestamp || new Date().toISOString();
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (e) {
      console.error('Error formatting time:', e);
      return 'Unknown time';
    }
  };
  
  // Helper function to add a message to the chat
  const addMessage = (message: Message) => {
    setMessages(prevMessages => [...prevMessages, message]);
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
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isSendingMessage) return;
    
    console.log('Sending message:', content);
    
    try {
      setIsSendingMessage(true);
      setIsUIDisabled(true);
      
      // Create a placeholder message ID for streaming updates
      const placeholderId = uuidv4();
      
      // Pre-add user message to UI
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: content,
        timestamp: new Date().toISOString()
      };
      
      // Generate a random loading message
      const initialLoadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
      
      // Add placeholder for assistant message with initial loading text
      const assistantMessage: Message = {
        id: placeholderId,
        role: 'assistant',
        content: initialLoadingMessage,
        timestamp: new Date().toISOString(),
        isStreaming: true
      };
      
      // Add both messages to the UI
      setMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
      
      // Set up a rotating loading message until the first chunk arrives
      let loadingIndex = 0;
      const loadingInterval = setInterval(() => {
        loadingIndex = (loadingIndex + 1) % loadingMessages.length;
        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
          if (messageIndex !== -1 && newMessages[messageIndex].isStreaming) {
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              content: loadingMessages[loadingIndex]
            };
          }
          return newMessages;
        });
      }, 2000); // Change message every 2 seconds
      
      // Create a buffer for response chunks
      const chunks: string[] = [];
      
      console.log('Active conversation ID:', activeConversationId);
      
      // Send message and handle streaming response
      const response = await sendMessageStream(
        activeConversationId,
        content,
        (chunk) => {
          // Clear the loading interval on first chunk
          if (chunks.length === 0) {
            clearInterval(loadingInterval);
          }
          
          chunks.push(chunk);
          console.log('Received chunk:', chunk.length > 20 ? chunk.substring(0, 20) + '...' : chunk);

          // Update the message as chunks come in
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: chunks.join('')
              };
            }
            return newMessages;
          });
        },
        activeContext || undefined, // Pass document context to the API
        activeAnalysis ? JSON.stringify(activeAnalysis) : undefined // Pass analysis context to the API
      );
      
      // Clear the loading interval if it's somehow still running
      clearInterval(loadingInterval);

      console.log('Message response:', response);

      // If a new conversation was created, update the active conversation ID
      if (response.newConversationId) {
        console.log('New conversation created:', response.newConversationId);
        setActiveConversationId(response.newConversationId);
      }
      
      // Mark streaming as complete
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        const messageIndex = newMessages.findIndex(m => m.id === placeholderId);
        if (messageIndex !== -1) {
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            isStreaming: false
          };
        }
        return newMessages;
      });
      
      console.log('Message sending complete');
    } catch (error) {
      console.error('Error sending message:', error);
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
      setError(null); // Clear any previous errors
      console.log('Processing document:', files[0].name);
      
      // Import the document services
      const { uploadDocument, processDocument, getDocumentById } = await import('../../services/documentService');
      
      // Get current user ID from Supabase
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated. Please sign in to upload documents.');
      }

      // Upload document first
      setDocumentProcessingProgress(30);
      console.log('Uploading document to storage...');
      try {
        const uploadResult = await uploadDocument(files[0], userId);
        
        // Store document info for processing
        const docId = uploadResult.id;
        // URL may be used later for direct access to the document
        // const docUrl = uploadResult.url;
        
        console.log('Document uploaded successfully with ID:', docId);
        
        if (!docId) {
          throw new Error("Failed to upload document: No document ID returned");
        }
      
        // Now process it to extract text
        setDocumentProcessingProgress(60);
        console.log('Extracting text from document...');
        const { error: processError } = await processDocument(docId);
        
        if (processError) {
          console.error('Document processing error:', processError);
          throw new Error(`Processing failed: ${processError.message || 'Could not extract text from document'}`); 
        }
        
        // Fetch the document with extracted text
        setDocumentProcessingProgress(90);
        console.log('Fetching processed document...');
        const { data: processedDoc, error: fetchError } = await getDocumentById(docId);
      
        if (fetchError) {
          console.error('Error fetching processed document:', fetchError);
          throw new Error(`Could not retrieve document: ${fetchError.message}`); 
        }
      
        // Check if document was processed successfully
        if (!processedDoc || !processedDoc.extractedText) {
          console.warn('Document processed but no text was extracted');
          // Continue with a fallback message
          const fallbackContent = `Document '${files[0].name}' was uploaded, but text extraction was not successful. The AI will not have access to the document content.`;
          
          // Alert the user
          setError(`Could not extract text from ${files[0].name}. The document might be scanned or contain text in images.`);
          setDocumentProcessingProgress(0);

          // Add a system message with the fallback
          addMessage({
            id: uuidv4(),
            role: 'system',
            content: fallbackContent,
            timestamp: new Date().toISOString(),
          });
          
          return; // Exit early
        }

        // Set the active document context for the chat
        setActiveContext(processedDoc.extractedText);
        setActiveDocumentName(processedDoc.filename);
        
        // Check if this is fallback content by looking for marker phrases in the text
        const isFallback = 
          processedDoc.extractedText.includes('[AI ASSISTANT NOTE:') ||
          processedDoc.extractedText.includes('[PDF EXTRACTION FALLBACK]') ||
          processedDoc.extractedText.includes('[DOCX EXTRACTION FALLBACK]') ||
          // Also check in the database record if this exists
          (processedDoc as any).is_fallback_content === true;
        
        if (isFallback) {
          console.warn("Using fallback content for document:", processedDoc.filename);
          // Show a message but don't throw an error since we still have usable content
          setError("Note: Using AI-generated document summary. The original document could not be accessed.");
        } else {
          console.log("Document processed successfully:", processedDoc.filename);
        }
      
        // Success! Add the document to the context
        setDocumentProcessingProgress(100);
        
        // Display to the user
        addMessage({
          id: uuidv4(),
          role: 'system',
          content: `Document '${files[0].name}' has been uploaded and processed successfully.`,
          timestamp: new Date().toISOString(),
          documentContext: processedDoc.extractedText
        });
        
        // Reduce the progress back to zero
        setTimeout(() => {
          setDocumentProcessingProgress(0);
        }, 1000);
      } catch (innerError) {
        // Handle inner-specific errors here if needed
        console.error('Error in document processing step:', innerError);
        throw innerError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error('Error processing document:', error);
      setError(`Error processing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDocumentProcessingProgress(0);
    } finally {
      // Reset progress after a delay to show completion
      setTimeout(() => {
        setIsProcessingDocument(false);
        setDocumentProcessingProgress(0);
      }, 1500);
    }
  };

  // Show welcome state ONLY for new conversations with no messages
  // This ensures we don't show the welcome screen when messages exist in the database
  const showWelcome = messages.length === 0 && (!conversationId || conversationId === 'new');
  
  // Sample quick questions for the welcome screen - reduced to 4 in a 2x2 grid
  const suggestionItems = [
    "What are the key elements of a valid contract?",
    "How do I file a trademark application?",
    "What's the difference between a patent and copyright?",
    "What steps should I take if I receive a cease and desist?",
  ];
  
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
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold mb-4">Welcome to the Paralegal AI Assistant</h2>
              <p className="mb-4 text-gray-300 text-lg">
                I can help you analyze legal documents, draft responses, and answer legal questions.
              </p>
              
              {/* Quick suggestion buttons in a 2x2 grid layout */}
              <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto mt-6">
                {suggestionItems.map((suggestion, index) => (
                  <button
                    key={index}
                    className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-left transition-colors text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    onClick={() => handleSendMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              
              <p className="text-sm text-gray-400 mt-4">
                You can also upload a document or type your own question below.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            {/* Messages container with improved styling */}
            <div className="px-4 pt-6 pb-20 h-full flex flex-col overflow-y-auto space-y-6">
              {/* Map and render each message with a flatter design */}
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`w-full mb-6 ${isUser ? 'pr-12' : 'pl-12'}`}
                  >
                    {/* User display with avatar and message in semi-transparent bubble */}
                    {isUser ? (
                      <div className="flex items-start justify-end">
                        <div className="max-w-[80%]">
                          <div className="inline-block bg-gray-700 bg-opacity-50 px-4 py-3 rounded-lg text-white">
                            {message.content}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 text-right mr-1">
                            {formatMessageTime(message)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* AI response directly on background */
                      <div className="flex items-start">
                        <div className="mr-3 mt-1">
                          <div className="rounded-full w-7 h-7 bg-secondary text-white flex items-center justify-center text-xs font-semibold">
                            AI
                          </div>
                        </div>
                        <div className="flex-1 max-w-[90%]">
                          <div className="text-white mb-2">
                            {message.isStreaming ? (
                              <div className="whitespace-pre-wrap">{message.content}</div>
                            ) : (
                              <div className="markdown-content">
                                <ReactMarkdown
                                  components={{
                                    // Override component rendering to maintain consistent styles
                                    h1: ({children}) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
                                    h2: ({children}) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
                                    h3: ({children}) => <h3 className="text-md font-bold mt-3 mb-1">{children}</h3>,
                                    h4: ({children}) => <h4 className="font-bold mt-2 mb-1">{children}</h4>,
                                    p: ({children}) => <p className="mb-2">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc pl-8 mb-2">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal pl-8 mb-2">{children}</ol>,
                                    li: ({children}) => <li className="mb-1">{children}</li>,
                                    a: ({href, children}) => <a href={href} className="text-primary underline">{children}</a>,
                                    code: ({className, children, node}) => {
                                      const match = /language-(.+)/.exec(className || '');
                                      const isInline = !match && (node?.position?.start.line === node?.position?.end.line);
                                      return isInline ? 
                                        <code className="font-mono bg-gray-800 px-1 rounded text-xs">{children}</code> :
                                        <code className="font-mono block bg-gray-800 p-2 rounded-md my-2 text-sm overflow-x-auto">{children}</code>;
                                    },
                                    pre: ({children}) => <pre className="bg-gray-800 p-2 rounded-md my-2 overflow-x-auto">{children}</pre>,
                                    blockquote: ({children}) => <blockquote className="border-l-4 border-gray-400 pl-4 italic my-2">{children}</blockquote>,
                                    em: ({children}) => <em className="italic">{children}</em>,
                                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                          {/* Action buttons for AI messages */}
                          <div className="flex items-center space-x-3 mt-2">
                            <button 
                              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
                              onClick={() => navigator.clipboard.writeText(message.content)}
                              title="Copy to clipboard"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                            <button 
                              className="text-gray-400 hover:text-white transition-colors flex items-center p-1 rounded"
                              onClick={() => {
                                // Find the user message that preceded this AI message
                                const messageIndex = messages.findIndex(m => m.id === message.id);
                                if (messageIndex > 0) {
                                  const userMessage = messages[messageIndex - 1];
                                  if (userMessage.role === 'user') {
                                    // Handle regeneration in a proper way without adding new messages
                                    // First remove the AI message
                                    setMessages(prevMessages => {
                                      const newMessages = [...prevMessages];
                                      newMessages.splice(messageIndex, 1);
                                      return newMessages;
                                    });
                                    
                                    // Then regenerate using the same user message
                                    handleSendMessage(userMessage.content);
                                  }
                                }
                              }}
                              title="Regenerate response"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs">Regenerate</span>
                            </button>
                            <span className="text-xs text-gray-500 ml-2">{formatMessageTime(message)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
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

      {/* Input area at the bottom with improved styling - truly no border/shading */}
      <div className="px-4 py-2 bg-transparent sticky bottom-0">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isUIDisabled} 
          onFileUpload={handleFiles}
          isNewChat={showWelcome}
          messagesCount={messages.length}
        />
      </div>
    </div>
  );
};

export default ChatInterface;