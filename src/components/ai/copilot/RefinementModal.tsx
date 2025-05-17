import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Loader2 } from 'lucide-react';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  onSubmit: (refinementCommand: string) => Promise<void>; // onSubmit now returns a Promise
  title?: string;
  description?: string;
}

const RefinementModal: React.FC<RefinementModalProps> = ({
  isOpen,
  onClose,
  originalText,
  onSubmit,
  title = "Refine AI Output",
  description = "Enter your instructions below to refine the selected text. For example: \"Make this more formal\", \"Shorten this by half\", \"Rephrase as a question\"."
}) => {
  const [refinementCommand, setRefinementCommand] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const handleSubmit = async () => {
    if (!refinementCommand.trim()) return;
    setIsRefining(true);
    try {
      await onSubmit(refinementCommand);
      setRefinementCommand(''); // Clear command on successful submit
      // onClose(); // Keep modal open, let parent decide if/when to close based on successful refinement
    } catch (error) {
      // Error handling can be enhanced here if needed, or handled by the caller
      console.error("Refinement submission failed:", error);
    } finally {
      setIsRefining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px] dark:bg-slate-800">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label htmlFor="original-text" className="text-sm font-medium text-muted-foreground">
              Original Text (for reference)
            </Label>
            <Textarea
              id="original-text"
              value={originalText}
              readOnly
              rows={4}
              className="mt-1 resize-none bg-muted/50 dark:bg-slate-700/30 dark:text-slate-400"
            />
          </div>
          <div>
            <Label htmlFor="refinement-command" className="text-base font-semibold">
              Refinement Instructions
            </Label>
            <Textarea
              id="refinement-command"
              value={refinementCommand}
              onChange={(e) => setRefinementCommand(e.target.value)}
              placeholder="e.g., Make this more concise..."
              rows={3}
              className="mt-1 resize-none dark:bg-slate-700/50 dark:text-gray-100 dark:border-slate-600 focus:ring-primary"
              disabled={isRefining}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRefining} className="dark:hover:bg-slate-700">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!refinementCommand.trim() || isRefining}>
            {isRefining ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refining...</>
            ) : (
              <>Apply Refinement</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefinementModal; 