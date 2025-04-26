import React, { useState } from 'react';
import DocumentUpload from '../components/documents/DocumentUpload';
import DocumentList from '../components/documents/DocumentList';
import { Document } from '../types/document';

const Documents: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = (success: boolean) => {
    if (success) {
      setRefreshTrigger(prev => prev + 1);
      // Close the modal after a short delay to show the completed state
      setTimeout(() => {
        setShowUploadModal(false);
      }, 1500);
    }
  };

  const handleDocumentSelected = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleDocumentDeleted = () => {
    setSelectedDocument(null);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Documents</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Upload Documents</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Document List */}
        <div className="md:col-span-1 overflow-auto">
          <div className="card h-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-medium text-text-primary">Your Documents</h2>
              <p className="text-sm text-text-secondary mt-1">
                Select a document to view details
              </p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <DocumentList
                key={refreshTrigger} // Force re-render when documents change
                onSelectDocument={handleDocumentSelected}
                onDocumentDeleted={handleDocumentDeleted}
              />
            </div>
          </div>
        </div>

        {/* Document Details */}
        <div className="md:col-span-2 overflow-auto">
          <div className="card h-full overflow-hidden flex flex-col">
            {selectedDocument ? (
              <>
                <div className="p-4 border-b border-gray-800">
                  <h2 className="text-lg font-medium text-text-primary truncate">
                    {selectedDocument.filename}
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Uploaded on {new Date(selectedDocument.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {selectedDocument.extractedText ? (
                    <div className="whitespace-pre-wrap text-text-primary">
                      {selectedDocument.extractedText}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-text-secondary mb-2">
                          {selectedDocument.processingStatus === 'pending' || 
                           selectedDocument.processingStatus === 'processing' ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-text-secondary inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing document content...
                            </>
                          ) : (
                            'No text content has been extracted from this document'
                          )}
                        </p>
                        <button className="text-primary hover:underline text-sm">
                          {selectedDocument.processingStatus === 'failed' ? 
                            'Retry extraction' : 'View original document'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="rounded-full bg-gray-800 p-4 inline-block mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">No document selected</h3>
                  <p className="text-text-secondary max-w-sm">
                    Select a document from the list to view its details, or upload a new document to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-medium text-text-primary">Upload Documents</h2>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
