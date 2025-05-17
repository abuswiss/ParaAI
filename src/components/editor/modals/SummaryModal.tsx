import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../ui/dialog'; // Adjust path as needed
import { Button } from '../../ui/Button'; // Adjust path as needed
import { ScrollArea } from '@/components/ui/scroll-area'; // Adjust path as needed
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAtom, useAtomValue } from 'jotai';
import { summaryModalOpenAtom, summaryResultAtom } from '@/atoms/summary';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string;
  title?: string;
  isLoading?: boolean;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  summaryText,
  title = "Generated Summary",
  isLoading = false 
}) => {
  if (!isOpen) return null;

  const handleCopyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Summary copied to clipboard!');
    } else {
      toast.error('No summary text to copy.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-background dark:bg-dark-secondary">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] my-4 p-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="ml-3 text-muted-foreground">Generating summary...</p>
            </div>
          ) : summaryText ? (
            <div 
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-3 border rounded-md bg-secondary dark:bg-dark-secondary"
              dangerouslySetInnerHTML={{ __html: summaryText }} // Assuming summary can contain basic HTML like <strong>
            />
          ) : (
            <p className="text-muted-foreground text-center py-4">No summary available or an error occurred.</p>
          )}
        </ScrollArea>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button 
            variant="outline" 
            onClick={handleCopyToClipboard} 
            disabled={isLoading || !summaryText}
            className="flex items-center"
          >
            <Copy className="h-4 w-4 mr-2" /> Copy Summary
          </Button>
          <DialogClose asChild>
            <Button variant="default" onClick={onClose}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryModal; 