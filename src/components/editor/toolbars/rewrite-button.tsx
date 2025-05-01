// Placeholder: RewriteButton.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';
import { PilcrowSquare } from 'lucide-react'; // Or RefreshCcw?

interface RewriteButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const RewriteButton: React.FC<RewriteButtonProps> = ({ onClick, disabled }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title="Rewrite selected text"
      className="h-8 w-8 p-1.5" // Match other toolbar buttons
    >
      <PilcrowSquare className="h-4 w-4" />
    </Button>
  );
}; 