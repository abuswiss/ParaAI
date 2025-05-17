import React from 'react';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { CurlyBraces } from 'lucide-react'; // Assuming lucide-react has this or similar

interface VariableToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const VariableToolbarButton: React.FC<VariableToolbarButtonProps> = ({ onClick, disabled }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-1.5"
          onClick={onClick}
          disabled={disabled}
          aria-label="Mark as Variable"
        >
          <CurlyBraces className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Mark as Variable</p>
      </TooltipContent>
    </Tooltip>
  );
}; 