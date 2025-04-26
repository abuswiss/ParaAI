import React, { useState } from 'react';
import DocumentUpload from '../components/documents/DocumentUpload';
import DocumentList from '../components/documents/DocumentList';
import { Document } from '../types/document';
import DraftManagement from '../components/documents/drafting/DraftManagement';
import TemplateSelector from '../components/documents/drafting/TemplateSelector';
import { DocumentTemplate } from '../services/templateService';
import { useParams } from 'react-router-dom';

const Documents: React.FC = () => {
  // Extract caseId from URL params if available
  const { caseId } = useParams<{ caseId?: string }>();
  const [activeTab, setActiveTab] = useState<'documents' | 'templates'>('documents');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
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

  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowDraftEditor(true);
  };

  const handleCloseDraftEditor = () => {
    setShowDraftEditor(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Legal Documents</h1>
        {activeTab === 'documents' ? (
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Upload Documents</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('documents')}
            className="btn-secondary flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            <span>Back to Documents</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'templates' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </div>

      {activeTab === 'documents' ? (
        <div className="flex-1 flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
          {/* Resizable Document List with Better Space Allocation */}
          <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0 overflow-auto">
            <div className="card h-full overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-text-primary">Your Documents</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Select a document to view details
                  </p>
                </div>
                <button 
                  className="text-text-secondary hover:text-primary p-1.5 rounded-md hover:bg-gray-800 transition-colors"
                  title="Toggle document list"
                  onClick={() => {
                    // This would be connected to a state variable controlling list collapse
                    // For now just a visual element
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
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

          {/* Document Details with Flexible Layout */}
          <div className="w-full md:w-3/5 lg:w-2/3 flex-grow overflow-auto">
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
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-text-primary">No Document Selected</h3>
                  <p className="text-text-secondary mt-2">
                    Select a document from the list or upload a new one to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Templates View */}
          {showDraftEditor && selectedTemplate ? (
            <div className="col-span-1 md:col-span-4 overflow-auto">
              <div className="card h-full overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-text-primary">Create Document from Template</h2>
                  <button
                    onClick={handleCloseDraftEditor}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <DraftManagement 
                    documentContext={selectedTemplate.content}
                    caseId={caseId}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Template Categories */}
              <div className="md:col-span-1 lg:col-span-1 overflow-auto">
                <div className="card h-full overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-lg font-medium text-text-primary">Template Categories</h2>
                    <p className="text-sm text-text-secondary mt-1">
                      Browse templates by category
                    </p>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {/* This will be replaced with the category filter component */}
                    <div className="space-y-2">
                      <button className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded-md">
                        All Templates
                      </button>
                      <button className="w-full text-left p-2 hover:bg-gray-800 rounded-md">
                        Contracts
                      </button>
                      <button className="w-full text-left p-2 hover:bg-gray-800 rounded-md">
                        Letters
                      </button>
                      <button className="w-full text-left p-2 hover:bg-gray-800 rounded-md">
                        Pleadings
                      </button>
                      <button className="w-full text-left p-2 hover:bg-gray-800 rounded-md">
                        Agreements
                      </button>
                      <button className="w-full text-left p-2 hover:bg-gray-800 rounded-md">
                        Memorandums
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Selector */}
              <div className="md:col-span-3 lg:col-span-3 overflow-auto">
                <div className="card h-full overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-lg font-medium text-text-primary">Document Templates</h2>
                    <p className="text-sm text-text-secondary mt-1">
                      Select a template to create a new document
                    </p>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <TemplateSelector onSelectTemplate={handleSelectTemplate} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-primary">Upload Documents</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;