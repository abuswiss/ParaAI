// Placeholder: SummarizeButton.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';
import { TextSelect } from 'lucide-react'; // Or a better icon?

interface SummarizeButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const SummarizeButton: React.FC<SummarizeButtonProps> = ({ onClick, disabled }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title="Summarize selected text"
      className="h-8 w-8 p-1.5" // Match other toolbar buttons
    >
      <TextSelect className="h-4 w-4" />
    </Button>
  );
}; 