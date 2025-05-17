import React, { useState } from 'react';
import { Button } from '../../ui/Button'; // Adjust path as needed
import { Check, X, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils'; // Adjust path as needed

interface RewriteSuggestionBarProps {
  isVisible: boolean;
  suggestion: string;
  isLoading: boolean;
  error?: string | null;
  onAccept: () => void;
  onDecline: () => void;
  // onEditSuggestion?: () => void; // Future: Allow editing the suggestion
}

const RewriteSuggestionBar: React.FC<RewriteSuggestionBarProps> = ({
  isVisible,
  suggestion,
  isLoading,
  error,
  onAccept,
  onDecline,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!isVisible) {
    return null;
  }

  // Helper to determine if suggestion is long (more than 2 lines or 180 chars)
  const isLong = suggestion && suggestion.length > 180;

  return (
    <div 
      className={cn(
        "p-3 border-b shadow-md",
        error
          ? "bg-destructive/10 dark:bg-dark-destructive/20 border-destructive dark:border-dark-destructive"
          : "bg-primary/10 dark:bg-dark-primary/20 border-primary dark:border-dark-primary"
      )}
    >
      <div className="container mx-auto flex items-center justify-between max-w-4xl">
        <div className="flex-grow mr-4 min-w-0">
          {isLoading && (
            <div className="flex items-center text-primary">
              <Sparkles className="h-5 w-5 mr-2 animate-pulse text-primary" />
              <span>Generating rewrite suggestion...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
              <span className="font-medium">Error:</span>
              <span className="ml-1 truncate">{error}</span>
            </div>
          )}
          {!isLoading && !error && suggestion && (
            <div className="text-sm">
              <p className="font-semibold text-primary mb-0.5">AI Suggestion:</p>
              <p
                className={cn(
                  "text-foreground dark:text-dark-foreground whitespace-pre-line transition-all",
                  !expanded && isLong && "line-clamp-2"
                )}
                title={suggestion}
                style={expanded ? { maxHeight: 'none' } : {}}
              >
                {suggestion}
              </p>
              {isLong && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 px-2 py-0.5 text-xs"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </Button>
              )}
              {/* Optionally, show originalText for comparison here */}
            </div>
          )}
          {!isLoading && !error && !suggestion && (
             <div className="flex items-center text-muted-foreground">
              <Sparkles className="h-5 w-5 mr-2 text-primary" />
              <span>Rewrite suggestion will appear here.</span>
            </div>
          )}
        </div>
        {!isLoading && (
          <div className="flex-shrink-0 flex items-center space-x-2">
            <Button 
              variant="destructive"
              size="sm"
              onClick={onDecline}
              title="Decline Suggestion"
            >
              <X className="h-5 w-5" /> 
              <span className="ml-1 hidden sm:inline">Decline</span>
            </Button>
            <Button 
              variant="default"
              size="sm"
              onClick={() => {
                console.log('Accept button clicked in RewriteSuggestionBar');
                onAccept();
              }}
              disabled={!!error || !suggestion}
              className="flex items-center"
              title="Accept Suggestion"
            >
              <Check className="h-5 w-5" />
              <span className="ml-1 hidden sm:inline">Accept</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewriteSuggestionBar; 