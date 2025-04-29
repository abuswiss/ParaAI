import React, { useState, useEffect } from 'react';
import { getDocumentById, getDocumentUrl, processDocument } from '../../services/documentService';
import { Document as DocumentType } from '../../types/document';
import DocumentAnalyzer from './DocumentAnalyzer';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Edit } from 'lucide-react';

interface DocumentViewerProps {
  documentId: string;
  onClose?: () => void;
  onEdit?: (docId: string) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose, onEdit }) => {
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

        // Determine initial view mode based on content type
        if (data.contentType?.startsWith('text/') || 
            data.contentType === 'application/json' || 
            data.extractedText) { // Prefer text view if already extracted
             setViewMode('text');
        } else {
            setViewMode('preview');
        }

        // Get download URL only if needed for preview
        if (data.storagePath && viewMode === 'preview') { 
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
    // Reset analyzer when document changes
    setShowAnalyzer(false);
  }, [documentId]); // Removed viewMode dependency to avoid re-fetching url on toggle

  // Fetch URL specifically when switching TO preview mode if not already fetched
  useEffect(() => {
    if (viewMode === 'preview' && !documentUrl && document?.storagePath && !loading) {
        const fetchUrlForPreview = async () => {
            try {
                 const urlResponse = await getDocumentUrl(document.storagePath!);
                 if (urlResponse.error) throw urlResponse.error;
                 setDocumentUrl(urlResponse.data);
            } catch (err) {
                 console.error('Error fetching document URL for preview:', err);
                 setError('Failed to load document preview URL.');
            }
        };
        fetchUrlForPreview();
    }
  }, [viewMode, documentUrl, document, loading]);

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
      setViewMode('text'); // Switch to text view after processing
    } catch (err) {
      console.error('Error processing document:', err);
      setError('Failed to extract text from document. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const renderFilePreview = () => {
    if (!document || !documentUrl) return (
        <div className="flex justify-center items-center h-full">
            <Spinner />
            <span className="ml-2 text-text-secondary">Loading preview...</span>
        </div>
    );
    
    const fileType = document.contentType;
    
    if (fileType.includes('pdf')) {
      return (
        <iframe 
          src={documentUrl} 
          className="w-full h-full rounded-b-lg border-t border-gray-600" // Adjusted for header
          title={document.filename}
        />
      );
    } else if (fileType.includes('image')) {
      return (
         <div className="w-full h-full flex justify-center items-center p-4">
             <img 
               src={documentUrl} 
               alt={document.filename} 
               className="max-w-full max-h-full object-contain"
             />
         </div>
      );
    } else if (fileType.includes('text') || fileType.includes('application/json')) {
      // This might be redundant if text view is preferred, but keep as fallback
      return (
        <iframe 
          src={documentUrl} 
          className="w-full h-full rounded-b-lg border-t border-gray-600 bg-white" // Adjusted
          title={document.filename}
        />
      );
    } else {
      return (
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-text-secondary mb-4">Preview not available for this file type ({fileType})</p>
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
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
          <p className="text-text-secondary mb-4">No extracted text available.</p>
          <Button
            onClick={handleProcessDocument}
            disabled={processing}
            variant="primary"
            size="sm"
          >
            {processing ? (
              <>
                <Spinner size="xs" className="mr-2" />
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 100-2h5a1 1 0 011 1v5a1 1 0 100-2v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Extract Text
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="p-4 h-full overflow-y-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap text-sm font-mono p-4 bg-neutral-100 dark:bg-gray-800 rounded-md">
              {document.extractedText}
          </pre>
        </div>
          
          {/* Text analysis actions - keep as is */}
          <div className="mt-6 border-t border-neutral-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-medium text-neutral-800 dark:text-text-primary mb-2">Document Analysis Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* Comprehensive Analysis */}
              <Button 
                 variant="outline"
                 size="sm"
                 onClick={() => setShowAnalyzer(true)}
                 className="justify-start"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                 </svg>
                 Analyze Document
              </Button>
              {/* Quick Summary */}
               <Button 
                 variant="outline"
                 size="sm"
                 onClick={() => { /* TODO: Trigger quick summary */ console.log("Quick Summary Clicked"); }}
                 className="justify-start"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                 </svg>
                 Quick Summary
               </Button>
               {/* Add more actions like 'Identify Risks' if needed */}
            </div>
          </div>
        </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-center p-4">
        <p className="text-error dark:text-error mb-4">{error}</p>
        {/* Optional: Add a retry button */}
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-text-secondary">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="document-viewer h-full flex flex-col bg-white dark:bg-surface-darker text-neutral-900 dark:text-text-primary">
        {/* Header Bar */} 
        <div className="flex justify-between items-center p-3 border-b border-neutral-200 dark:border-gray-700 flex-shrink-0">
           <div className="flex items-center min-w-0">
             <h2 className="text-base font-semibold truncate mr-4" title={document.filename}>
               {document.filename}
             </h2>
             {/* View Mode Toggle */} 
             <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
                 <Button 
                     variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                     size="xs"
                     onClick={() => setViewMode('preview')}
                     className="p-1 rounded-r-none border-r border-gray-300 dark:border-gray-600"
                     title="Preview Mode"
                     disabled={!document.storagePath} // Disable if no file to preview
                 >
                     {/* Placeholder for Eye icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                 </Button>
                 <Button 
                     variant={viewMode === 'text' ? 'secondary' : 'ghost'}
                     size="xs"
                     onClick={() => setViewMode('text')}
                     className="p-1 rounded-l-none"
                     title="Text Mode"
                     disabled={!document.extractedText && !document.storagePath} // Disable if no text and no way to extract
                 >
                    {/* Placeholder for FileText icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </Button>
             </div>
           </div>
           
           {/* Action Buttons */} 
           <div className="flex items-center gap-2">
              {/* Add Edit Button */}
              {onEdit && (
                  <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(documentId)}
                      title="Edit Document"
                  >
                      <Edit className="h-4 w-4" />
                  </Button>
              )}
              {/* Add Download Button if URL exists */}
              {documentUrl && (
                  <a 
                    href={documentUrl} 
                    download={document.filename} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                      <Button variant="outline" size="sm" title="Download Document">
                           {/* Placeholder for Download icon */} 
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </Button>
                  </a>
              )}
              {/* Close Button if handler provided */}
              {onClose && (
                   <Button variant="ghost" size="icon" onClick={onClose} title="Close Viewer">
                       {/* Placeholder for X icon */} 
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </Button>
              )}
           </div>
        </div>

        {/* Main Content Area */} 
        <div className="flex-grow overflow-auto">
           {viewMode === 'preview' ? renderFilePreview() : renderTextContent()}
        </div>

      {/* Analyzer Modal/Drawer */} 
      {showAnalyzer && document?.extractedText && (
        <DocumentAnalyzer 
          documentText={document.extractedText} 
          isOpen={showAnalyzer} 
          onClose={() => setShowAnalyzer(false)} 
        />
      )}
    </div>
  );
};

export default DocumentViewer;
