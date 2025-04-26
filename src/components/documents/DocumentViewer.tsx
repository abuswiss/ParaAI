import React, { useState, useEffect } from 'react';
import { getDocumentById, getDocumentUrl, processDocument } from '../../services/documentService';
import { Document as DocumentType } from '../../types/document';
import DocumentAnalyzer from './DocumentAnalyzer';
import { useNavigate } from 'react-router-dom';

interface DocumentViewerProps {
  documentId: string;
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose }) => {
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentType | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview');
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch document metadata
        const { data, error } = await getDocumentById(documentId);
        if (error) throw error;
        if (!data) throw new Error('Document not found');

        setDocument(data);

        // Get download URL
        if (data.storagePath) {
          const urlResponse = await getDocumentUrl(data.storagePath);
          if (urlResponse.error) throw urlResponse.error;
          setDocumentUrl(urlResponse.data);
        }
      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  const handleProcessDocument = async () => {
    if (!document) return;
    
    try {
      setProcessing(true);
      setError(null);
      
      const { success, error } = await processDocument(documentId);
      
      if (!success || error) {
        throw error || new Error('Failed to process document');
      }
      
      // Refresh document data to get extracted text
      const { data, error: refreshError } = await getDocumentById(documentId);
      if (refreshError) throw refreshError;
      if (!data) throw new Error('Document not found');
      
      setDocument(data);
      setViewMode('text');
    } catch (err) {
      console.error('Error processing document:', err);
      setError('Failed to extract text from document. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const renderFilePreview = () => {
    if (!document || !documentUrl) return null;
    
    const fileType = document.contentType;
    
    if (fileType.includes('pdf')) {
      return (
        <iframe 
          src={documentUrl} 
          className="w-full h-[70vh] rounded-md border border-gray-600"
          title={document.filename}
        />
      );
    } else if (fileType.includes('image')) {
      return (
        <img 
          src={documentUrl} 
          alt={document.filename} 
          className="max-w-full max-h-[70vh] object-contain mx-auto"
        />
      );
    } else if (fileType.includes('text') || fileType.includes('application/json')) {
      return (
        <iframe 
          src={documentUrl} 
          className="w-full h-[70vh] rounded-md border border-gray-600 bg-white"
          title={document.filename}
        />
      );
    } else {
      return (
        <div className="text-center p-8 bg-gray-800 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-text-secondary mb-4">Preview not available for this file type</p>
          <a 
            href={documentUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-primary hover:bg-primary-hover text-white font-medium py-2 px-4 rounded-md transition inline-flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download File
          </a>
        </div>
      );
    }
  };

  const renderTextContent = () => {
    if (!document?.extractedText) {
      return (
        <div className="text-center p-8 bg-gray-800 rounded-md">
          <p className="text-text-secondary mb-4">No extracted text available</p>
          <button
            onClick={handleProcessDocument}
            disabled={processing}
            className="bg-primary hover:bg-primary-hover text-white font-medium py-2 px-4 rounded-md transition inline-flex items-center"
          >
            {processing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 100-2h5a1 1 0 011 1v5a1 1 0 100-2v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Extract Text
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-md p-6 h-[70vh] overflow-y-auto">
        <div className="whitespace-pre-wrap text-text-primary p-4 font-mono text-sm">
          {document.extractedText}
          
          {/* Text analysis actions */}
          <div className="mt-6 border-t border-gray-700 pt-4">
            <h3 className="text-lg font-medium text-text-primary mb-2">Document Analysis Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                className="flex items-center space-x-2 p-3 bg-gray-800 rounded-md hover:bg-gray-700 transition"
                onClick={() => setShowAnalyzer(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
                <span className="text-text-primary">Comprehensive Analysis</span>
              </button>
              <button 
                className="flex items-center space-x-2 p-3 bg-gray-800 rounded-md hover:bg-gray-700 transition"
                onClick={() => {
                  setShowAnalyzer(true);
                  // This would be wired up to select the 'summary' tab directly
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
                <span className="text-text-primary">Quick Summary</span>
              </button>
              <button 
                className="flex items-center space-x-2 p-3 bg-gray-800 rounded-md hover:bg-gray-700 transition"
                onClick={() => {
                  setShowAnalyzer(true);
                  // This would be wired up to select the 'risks' tab directly
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-text-primary">Risk Analysis</span>
              </button>
              <button 
                className="flex items-center space-x-2 p-3 bg-gray-800 rounded-md hover:bg-gray-700 transition"
                onClick={() => {
                  // This would be wired up to extract timeline events
                  setShowAnalyzer(true);
                  // Select appropriate tab
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span className="text-text-primary">Extract Timeline</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Conditional rendering for loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Conditional rendering for error state or document not found
  if (error || !document) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">
            {error || 'Document not found'}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render document analyzer in a more compact overlay
  if (showAnalyzer && document) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col my-8 sm:my-0">
          <div className="sticky top-0 p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-lg">
            <h2 className="text-lg font-medium text-text-primary">Document Analysis</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // This would be connected to a state that minimizes the analyzer
                  // For now just a visual element
                }}
                className="text-gray-400 hover:text-text-primary p-1 rounded hover:bg-gray-800"
                title="Minimize"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button 
                onClick={() => setShowAnalyzer(false)}
                className="text-gray-400 hover:text-text-primary p-1 rounded hover:bg-gray-800"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <DocumentAnalyzer documentData={document} onClose={() => setShowAnalyzer(false)} />
          </div>
        </div>
      </div>
    );
  }
  
  // Main document viewer UI
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Compact header with close button, document info and expandable options */}
        <div className="bg-background border-b border-gray-800 p-3 md:p-4 relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex-grow overflow-hidden">
            <h2 className="text-lg font-medium text-text-primary truncate">{document?.filename}</h2>
            <p className="text-xs text-text-secondary">
              {document?.contentType} • {document?.size && typeof document.size === 'number' ? 
                `${Math.round(document.size / 1024)} KB` : 'Unknown size'}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowAnalyzer(!showAnalyzer)}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded-md flex items-center"
              title="AI Analysis"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              AI Analysis
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-text-primary transition p-1 rounded-md hover:bg-gray-800"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* View mode selector */}
        <div className="flex py-2 px-3 md:px-4 border-b border-gray-700 overflow-x-auto bg-gray-900 justify-between items-center">
          <div className="flex">
            <button
              className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'text' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
              onClick={() => setViewMode('text')}
            >
              Extracted Text
            </button>
          </div>
          <div className="flex items-center text-text-secondary text-sm">
            <span className="hidden sm:inline">Uploaded: </span>
            <span className="text-xs">{document?.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Unknown'}</span>
          </div>
        </div>

        {/* Document content area with resize handles */}
        <div className="flex-1 overflow-auto relative">
          {/* Document content */}
          <div className="h-full overflow-auto p-1 md:p-3">
            {viewMode === 'preview' ? renderFilePreview() : renderTextContent()}
          </div>
          
          {/* Resize handles (visual indicators only) */}
          <div className="absolute bottom-3 right-3 text-gray-500 cursor-nwse-resize opacity-50 hover:opacity-100 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        {/* Footer with actions - more compact and responsive */}
        <div className="p-3 border-t border-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center bg-gray-900">
          {/* Mobile view: Stacked buttons */}
          <div className="flex justify-between sm:hidden w-full">
            <div className="flex gap-1">
              {documentUrl && (
                <a
                  href={documentUrl}
                  download={document.filename}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1.5 px-2 rounded transition flex items-center"
                  title="Download Document"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1">Download</span>
                </a>
              )}
            </div>
            <button
              onClick={() => {
                // Add document to conversation context
                if (document) {
                  // Store the document in localStorage to be used in the chat
                  localStorage.setItem('activeDocumentForChat', JSON.stringify({
                    id: document.id,
                    filename: document.filename,
                    extractedText: document.extractedText,
                    timestamp: new Date().toISOString()
                  }));

                  // Navigate to chat page
                  navigate('/chat');
                }
              }}
              className="bg-primary hover:bg-primary-dark text-white text-xs font-medium py-1.5 px-2 rounded transition flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
              </svg>
              <span className="ml-1">Use in Chat</span>
            </button>
          </div>
          
          {/* Desktop view: Horizontal layout */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-xs text-gray-400 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              {new Date(document.uploadedAt).toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-400">
              {document.processingStatus === 'completed' ? 'Processing completed' : 
               document.processingStatus === 'processing' ? 'Processing in progress' : 
               document.processingStatus === 'pending' ? 'Processing pending' : 'Processing failed'}
            </div>
          </div>
          
          <div className="hidden sm:flex gap-2">
            {documentUrl && (
              <a
                href={documentUrl}
                download={document.filename}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1.5 px-2 rounded transition flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </a>
            )}
            <button
              onClick={() => {
                // Add document to conversation context
                if (document) {
                  // Store the document in localStorage to be used in the chat
                  localStorage.setItem('activeDocumentForChat', JSON.stringify({
                    id: document.id,
                    filename: document.filename,
                    extractedText: document.extractedText,
                    timestamp: new Date().toISOString()
                  }));

                  // Navigate to chat page
                  navigate('/chat');
                }
              }}
              className="bg-primary hover:bg-primary-dark text-white text-xs font-medium py-1.5 px-2 rounded transition flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
              </svg>
              Use in Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
