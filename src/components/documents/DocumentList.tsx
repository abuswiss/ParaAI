import React, { useState, useEffect } from 'react';
import { getUserDocuments, getDocumentUrl, deleteDocument } from '../../services/documentService';
import { Document, getFileIcon, formatFileSize } from '../../types/document';
import DocumentViewer from './DocumentViewer';

interface DocumentListProps {
  caseId?: string;
  onSelectDocument?: (document: Document) => void;
  onDocumentDeleted?: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  caseId,
  onSelectDocument,
  onDocumentDeleted
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [caseId]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await getUserDocuments(caseId);
      
      if (error) {
        throw error;
      }
      
      setDocuments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = (doc: Document) => {
    setSelectedDocId(doc.id);
    setViewingDocument(doc.id);
    if (onSelectDocument) {
      onSelectDocument(doc);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data: url, error } = await getDocumentUrl(doc.storagePath);
      
      if (error) {
        throw error;
      }
      
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      // Could show a toast notification here
    }
    
    setShowActionMenu(null);
  };

  const handleDelete = async (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        const { success, error } = await deleteDocument(docId);
        
        if (error) {
          throw error;
        }
        
        if (success) {
          // Remove from local state
          setDocuments(docs => docs.filter(d => d.id !== docId));
          
          if (onDocumentDeleted) {
            onDocumentDeleted();
          }
        }
      } catch (err) {
        console.error('Error deleting document:', err);
        // Could show a toast notification here
      }
    }
    
    setShowActionMenu(null);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'processing': return 'text-blue-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="h-3 w-3 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="h-3 w-3 mr-1 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg className="h-3 w-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-3 w-3 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderFileIcon = (contentType: string) => {
    const iconType = getFileIcon(contentType);
    
    return (
      <div className="rounded bg-gray-700 p-2 flex items-center justify-center">
        {iconType === 'pdf' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'word' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'text' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'image' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        )}
        {(iconType === 'generic' || !['pdf', 'word', 'text', 'image'].includes(iconType)) && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="flex-1 p-4">
          <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">
            {error}
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center p-4 text-text-secondary text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <h3 className="font-medium text-lg mb-2">No documents yet</h3>
          <p className="text-gray-400 max-w-md">
            Start uploading documents to analyze and manage them within your cases.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`bg-gray-800 rounded-lg overflow-hidden ${selectedDocId === doc.id ? 'ring-2 ring-primary' : ''}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-700 flex items-start"
                  onClick={() => handleDocumentClick(doc)}
                >
                  <div className="mr-3 mt-1">
                    {renderFileIcon(doc.contentType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-md font-medium text-text-primary truncate">{doc.filename}</h3>
                    <div className="flex items-center text-xs text-gray-400 mt-1">
                      <span className="inline-block">{formatFileSize(doc.size)}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      {doc.processingStatus && (
                        <>
                          <span className="mx-2">•</span>
                          <span className={`inline-flex items-center text-xs font-medium ${getStatusColor(doc.processingStatus)}`}>
                            {getStatusIcon(doc.processingStatus)} {getStatusLabel(doc.processingStatus)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActionMenu(showActionMenu === doc.id ? null : doc.id);
                      }}
                      className="text-gray-400 hover:text-text-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </button>

                    {showActionMenu === doc.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(doc);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-gray-600 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Download
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingDocument(doc.id);
                              setShowActionMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-gray-600 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(doc.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-600 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Document Viewer Modal */}
      {viewingDocument && (
        <DocumentViewer 
          documentId={viewingDocument}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </div>
  );
};

export default DocumentList;
