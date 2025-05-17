import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

// Source info interface
export interface SourceInfo {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
}

interface LegalSourcesDisplayProps {
  sources: SourceInfo[];
}

/**
 * Component to display legal research sources referenced by Claude
 */
const LegalSourcesDisplay: React.FC<LegalSourcesDisplayProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-border dark:border-dark-border">
      <h4 className="text-sm font-medium mb-2 flex items-center text-card-foreground dark:text-dark-card-foreground">
        <BookOpen className="h-3.5 w-3.5 mr-1.5" />
        Sources Referenced
      </h4>
      <ul className="text-xs space-y-1.5">
        {sources.map((source, idx) => (
          <li key={idx} className="flex items-start text-card-foreground dark:text-dark-card-foreground">
            <span className="inline-block mr-1.5">•</span>
            <div className="flex-1">
              <div>
                <strong className="font-medium">{source.title}</strong>
                {source.date && (
                  <span className="text-muted-foreground dark:text-dark-muted-foreground ml-1">({source.date})</span>
                )}
              </div>
              {source.snippet && (
                <p className="text-muted-foreground dark:text-dark-muted-foreground mt-1 truncate max-w-md">{source.snippet}</p>
              )}
              {source.url && source.url !== 'N/A' && (
                <a 
                  href={source.url}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-1 text-primary dark:text-dark-primary hover:underline flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Source
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LegalSourcesDisplay;
