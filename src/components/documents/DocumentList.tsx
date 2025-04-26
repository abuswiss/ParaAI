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
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdf' | 'word'>('all');

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
    }
  };

  const handleDelete = async (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        const { success, error } = await deleteDocument(docId);
        
        if (error) {
          throw error;
        }
        
        if (success) {
          setDocuments(docs => docs.filter(d => d.id !== docId));
          
          if (onDocumentDeleted) {
            onDocumentDeleted();
          }
        }
      } catch (err) {
        console.error('Error deleting document:', err);
      }
    }
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
          <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
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
      <div className={`rounded-lg p-2 flex items-center justify-center ${selectedDocId === null ? 'bg-gray-800' : 'bg-gray-700'}`}>
        {iconType === 'pdf' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'word' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'text' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
        {iconType === 'image' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        )}
        {(iconType === 'generic' || !['pdf', 'word', 'text', 'image'].includes(iconType)) && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  };

  const truncateFilename = (filename: string, maxLength = 20) => {
    if (!filename) return 'Untitled';
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    
    if (name.length <= maxLength - 3 - (extension?.length || 0)) {
      return filename;
    }
    
    return `${name.substring(0, maxLength - 3 - (extension?.length || 0))}...${extension ? `.${extension}` : ''}`;
  };

  // Filter documents based on search query and active filter
  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) {
      if (activeFilter === 'pdf') {
        return doc.contentType && doc.contentType.includes('pdf');
      } else if (activeFilter === 'word') {
        return doc.contentType && (doc.contentType.includes('word') || doc.contentType.includes('officedocument'));
      }
      return true;
    }
    // Apply search query as well
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'pdf') {
      return matchesSearch && doc.contentType && doc.contentType.includes('pdf');
    } else if (activeFilter === 'word') {
      return matchesSearch && doc.contentType && (doc.contentType.includes('word') || doc.contentType.includes('officedocument'));
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900 rounded-lg">
      {/* AI Analysis Button Entry Point */}
      <div className="p-4 pb-2 flex justify-center">
        <button
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white shadow-lg bg-gradient-to-r from-primary via-pink-500 to-yellow-400 hover:from-pink-500 hover:to-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          onClick={() => {
            if (selectedDocId) {
              setViewingDocument(selectedDocId);
            } else {
              alert('Please select a document to analyze with AI.');
            }
          }}
          title="Run AI-powered analysis on your document"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <span>AI Analysis</span>
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search documents..."
            className="w-full bg-gray-800 text-sm border border-gray-700 rounded-md pl-10 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex mt-2 space-x-1 overflow-x-auto py-1">
          <button
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap font-medium ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            onClick={() => setActiveFilter('all')}
          >
            All Files
          </button>
          <button
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap font-medium ${activeFilter === 'pdf' ? 'bg-primary text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            onClick={() => setActiveFilter('pdf')}
          >
            PDFs
          </button>
          <button
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap font-medium ${activeFilter === 'word' ? 'bg-primary text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            onClick={() => setActiveFilter('word')}
          >
            Word Docs
          </button>
          <button
            className="px-2.5 py-1 text-xs rounded-md whitespace-nowrap font-medium bg-gray-900 text-gray-600 cursor-not-allowed opacity-60"
            disabled
            title="Recent filter is currently disabled"
          >
            Recent
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4">
          <div className="text-red-500 bg-red-900/20 p-4 rounded-md">
            {error}
          </div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center p-4 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500 mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No Documents Found</h3>
          <p className="text-gray-400 max-w-md">
            {searchQuery 
              ? 'No documents match your search. Try different keywords or clear your search.'
              : caseId 
                ? 'There are no documents associated with this case yet. Upload documents to get started.' 
                : 'You haven\'t uploaded any documents yet. Upload your first document to get started.'
            }
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${selectedDocId === doc.id ? 'bg-gray-800' : ''}`}
            >
              <div 
                className="p-3 flex items-center group cursor-pointer"
                onClick={() => handleDocumentClick(doc)}
              >
                <div className="mr-3 flex-shrink-0">
                  {renderFileIcon(doc.contentType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <p className="text-white font-medium truncate mr-1">
                      {truncateFilename(doc.filename, 20)}
                    </p>
                    {doc.processingStatus === 'completed' && (
                      <span className="bg-green-900/30 text-green-400 text-xs px-1.5 py-0.5 rounded-sm">Processed</span>
                    )}
                    {doc.processingStatus === 'processing' && (
                      <span className="bg-blue-900/30 text-blue-400 text-xs px-1.5 py-0.5 rounded-sm flex items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse mr-1"></span>
                        Processing
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs flex items-center space-x-2 mt-0.5">
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    {typeof doc.size === 'number' ? <span>• {formatFileSize(doc.size)}</span> : ''}
                    {doc.contentType && <span className="text-gray-500">• {doc.contentType.split('/')[1]?.toUpperCase()}</span>}
                  </p>
                </div>
                <div className="ml-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex bg-gray-900 bg-opacity-70 rounded-md p-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
                      className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      title="Download"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDocument(doc.id);
                      }}
                      className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      title="View"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-700 transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
