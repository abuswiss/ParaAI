import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocumentById, getDocumentUrl, DocumentMetadata } from '@/services/documentService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Edit } from 'lucide-react';
import DocumentViewer from '@/components/documents/DocumentViewer';
// Placeholder import for BreadcrumbNav
// import BreadcrumbNav from '@/components/layout/BreadcrumbNav';
import BreadcrumbNav, { BreadcrumbItem } from '@/components/layout/BreadcrumbNav';

const DocumentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No document ID provided.');
      setLoading(false);
      return;
    }

    const fetchDocumentData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch metadata first
        const { data: docData, error: docError } = await getDocumentById(id);
        if (docError) throw docError;
        if (!docData) throw new Error('Document not found');
        setDocument(docData);

        // Fetch URL if storage path exists (needed for preview rendering)
        if (docData.storagePath) {
          const { data: urlData, error: urlError } = await getDocumentUrl(docData.storagePath);
          if (urlError) {
            console.warn("Could not fetch document URL:", urlError); 
            // Non-fatal, maybe preview won't work
            setDocumentUrl(null);
          } else {
            setDocumentUrl(urlData);
          }
        } else {
          setDocumentUrl(null); // Ensure URL is null if no storage path
        }

      } catch (err) {
        console.error('Error loading document for viewing:', err);
        setError('Failed to load document.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentData();
  }, [id]);

  const handleEditClick = () => {
    if (id) {
      navigate(`/edit/document/${id}`);
    }
  };

  const renderContentView = () => {
    if (!document) return null; // Should be handled by loading/error states

    const contentType = document.contentType || '';

    // Priority 1: Render extracted text if available
    if (document.extractedText) {
      return (
        <div className="p-4 h-full overflow-y-auto">
           <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {document.extractedText}
           </div>
        </div>
      );
    }
    
    // Priority 2: Render preview from URL if available
    if (documentUrl) {
       if (contentType.startsWith('image/')) {
        return (
           <div className="w-full h-full flex justify-center items-center p-4">
             <img 
               src={documentUrl} 
               alt={document.filename} 
               className="max-w-full max-h-full object-contain"
             />
           </div>
        );
      } else if (contentType === 'application/pdf') {
        return (
            <iframe 
              src={documentUrl} 
              className="w-full h-full border-none" 
              title={document.filename}
            />
        );
      } else if (contentType.startsWith('text/') || contentType === 'application/json') {
         // Fallback for text types if no extractedText but URL exists (less common)
         return (
            <iframe 
              src={documentUrl} 
              className="w-full h-full border-none bg-white" 
              title={document.filename}
            />
        );
      }
       // Fallback for other types with a URL - Offer download
       return (
         <div className="text-center p-8 flex flex-col justify-center items-center h-full">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
           </svg>
           <p className="text-text-secondary mb-4">Preview not available for this file type ({contentType})</p>
           <a href={documentUrl} download={document.filename} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                 {/* Placeholder Download Icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Download File
              </Button>
            </a>
         </div>
       );
    }

    // Priority 3: No extracted text and no preview URL
    return (
        <div className="text-center p-8 flex flex-col justify-center items-center h-full">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
           <p className="p-4 text-neutral-500">Preview not available and no extracted text found for this document.</p>
           {/* Optionally add a button to trigger extraction if applicable */} 
        </div>
    );
  }

  // Generate breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = document
    ? [
        { name: 'Documents', path: '/documents' },
        { name: document.filename }, // Current item, no path
      ]
    : [{ name: 'Documents' }]; // Default if document hasn't loaded

  // Main render
  return (
    <div className="h-full flex flex-col bg-white dark:bg-surface-darker overflow-hidden">
      {/* Header Area */}
      <div className="flex-shrink-0 flex justify-between items-center p-3 border-b border-neutral-200 dark:border-gray-700">
        {/* Breadcrumb Placeholder */} 
        <div>
          <BreadcrumbNav items={breadcrumbItems} />
          {/* <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {loading ? 'Loading...' : document ? `Documents / ${document.filename}` : 'Document Viewer'}
          </span> */}
        </div>
        {/* Action Buttons */} 
        <div className="flex items-center gap-2">
          <Button onClick={handleEditClick} size="sm" variant="outline" disabled={loading || !!error || !document}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {/* Add other actions like Download, Share, etc. if needed */} 
          {/* Example Download using fetched URL */} 
          {documentUrl && document && (
            <a href={documentUrl} download={document.filename} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                 {/* Placeholder Download Icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Download
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full text-center p-4">
            <p className="text-error dark:text-error">{error}</p>
          </div>
        ) : (
          <DocumentViewer documentId={document.id} />
        )}
      </div>
    </div>
  );
};

export default DocumentViewPage; 