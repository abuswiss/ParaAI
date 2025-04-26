import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { sendMessageStream } from '../../services/chatService';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
import { motion, AnimatePresence } from 'framer-motion';

// Import the separate components
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  documentContext?: string; // Reference to document context, if any
  analysisContext?: DocumentAnalysisResult; // Reference to analysis context, if any
  isEditing?: boolean; // For editing mode
}

interface ChatInterfaceProps {
  conversationId?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<string | null>(null);
const [activeDocumentName, setActiveDocumentName] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [messageIdBeingEdited, setMessageIdBeingEdited] = useState<string | null>(null);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to store the active conversation ID (possibly created on demand)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Reset state and add initial system message when conversationId changes
  useEffect(() => {
    // Reset the state
    setActiveContext(null);
    setActiveDocumentName(null);
    setActiveAnalysis(null);
    setMessageIdBeingEdited(null);
    setLastUserMessageId(null);
    setError(null);
    // Set the active conversation ID, handling the case where conversationId might be undefined
    setActiveConversationId(conversationId && conversationId !== 'new' ? conversationId : null);
    
    // Load conversation if we have an ID, otherwise show welcome message
    if (conversationId && conversationId !== 'new') {
      // TODO: Load the conversation messages from the database
      console.log(`Loading conversation: ${conversationId}`);
      // For now, just add the welcome message
      setMessages([
        {
          id: '0',
          role: 'system',
          content: 'Welcome back to this conversation. How can I help you today?',
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      // Reset to initial welcome message for new chat
      setMessages([
        {
          id: '0',
          role: 'system',
          content: 'Welcome to Paralegal AI Assistant. How can I help you today?',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Copy message content to clipboard
  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        // Can add a toast notification here if desired
        console.log('Content copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy content: ', err);
      });
  };

  // Handle editing a message
  const handleEditMessage = (messageId: string, newContent: string) => {
    // If newContent is the same as the original and messageIdBeingEdited is not null,
    // it means we're canceling the edit
    if (messageId === messageIdBeingEdited) {
      setMessages(messages.map(message => {
        if (message.id === messageId) {
          return { ...message, isEditing: false };
        }
        return message;
      }));
      setMessageIdBeingEdited(null);
      return;
    }

    // If messageIdBeingEdited is null, it means we're starting a new edit
    if (messageIdBeingEdited === null) {
      setMessages(messages.map(message => {
        if (message.id === messageId) {
          return { ...message, isEditing: true };
        }
        return message;
      }));
      setMessageIdBeingEdited(messageId);
      return;
    }

    // If we reach here, it means we're saving an edit
    setMessages(messages.map(message => {
      if (message.id === messageId) {
        return { ...message, content: newContent, isEditing: false };
      }
      return message;
    }));
    setMessageIdBeingEdited(null);

    // If the edited message is the last user message, update lastUserMessageId
    if (messageId === lastUserMessageId) {
      // If the message was regenerated, we should trigger the AI response
      const userMessage = messages.find(m => m.id === messageId);
      if (userMessage && userMessage.content !== newContent) {
        // Find the next assistant message to regenerate
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1 && msgIndex < messages.length - 1 && messages[msgIndex + 1].role === 'assistant') {
          handleRegenerateResponse(messages[msgIndex + 1].id);
        }
      }
    }
  };

  // Regenerate an AI response
  const handleRegenerateResponse = async (messageId: string) => {
    // Find the assistant message
    const assistantMessage = messages.find(m => m.id === messageId);
    if (!assistantMessage || assistantMessage.role !== 'assistant') return;

    // Find the preceding user message
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex <= 0) return;
    
    const userMessage = messages[msgIndex - 1];
    if (userMessage.role !== 'user') return;
    
    // Call handleSendMessage with the user message content and contexts
    await handleSendMessage(
      userMessage.content, 
      userMessage.documentContext, 
      userMessage.analysisContext,
      messageId // Pass the messageId to replace
    );
  };

  const handleSendMessage = async (
    content: string, 
    documentContext?: string, 
    analysisContext?: DocumentAnalysisResult,
    messageIdToReplace?: string
  ) => {
    if (!content.trim()) return;

    // Update active context if document context is provided
    if (documentContext) {
      setActiveContext(documentContext);
    }
    
    // Update active analysis if analysis context is provided
    if (analysisContext) {
      setActiveAnalysis(analysisContext);
    }

    // Add user message
    // If we're regenerating a response, don't add another user message
    if (!messageIdToReplace) {
      const userMessageId = Date.now().toString();
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        documentContext: documentContext || undefined,
        analysisContext: analysisContext || undefined,
      };
      
      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setLastUserMessageId(userMessageId);
    }

    // This line is now handled in the conditional block above
    setIsLoading(true);
    setError(null);

    // Create a placeholder for the AI response
    const placeholderId = messageIdToReplace || `ai-${Date.now()}`;
    const placeholderMessage: Message = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      documentContext: documentContext || undefined,
      analysisContext: analysisContext || undefined,
    };

    // If we're regenerating, replace the existing message, otherwise add a new one
    if (messageIdToReplace) {
      setMessages((prevMessages) => 
        prevMessages.map(msg => 
          msg.id === messageIdToReplace ? placeholderMessage : msg
        )
      );
    } else {
      setMessages((prevMessages) => [...prevMessages, placeholderMessage]);
    }

    try {
      const chunks: string[] = [];

      // Create a new conversation for the first message if needed
      if (!activeConversationId) {
        try {
          // Import the conversation creation function
          const { createConversation } = await import('../../services/chatService');
          const { data: newConversation, error } = await createConversation('New Conversation');
          
          if (error) {
            console.error('Error creating conversation:', error);
            
            // Show specific error messages based on type
            if (error.message.includes('authentication') || error.message.includes('sign in')) {
              setError(`Authentication error: ${error.message}. Please sign in again.`);
              // Redirect to login after a delay
              setTimeout(() => {
                window.location.href = '/auth';
              }, 5000);
            } else if (error.message.includes('connection') || error.message.includes('database')) {
              setError(`Database connection error: ${error.message}. Please try again later.`);
            } else {
              setError(`Error: ${error.message}`);
            }
            
            setIsLoading(false);
            return; // Stop message sending if we can't create a conversation
          } 
          
          if (newConversation) {
            console.log('Created new conversation:', newConversation.id);
            setActiveConversationId(newConversation.id);
            // Clear any previous errors
            setError(null);
          } else {
            // Unexpected case - no error but no conversation either
            console.warn('No conversation created and no error reported');
            setError('Unable to create conversation. Please try again.');
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error('Failed to create conversation:', err);
          setError('An unexpected error occurred. Please try again.');
          setIsLoading(false);
          return;
        }
      }
      
      await sendMessageStream(
        activeConversationId!, // Now we have a real conversation ID
        content,
        (chunk) => {
          chunks.push(chunk);

          // Update the message as chunks come in
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            const messageIndex = newMessages.findIndex((m) => m.id === placeholderId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: chunks.join(''),
                isStreaming: true
              };
            }
            return newMessages;
          });
        },
        activeContext || undefined, // Pass document context to the API
        activeAnalysis ? JSON.stringify(activeAnalysis) : undefined // Pass analysis context to the API
      );

      // Mark streaming as complete
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const messageIndex = newMessages.findIndex((m) => m.id === placeholderId);
        if (messageIndex !== -1) {
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            isStreaming: false
          };
        }
        return newMessages;
      });
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');

      // Update placeholder with error message
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const messageIndex = newMessages.findIndex((m) => m.id === placeholderId);
        if (messageIndex !== -1) {
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            content: 'Sorry, I encountered an error. Please try again.',
            isStreaming: false
          };
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show welcome state if no messages except system message
  // Show welcome screen for new conversations or when explicitly resetting
  const showWelcome = (messages.length === 1 && messages[0].role === 'system') || !conversationId || conversationId === 'new';
  
  // File upload handling functions
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep the isDraggingFile state true during dragover
    setIsDraggingFile(true);
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set to false if we're leaving the chat container (not entering a child element)
    // Check if we're not entering a child element
    const relatedTarget = e.relatedTarget as Node;
    const currentTarget = e.currentTarget as Node;
    
    if (!currentTarget.contains(relatedTarget)) {
      setIsDraggingFile(false);
    }
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };
  
  const handleFiles = (files: File[]) => {
    try {
      if (!files.length) {
        console.warn('No files provided to handleFiles');
        return;
      }

      // In a real implementation, you would call your document upload service
      // For now, we'll just extract basic info and mock the extraction
      const file = files[0];
      const mockDocument = {
        id: `doc-${Date.now()}`,
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: `Sample extracted text from ${file.name}. This is a placeholder for actual text extraction.`
      };
      
      // Set the active context and document name
      setActiveContext(mockDocument.extractedText);
      setActiveDocumentName(file.name);
      
      // Clear any previous errors
      setError(null);
      
      // Show a notification or feedback that the document was uploaded
      console.log('Document uploaded to chat:', mockDocument.filename);
      
      // Always add a system message about the document to make behavior consistent regardless of upload method
      setMessages(prev => [
        ...prev,
        {
          id: `system-doc-${Date.now()}`,
          role: 'system',
          content: `Document "${file.name}" has been uploaded and is ready for analysis.`,
          timestamp: new Date().toISOString(),
        }
      ]);
    } catch (err) {
      console.error('Error handling files:', err);
      setError(`Failed to process document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
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
      {/* Document context indicator */}
      {activeContext && activeDocumentName && (
        <div className="px-4 py-2 bg-gray-800 flex items-center space-x-2 text-sm border-b border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-400 truncate max-w-xs">Using document context: {activeDocumentName}</span>
          <button 
            onClick={() => {
              setActiveContext(null);
              setActiveDocumentName(null);
            }} 
            className="text-gray-500 hover:text-gray-300 ml-auto"
            aria-label="Clear document context"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Analysis context indicator */}
      {activeAnalysis && (
        <div className="px-4 py-2 bg-gray-800 flex items-center space-x-2 text-sm border-b border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-400">Using {activeAnalysis.analysisType} analysis for enhanced responses</span>
          <button 
            onClick={() => setActiveAnalysis(null)} 
            className="text-gray-500 hover:text-gray-300 ml-auto"
            aria-label="Clear analysis context"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Messages container with animations */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 relative">
        {/* Drag overlay indicator */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-surface-darker bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 border-2 border-dashed border-primary rounded-md">
            <div className="text-center p-6 rounded-lg">
              <svg className="mx-auto h-12 w-12 text-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-text-primary">Drop your files here</h3>
              <p className="mt-1 text-sm text-text-secondary">Drop files to upload and analyze them</p>
              <button 
                onClick={handleFileButtonClick}
                className="mt-4 inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-md shadow-sm transition-colors duration-200"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Select File
              </button>
            </div>
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.doc,.txt"
        />
        <AnimatePresence>
          {!showWelcome && messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ChatMessage 
                key={message.id} 
                message={message} 
                isStreaming={message.isStreaming}
                onEditMessage={handleEditMessage}
                onRegenerateResponse={handleRegenerateResponse}
                onCopyContent={handleCopyContent}
                onSaveMessage={() => console.log('Save message functionality to be implemented')}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Welcome message with streamlined design */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div 
              className="flex flex-col h-full justify-center items-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome to Paralegal AI Assistant</h2>
                <p className="text-gray-400 max-w-lg mx-auto">Your AI-powered legal assistant designed to help with document analysis, case management, and legal research.</p>
              </div>
              
              {/* Instructional text instead of buttons */}
              <div className="text-center text-gray-400 mb-8 w-full max-w-2xl">
                <p className="mb-2"><span className="text-primary">Drag and drop</span> documents onto the chat or use the <span className="text-primary">+</span> button in the chat box to upload.</p>
                <p>You can also use the search icon in the top-right corner to find existing documents.</p>
              </div>
              
              {/* Chat suggestion section with cleaner design */}
              <div className="mb-4">
                <h3 className="text-center text-sm text-gray-400 mb-4">I can help you with:</h3>
                <div className="grid grid-cols-2 gap-3 w-full max-w-2xl mx-auto">
                  <button 
                    onClick={() => handleSendMessage("Summarize this document")} 
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-text-primary px-4 py-3 rounded-md text-sm transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    <span>Summarize this document</span>
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Extract key legal provisions")} 
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-text-primary px-4 py-3 rounded-md text-sm transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span>Extract key legal provisions</span>
                  </button>
                  <button 
                    onClick={() => handleSendMessage("What are the potential risks?")} 
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-text-primary px-4 py-3 rounded-md text-sm transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>What are the potential risks?</span>
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Create a timeline of events")} 
                    className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-text-primary px-4 py-3 rounded-md text-sm transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span>Create a timeline of events</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

      {/* Input component with dynamic positioning */}
      <ChatInput 
        onSendMessage={handleSendMessage} 
        disabled={isLoading} 
        isNewChat={showWelcome}
        messagesCount={messages.length}
        onFileUpload={handleFiles} /* Pass the file handling function to ChatInput */
      />
    </div>
  );
};

export default ChatInterface;
