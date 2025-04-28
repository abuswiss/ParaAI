import React from 'react';
import { Document } from '@/types/document';
import DocumentCard from './DocumentCard';
import { Spinner } from '@/components/ui/Spinner';

interface DocumentGridProps {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
}

const DocumentGrid: React.FC<DocumentGridProps> = ({
  documents,
  isLoading,
  error,
  activeDocumentId,
  onSelectDocument,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="large" />
        <span className="ml-3 text-text-secondary">Loading documents...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-error dark:text-error p-4">Error: {error}</p>;
  }

  if (documents.length === 0) {
    return (
      <p className="text-text-secondary p-4 italic">
        No documents to display in grid view.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 overflow-y-auto">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          isSelected={activeDocumentId === doc.id}
          onSelect={onSelectDocument}
        />
      ))}
    </div>
  );
};

export default DocumentGrid; 