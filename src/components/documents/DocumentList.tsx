import React from 'react';
import { useSetAtom } from 'jotai';
import {
  activeEditorItemAtom,
} from '@/atoms/appAtoms';
import { Document, getFileIcon } from '@/types/document';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';

interface DocumentListProps {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  isLoading,
  error,
  activeDocumentId,
  onSelectDocument,
}) => {
  const activeEditorItem = { type: 'document', id: activeDocumentId };
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);

  const handleSelectDocument = (docId: string) => {
    onSelectDocument(docId);
  };

  const renderFileIcon = (filename: string) => {
    try {
      const IconComponent = getFileIcon(filename || 'unknown');
      return <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />;
    } catch (e) {
      return <Icons.File className="w-4 h-4 mr-2 flex-shrink-0 text-text-tertiary" />;
    }
  };

  return (
    <div className="document-list-container flex-1 overflow-y-auto pt-1">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Spinner size="small" />
          <span className="ml-2 text-xs text-neutral-500 dark:text-text-secondary">Loading...</span>
        </div>
      )}
      {error && <p className="text-xs text-error dark:text-error px-2">Error: {error}</p>}
      {!isLoading && !error && documents.length === 0 && (
        <p className="text-xs text-neutral-500 dark:text-text-secondary px-2 italic">
          No documents found.
        </p>
      )}
      {!isLoading && !error && documents.length > 0 && (
        <ul className="space-y-1 px-1">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => handleSelectDocument(doc.id)}
                className={`w-full flex items-center px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                  (activeDocumentId === doc.id)
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
