import React, { useState, KeyboardEvent, useRef, useEffect, DragEvent } from 'react';
import { Document } from '../../types/document';
import { getUserDocuments } from '../../services/documentService';
import { DocumentAnalysisResult, getDocumentAnalyses } from '../../services/documentAnalysisService';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (message: string, documentContext?: string, analysisContext?: DocumentAnalysisResult) => void;
  onFileUpload?: (files: File[]) => void; // Add prop for parent component to handle file uploads
  disabled?: boolean;
  isNewChat?: boolean;
  messagesCount?: number;
}

// We'll use the Document type from the document service

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onFileUpload, 
  disabled = false, 
  isNewChat = false,
  messagesCount = 0
}) => {
  const [message, setMessage] = useState('');

  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [availableAnalyses, setAvailableAnalyses] = useState<DocumentAnalysisResult[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentContextWarning, setDocumentContextWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const documentPickerRef = useRef<HTMLDivElement>(null);
  const analysisPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(
        trimmedMessage, 
        activeDocument?.extractedText,
        selectedAnalysis || undefined
      );
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };



  // File upload handling functions
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
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
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
    // Pass files to parent component for proper processing
    if (files.length > 0) {
      console.log('Sending files to be processed:', files[0].name);
      
      // Clear any previously active document in this component
      setActiveDocument(null);
      setSelectedAnalysis(null);
      setAvailableAnalyses([]);
      
      // If parent component provided onFileUpload callback, call it
      if (onFileUpload) {
        onFileUpload(files);
      }
    }
  };
  
  // Toggle document picker to select from existing documents
  const toggleDocumentPicker = () => {
    if (!showDocumentPicker) {
      // Load documents when opening the picker
      fetchUserDocuments();
    }
    
    setShowDocumentPicker(!showDocumentPicker);
    if (showAnalysisPicker) setShowAnalysisPicker(false);
  };
  
  // Fetch user documents from the backend
  const fetchUserDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const { data, error } = await getUserDocuments();
      
      if (error) throw error;
      
      // Make sure we get complete documents with extracted text
      const documentsWithText = data?.map(doc => {
        // If document doesn't have extracted text, add a placeholder
        if (!doc.extractedText) {
          return {
            ...doc,
            extractedText: ''
          };
        }
        return doc;
      }) || [];
      
      setUserDocuments(documentsWithText);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  }

  const toggleAnalysisPicker = () => {
    if (!activeDocument) return;
    
    setShowAnalysisPicker(!showAnalysisPicker);
    if (showDocumentPicker) setShowDocumentPicker(false);
    
    if (!showAnalysisPicker && activeDocument) {
      loadDocumentAnalyses(activeDocument.id);
    }
  };

  const clearDocument = () => {
    setActiveDocument(null);
    setSelectedAnalysis(null);
    setAvailableAnalyses([]);
  };
  
  const clearAnalysis = () => {
    setSelectedAnalysis(null);
  };

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (documentPickerRef.current && !documentPickerRef.current.contains(event.target as Node)) {
        setShowDocumentPicker(false);
      }
      if (analysisPickerRef.current && !analysisPickerRef.current.contains(event.target as Node)) {
        setShowAnalysisPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Select a document from the user's existing documents to use as context
  const selectDocumentForContext = (doc: Document) => {
    try {
      // Set loading state
      setLoadingDocuments(true);
      
      // Set the document as active
      setActiveDocument(doc);
      
      // Check if document has extracted text
      if (doc.extractedText) {
        setDocumentContextWarning(null);
        // If document has extracted text, load available analyses
        if (doc.id) {
          loadDocumentAnalyses(doc.id);
        }
      } else {
        console.warn('Document has no extracted text content');
        setDocumentContextWarning('This document has no extracted text content. The AI may not be able to reference it properly.');
      }
    } catch (err) {
      console.error('Error setting document context:', err);
    } finally {
      setLoadingDocuments(false);
      setSelectedAnalysis(null);
      setShowDocumentPicker(false);
    }
  };
  
  // Load analyses for a document from the service
  const loadDocumentAnalyses = async (documentId: string) => {
    try {
      setLoadingAnalyses(true);
      const { data, error } = await getDocumentAnalyses(documentId);
      if (error) throw error;
      setAvailableAnalyses(data || []);
    } catch (err) {
      console.error('Error loading document analyses:', err);
      setAvailableAnalyses([]);
    } finally {
      setLoadingAnalyses(false);
    }
  };
  
  // Select an analysis to include in the chat
  const selectAnalysisForContext = (analysis: DocumentAnalysisResult) => {
    setSelectedAnalysis(analysis);
    setShowAnalysisPicker(false);
  };

  useEffect(() => {
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);
  
  // Load document from localStorage when component mounts
  useEffect(() => {
    // Check for document in localStorage that was set by the DocumentViewer
    const storedDocumentJson = localStorage.getItem('activeDocumentForChat');
    if (storedDocumentJson) {
      try {
        const storedDocData = JSON.parse(storedDocumentJson);
        
        // Check if the document is recent (within the last 10 minutes)
        const docTimestamp = new Date(storedDocData.timestamp).getTime();
        const now = new Date().getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        
        if (now - docTimestamp < tenMinutesMs) {
          // Create a Document object for the stored data
          const document: Document = {
            id: storedDocData.id,
            filename: storedDocData.filename,
            contentType: 'application/pdf', // Assume PDF as a default
            size: 0, // Size is not critical here, we already have the text
            uploadedAt: storedDocData.timestamp,
            processingStatus: 'completed',
            storagePath: `/documents/${storedDocData.id}`,
            extractedText: storedDocData.extractedText
          };
          
          // Set the document as active
          setActiveDocument(document);
          
          // Clear from localStorage to prevent it being used again on refresh
          localStorage.removeItem('activeDocumentForChat');
          
          // If we have a document with text, check for analyses
          if (document.id && document.extractedText) {
            loadDocumentAnalyses(document.id);
          }
        } else {
          // Document is too old, remove it
          localStorage.removeItem('activeDocumentForChat');
        }
      } catch (error) {
        console.error('Error loading document from localStorage:', error);
        localStorage.removeItem('activeDocumentForChat');
      }
    }
  }, []);

  // Determine if the input should be centered (for new chats) or at the bottom (for active chats)
  const isCentered = isNewChat || messagesCount === 0;

  // Animation variants for the input container
  const containerVariants = {
    centered: { 
      maxWidth: '800px',
      width: '100%',
      margin: '0 auto',
      marginBottom: '0px',
    },
    bottom: { 
      maxWidth: '100%',
      width: '100%',
      margin: '0',
      marginBottom: '0px',
    }
  };

  return (
    <div>
      <motion.div 
        className={`border-t border-gray-800 p-4 relative w-full ${isCentered ? 'flex flex-col items-center justify-center min-h-[240px]' : ''}`}
        initial={isCentered ? 'centered' : 'bottom'}
        animate={isCentered ? 'centered' : 'bottom'}
        variants={containerVariants}
        transition={{ duration: 0.5, ease: [0.19, 1.0, 0.22, 1.0] }}
      >
        {/* Context pills with animations */}
        <AnimatePresence>
          {activeDocument && (
            <motion.div 
              className="rounded-md bg-gray-800 mb-3 p-2 w-full flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-sm text-text-primary truncate max-w-[220px]">
                    <span className="text-gray-400">Using document:</span> {activeDocument.filename}
                  </span>
                  {documentContextWarning && (
                    <span className="text-xs text-yellow-500">{documentContextWarning}</span>
                  )}
                </div>
              </div>
              <button
                onClick={clearDocument}
                className="text-gray-500 hover:text-gray-300 ml-2 transition-colors duration-200"
                aria-label="Remove document context"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Analysis context indicator */}
        <AnimatePresence>
          {selectedAnalysis && (
            <motion.div 
              className="rounded-md bg-gray-800 mb-3 p-2 w-full flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-text-primary truncate max-w-[220px]">
                  <span className="text-gray-400">Using analysis:</span> {selectedAnalysis.analysisType} analysis
                </span>
              </div>
              <button
                onClick={clearAnalysis}
                className="text-gray-500 hover:text-gray-300 ml-2 transition-colors duration-200"
                aria-label="Remove analysis context"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

          {/* Document picker (only shown when toggled) */}
        <AnimatePresence>
          {showDocumentPicker && (
            <motion.div 
              ref={documentPickerRef}
              className="absolute bottom-24 left-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-10 w-80"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center text-sm text-gray-400 mb-2 p-2">
                <span>Select a document for context</span>
                {loadingDocuments && (
                  <motion.div 
                    className="h-4 w-4 border-2 border-gray-400 border-t-primary rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  />
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {userDocuments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {loadingDocuments 
                      ? 'Loading documents...' 
                      : 'No documents found. Upload a document first.'}
                  </div>
                ) : (
                  userDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2 hover:bg-gray-700 rounded cursor-pointer"
                      onClick={() => selectDocumentForContext(doc)}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <div className="text-white truncate">{doc.filename}</div>
                          <div className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area with animations - removed border for flatter UI */}
        <motion.div 
          className={`bg-gray-900 rounded-lg relative overflow-hidden transition-all duration-300 mt-2 w-full ${isDraggingFile ? 'border-primary border-2' : ''}`}
          whileHover={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCentered ? "Ask me anything about legal documents..." : "Type your message..."}
            rows={1}
            className="w-full bg-transparent text-text-primary px-3 py-3 pr-12 pb-14 resize-none focus:outline-none rounded-lg transition-all duration-200"
            disabled={disabled}
            style={{ minHeight: '50px' }}
          />
          
          {/* Action buttons container with improved visuals */}
          <div className="absolute bottom-2 left-2 flex items-center p-1 bg-gray-800 rounded-lg space-x-2">


            {/* Upload document button */}
            <button
              className="p-2 rounded-md bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600 transition-colors"
              onClick={handleFileButtonClick}
              type="button"
              disabled={disabled}
              aria-label="Upload document"
              title="Upload document"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Select existing document button */}
            <button
              className="p-2 rounded-md bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600 transition-colors"
              onClick={toggleDocumentPicker}
              type="button"
              disabled={disabled}
              aria-label="Select document"
              title="Select existing document"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Analysis context button - only enabled when document is selected */}
            <button
              className={`p-2 rounded-md ${activeDocument ? 'bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600' : 'bg-gray-800 text-gray-600 cursor-not-allowed'} transition-colors`}
              onClick={toggleAnalysisPicker}
              type="button"
              disabled={disabled || !activeDocument}
              aria-label="Add analysis context"
              title={activeDocument ? "Include document analysis" : "Select a document first"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.doc,.rtf"
            multiple
          />

          {/* Send button with improved visibility */}
          <motion.button
            className={`
              absolute right-3 bottom-3
              bg-primary hover:bg-primary-dark
              rounded-full p-2
              text-white
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50
              shadow-md
            `}
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            type="button"
            aria-label="Send message"
            title="Send message"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </motion.button>
        </motion.div>
          
        {/* Analysis picker (only shown when toggled) - with animations */}
        <AnimatePresence>
          {showAnalysisPicker && (
            <motion.div 
              ref={analysisPickerRef} 
              className="absolute left-20 bottom-14 w-64 max-h-80 overflow-y-auto bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-700 z-10"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-text-primary mb-2">Select Analysis</h3>
              
              {loadingAnalyses ? (
                <div className="flex justify-center p-3">
                  <motion.div 
                    className="rounded-full h-5 w-5 border-b-2 border-primary"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  ></motion.div>
                </div>
              ) : availableAnalyses.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No analyses available for this document.</p>
              ) : (
                <div className="space-y-1">
                  {availableAnalyses.map((analysis, index) => (
                    <motion.button
                      key={`${analysis.id}-${analysis.analysisType}`}
                      className="text-sm w-full text-left px-3 py-2 rounded hover:bg-gray-700 flex items-center justify-between transition-colors duration-200"
                      onClick={() => selectAnalysisForContext(analysis)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: 'rgba(107, 114, 128, 0.5)' }}
                    >
                      <span className="text-text-primary">{analysis.analysisType}</span>
                      <span className="text-xs text-gray-400">{new Date(analysis.createdAt).toLocaleDateString()}</span>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          
        {/* Help text instead of duplicate suggestions */}
        {!isNewChat && messagesCount > 0 && (
          <div className="mt-2 flex justify-center">
            <motion.div 
              className="text-xs text-gray-400 px-2 py-1 rounded-md bg-gray-800/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.2 }}
            >
              Type your message or ask a question about your legal documents
            </motion.div>
          </div>
        )}
      </motion.div>
      
      <motion.div 
        className="text-xs text-gray-500 px-4 py-1 border-t border-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 0.5 }}
      >
        <span>Shift+Enter = new line • / = Commands • Attach files with document button</span>
      </motion.div>
    </div>
  );
};

export default ChatInput;