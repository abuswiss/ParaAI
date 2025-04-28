import React, { useState, useEffect, useCallback } from 'react';
import { Document } from '../../types/document';
import { getUserDocuments } from '../../services/documentService';
import { addDocumentToCase } from '../../services/caseService';
import { createBlankDraft } from '../../services/templateService';
import { DocumentDraft } from '@/services/templateService';
import { useNavigate } from 'react-router-dom';

interface CaseDocumentsProps {
  caseId: string;
  onDocumentAdded?: () => void;
}

const CaseDocuments: React.FC<CaseDocumentsProps> = ({ caseId, onDocumentAdded }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSelectingDocument, setIsSelectingDocument] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [addingDocument, setAddingDocument] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const navigate = useNavigate();

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch case documents
      const caseDocsResponse = await getUserDocuments(caseId);
      if (caseDocsResponse.error) {
        throw caseDocsResponse.error;
      }
      
      setDocuments(caseDocsResponse.data || []);
      
      // Fetch all user documents to show what can be added
      const allDocsResponse = await getUserDocuments();
      if (allDocsResponse.error) {
        throw allDocsResponse.error;
      }
      
      // Filter out documents already in the case
      const caseDocIds = (caseDocsResponse.data || []).map(doc => doc.id);
      const available = (allDocsResponse.data || []).filter(
        doc => !caseDocIds.includes(doc.id)
      );
      
      setAvailableDocuments(available);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleAddDocument = async () => {
    if (!selectedDocId) return;
    
    try {
      setAddingDocument(true);
      const { error } = await addDocumentToCase(selectedDocId, caseId);
      
      if (error) {
        throw error;
      }
      
      // Refresh documents list
      await fetchDocuments();
      
      // Reset selection
      setIsSelectingDocument(false);
      setSelectedDocId(null);
      
      if (onDocumentAdded) {
        onDocumentAdded();
      }
    } catch (err) {
      console.error('Error adding document to case:', err);
      setError('Failed to add document to case. Please try again.');
    } finally {
      setAddingDocument(false);
    }
  };

  const handleCreateBlankDraft = async () => {
    try {
      setCreatingDraft(true);
      setError(null);
      const { data: newDraft, error: createError } = await createBlankDraft(caseId);

      if (createError || !newDraft) {
        console.error('Error creating blank draft:', createError);
        setError('Failed to create blank draft. Please try again.');
        throw createError || new Error('Failed to create blank draft: No data returned');
      }

      console.log('Blank draft created successfully:', newDraft.id);
      navigate(`/documents/drafts/${newDraft.id}`);

    } catch (err) {
      console.error('Exception in handleCreateBlankDraft:', err);
    } finally {
      setCreatingDraft(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Case Documents</h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleCreateBlankDraft}
            className="bg-secondary hover:bg-secondary-hover text-white text-sm font-medium py-1.5 px-3 rounded-md transition flex items-center"
            disabled={creatingDraft}
          >
            {creatingDraft ? (
              <>
                <svg className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                New Blank Document
              </>
            )}
          </button>
          <button 
            onClick={() => setIsSelectingDocument(true)}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-medium py-1.5 px-3 rounded-md transition flex items-center"
            disabled={isSelectingDocument || availableDocuments.length === 0 || creatingDraft}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Existing Document
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">
          {error}
        </div>
      ) : isSelectingDocument ? (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-text-primary">Select a document to add</h3>
            <button 
              onClick={() => setIsSelectingDocument(false)}
              className="text-gray-400 hover:text-text-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {availableDocuments.length === 0 ? (
            <p className="text-text-secondary text-center py-4">No additional documents available to add</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto mb-4">
                {availableDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className={`flex items-center p-3 mb-2 rounded-md cursor-pointer ${
                      selectedDocId === doc.id ? 'bg-primary bg-opacity-20 border border-primary' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={() => setSelectedDocId(doc.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-md text-text-primary truncate">{doc.filename}</h4>
                      <p className="text-sm text-gray-400">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsSelectingDocument(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDocument}
                  disabled={!selectedDocId || addingDocument || creatingDraft}
                  className={`bg-primary hover:bg-primary-hover text-white font-medium py-2 px-4 rounded-md transition flex items-center ${
                    !selectedDocId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {addingDocument ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : 'Add Selected Document'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-text-secondary mb-2">No documents associated with this case yet.</p>
          <p className="text-sm text-gray-400">Create a blank document or add existing ones to this case.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-700 rounded-lg p-4 flex items-center hover:bg-gray-600 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-md font-medium text-text-primary truncate">{doc.filename}</h3>
                <p className="text-sm text-gray-400">
                  Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseDocuments;
