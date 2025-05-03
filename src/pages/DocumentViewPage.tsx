import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocumentById, getDocumentUrl, DocumentMetadata } from '@/services/documentService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Edit, Download } from 'lucide-react';
import { toast } from 'sonner';
import DocumentViewer from '@/components/documents/DocumentViewer';
// Placeholder import for BreadcrumbNav
// import BreadcrumbNav from '@/components/layout/BreadcrumbNav';
import BreadcrumbNav, { BreadcrumbItem } from '@/components/layout/BreadcrumbNav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSetAtom } from 'jotai';
import { chatDocumentContextIdsAtom } from '@/atoms/appAtoms';

const DocumentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const setChatDocumentContextIds = useSetAtom(chatDocumentContextIdsAtom);

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
        setDocument(null);

        const { data: docData, error: docError } = await getDocumentById(id);
        if (docError) throw docError;
        if (!docData) throw new Error('Document not found');
        setDocument(docData);

      } catch (err) {
        console.error('Error loading document metadata:', err);
        const message = err instanceof Error ? err.message : 'Failed to load document details.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentData();
  }, [id]);

  useEffect(() => {
    if (id) {
      console.log(`DocumentViewPage: Setting document ${id} in chat context.`);
      setChatDocumentContextIds(prev => [...new Set([...prev, id])]);
    }
  }, [id, setChatDocumentContextIds]);

  const handleEditClick = () => {
    if (id) {
      console.log(`DocumentViewPage: Setting document ${id} in chat context before navigating to edit.`);
      setChatDocumentContextIds(prev => [...new Set([...prev, id])]);
      navigate(`/edit/document/${id}`);
    }
  };

  const handleDownload = async () => {
    if (!document?.storagePath) {
        toast.error("Document path not available for download.");
        return;
    }

    setIsDownloading(true);
    try {
        console.log(`Fetching download URL for: ${document.storagePath}`);
        const { data: url, error: urlError } = await getDocumentUrl(document.storagePath);

        if (urlError || !url) {
            console.error("Failed to get download URL:", urlError);
            throw new Error(urlError?.message || "Could not retrieve download link.");
        }

        console.log("Obtained download URL.");
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.filename || 'download';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        console.log("Download triggered.");
        
    } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred during download.";
        console.error("Download error:", err);
        toast.error(`Download failed: ${message}`);
    } finally {
        setIsDownloading(false);
    }
  };

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
          <Button 
             onClick={handleDownload} 
             size="sm" 
             variant="outline" 
             disabled={loading || !!error || !document || !document.storagePath || isDownloading}
           >
            {isDownloading ? (
              <Spinner size="xs" className="mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>
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
            <Alert variant="destructive" className="w-auto">
              <AlertTitle>Loading Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : document?.id ? (
          <DocumentViewer documentId={document.id} />
        ) : (
          <div className="flex justify-center items-center h-full text-center p-4">
            <Alert variant="default">
              <AlertTitle>No Document</AlertTitle>
              <AlertDescription>Document data could not be loaded.</AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewPage; 