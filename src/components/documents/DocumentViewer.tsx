import React, { useState, useEffect } from 'react';
import { getDocumentById, getDocumentUrl, processDocument } from '../../services/documentService';
import { Document as DocumentType } from '../../types/document';
import DocumentAnalyzer from './DocumentAnalyzer';

interface DocumentViewerProps {
  documentId: string;
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose }) => {
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
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
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

  // Render document analyzer if it's active
  if (showAnalyzer && document) {
    return <DocumentAnalyzer document={document} onClose={() => setShowAnalyzer(false)} />;
  }
  
  // Main document viewer UI
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with document title and actions */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary truncate">{document.filename}</h2>
          <div className="flex items-center space-x-2">
            {document.extractedText && (
              <button
                onClick={() => setShowAnalyzer(true)}
                className="text-primary hover:text-primary-hover p-1"
                aria-label="Analyze document"
                title="Analyze document"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-text-primary"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* View mode selector */}
        <div className="flex mb-4 border-b border-gray-700">
          <button
            className={`px-4 py-2 ${viewMode === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}
            onClick={() => setViewMode('preview')}
          >
            Preview
          </button>
          <button
            className={`px-4 py-2 ${viewMode === 'text' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'}`}
            onClick={() => setViewMode('text')}
          >
            Extracted Text
          </button>
        </div>

        {/* Document content area */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'preview' ? renderFilePreview() : renderTextContent()}
        </div>

        {/* Footer with metadata and actions */}
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Uploaded: {new Date(document.uploadedAt).toLocaleString()}
          </div>
          
          <div className="flex space-x-2">
            {documentUrl && (
              <a
                href={documentUrl}
                download={document.filename}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-1.5 px-3 rounded-md transition flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </a>
            )}
            
            <button
              onClick={() => {
                // Add document to conversation context
                if (onClose) onClose();
              }}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-medium py-1.5 px-3 rounded-md transition flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
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
