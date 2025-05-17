import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '../../ui/dialog'; // Adjust path
import { Button } from '../../ui/Button'; // Adjust path
import { Textarea } from '../../ui/textarea'; // Adjust path
import { Sparkles } from 'lucide-react';

interface GeneratePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading?: boolean; // If submission itself is a longer async process outside the modal
  title?: string;
  description?: string;
}

const GeneratePromptModal: React.FC<GeneratePromptModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  title = "Ask AI to Generate Text",
  description = "Enter your instructions for the AI. It will generate text based on your prompt, selected text (if any), and surrounding context."
}) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt);
      // Optionally close modal on submit, or let the parent handle it after processing
      // onClose(); 
      // setPrompt(''); // Reset prompt if modal stays open for another go
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background dark:bg-dark-secondary">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg font-semibold text-gray-800 dark:text-gray-200">
            <Sparkles className="h-5 w-5 mr-2 text-purple-500" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="my-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'Draft an introduction for this section about contract termination.' or 'Explain this selected term in simpler language.'"
            className="min-h-[100px] focus:ring-purple-500 dark:bg-dark-input dark:text-dark-foreground dark:focus:ring-purple-400"
            disabled={isLoading}
          />
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" onClick={() => { setPrompt(''); onClose(); }} disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !prompt.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            {isLoading ? 'Generating...' : 'Generate'}
            {!isLoading && <Sparkles className="h-4 w-4 ml-2" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GeneratePromptModal; 