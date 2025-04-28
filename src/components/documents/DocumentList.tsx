import React, { useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { 
  activeCaseIdAtom, 
  activeEditorItemAtom, 
  ActiveEditorItem
} from '@/atoms/appAtoms';
import * as documentService from '@/services/documentService';
import { Document, getFileIcon } from '@/types/document';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';

const DocumentList: React.FC = () => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const activeEditorItem = useAtomValue(activeEditorItemAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCaseId) {
      setDocuments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: fetchedDocuments, error: fetchError } = await documentService.getUserDocuments(activeCaseId);
         if (fetchError) throw fetchError;
        setDocuments(fetchedDocuments || []);
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [activeCaseId]);

  const handleSelectDocument = (docId: string) => {
    setActiveEditorItem({ type: 'document', id: docId });
  };

  const renderFileIcon = (filename: string) => {
    try {
      const IconComponent = getFileIcon(filename);
      return <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />;
    } catch (e) {
      return <Icons.File className="w-4 h-4 mr-2 flex-shrink-0 text-text-tertiary" />;
    }
  };

  return (
    <div className="document-list-container mt-4 flex-1 overflow-y-auto">
      <h3 className="text-sm font-semibold text-neutral-600 dark:text-text-secondary mb-2 sticky top-0 bg-white dark:bg-surface py-1">Case Documents</h3>
      {isLoading && (
         <div className="flex items-center justify-center py-4">
            <Spinner size="small" />
            <span className="ml-2 text-xs text-neutral-500 dark:text-text-secondary">Loading...</span>
          </div>
      )}
      {error && <p className="text-xs text-error dark:text-error px-2">Error: {error}</p>}
      {!isLoading && !error && documents.length === 0 && (
        <p className="text-xs text-neutral-500 dark:text-text-secondary px-2 italic">
          {activeCaseId ? 'No documents found for this case.' : 'Select a case to view documents.'}
        </p>
      )}
      {!isLoading && !error && documents.length > 0 && (
        <ul className="space-y-1">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => handleSelectDocument(doc.id)}
                className={`w-full flex items-center px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                  (activeEditorItem?.type === 'document' && activeEditorItem?.id === doc.id)
                    ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary'
                    : 'text-neutral-700 dark:text-text-secondary hover:bg-neutral-100 dark:hover:bg-surface-lighter'
                }`}
              >
                {renderFileIcon(doc.filename || 'unknown')}
                <span className="truncate flex-1" title={doc.filename || 'Untitled Document'}>
                  {doc.filename || 'Untitled Document'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentList;
