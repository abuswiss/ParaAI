import React from 'react';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';

interface InlineAIPopupProps {
  content: string | null; // The AI-generated content to display
  isLoading: boolean; // Add loading state prop
  error?: string | null; // Optional error message
  originalSelectionRange?: { from: number; to: number }; // Optional: Range to replace
  onClose: () => void;
  onReplace?: (newContent: string) => void; // Optional: Callback to replace selection
  onCopy?: (content: string) => void; // Optional: Callback to copy content
}

const InlineAIPopup: React.FC<InlineAIPopupProps> = ({
  content,
  isLoading,
  error,
  originalSelectionRange,
  onClose,
  onReplace,
  onCopy,
}) => {
  // Determine content to display based on loading/error/content state
  let displayContent: React.ReactNode;
  if (isLoading) {
    displayContent = (
      <div className="flex items-center justify-center py-4">
        <Spinner size="sm" />
        <span className="ml-2 text-text-secondary text-xs">Generating...</span>
      </div>
    );
  } else if (error) {
    displayContent = <p className="text-error text-xs">Error: {error}</p>;
  } else if (content) {
    // Basic rendering, consider markdown later
    displayContent = content;
  } else {
    return null; // Should not happen if called correctly, but good fallback
  }

  const handleReplace = () => {
    // Only allow replace if not loading, no error, and content exists
    if (onReplace && content && !isLoading && !error) {
      onReplace(content);
    }
    onClose(); // Close after action
  };

  const handleCopy = () => {
    // Only allow copy if not loading, no error, and content exists
    if (onCopy && content && !isLoading && !error) {
      onCopy(content);
    }
    // Optionally close after copy, or leave open?
    // onClose(); 
  };

  return (
    // Basic styling - positioning will be handled externally (e.g., via Tippy.js or similar)
    <div className="absolute z-20 w-80 p-3 bg-surface dark:bg-surface-darker border border-surface-lighter rounded-lg shadow-xl text-sm text-text-primary dark:text-text-primary">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-text-secondary dark:text-text-secondary">AI Result</h4>
        <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-auto text-text-tertiary hover:text-text-primary">
          <Icons.Close className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Display AI Content */}
      <div className="mb-3 max-h-48 min-h-[60px] overflow-y-auto whitespace-pre-wrap border border-surface-lighter rounded p-2 bg-background dark:bg-background flex flex-col justify-center">
        {/* Need to consider how to render markdown/html if AI returns formatted text */}
        {displayContent}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        {onCopy && (
          <Button variant="outline" size="sm" onClick={handleCopy} title="Copy result" disabled={isLoading || !!error || !content}>
            <Icons.Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
        )}
        {onReplace && originalSelectionRange && (
          <Button variant="primary" size="sm" onClick={handleReplace} title="Replace original selection">
            <Icons.Check className="h-4 w-4 mr-1" /> Replace
          </Button>
        )}
      </div>
    </div>
  );
};

export default InlineAIPopup; 