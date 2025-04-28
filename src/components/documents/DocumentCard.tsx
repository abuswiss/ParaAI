import React from 'react';
import { Document, getFileIcon } from '@/types/document';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/Icons'; // Assuming Icons includes common file types or a default

interface DocumentCardProps {
  document: Document;
  isSelected: boolean;
  onSelect: (docId: string) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document, isSelected, onSelect }) => {
  const IconComponent = getFileIcon(document.filename || 'unknown');

  return (
    <button
      onClick={() => onSelect(document.id)}
      className={cn(
        'group relative flex flex-col justify-between w-full p-3 rounded-lg border transition-colors duration-150 ease-in-out overflow-hidden text-left h-32', // Fixed height for consistency
        'bg-surface hover:bg-surface-hover',
        isSelected 
          ? 'border-primary ring-1 ring-primary' 
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
      )}
      title={document.filename || 'Untitled Document'}
    >
      {/* Top section: Icon */}
      <div className="flex-shrink-0">
        <IconComponent 
          className={cn(
            "h-6 w-6",
            isSelected ? "text-primary" : "text-text-secondary group-hover:text-text-primary"
          )} 
        />
      </div>

      {/* Bottom section: Text */}
      <div className="mt-2 flex flex-col justify-end flex-grow min-h-0">
        <h3 
          className={cn(
            "text-sm font-medium truncate",
            isSelected ? "text-primary" : "text-text-primary group-hover:text-text-primary"
          )}
        >
          {document.filename || 'Untitled Document'}
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          {document.uploadedAt 
            ? `Uploaded: ${new Date(document.uploadedAt).toLocaleDateString()}` 
            : 'Date unknown'}
        </p>
      </div>
    </button>
  );
};

export default DocumentCard; 