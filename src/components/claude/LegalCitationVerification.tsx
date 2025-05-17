import React from 'react';
import { GavelIcon, CheckCircle2, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VerifiedCitation {
  citation: string;
  verified: boolean;
  correctedCitation?: string;
  court?: string;
  date?: string;
  summary?: string;
  sources?: {
    title: string;
    url: string;
  }[];
  error?: string;
}

interface LegalCitationVerificationProps {
  verifications: VerifiedCitation[];
  className?: string;
}

/**
 * Component to display legal citation verification results
 */
const LegalCitationVerification: React.FC<LegalCitationVerificationProps> = ({ 
  verifications,
  className
}) => {
  if (!verifications || verifications.length === 0) return null;

  return (
    <div className={cn("border border-border dark:border-dark-border rounded-lg overflow-hidden mt-4", className)}>
      <div className="bg-accent dark:bg-dark-accent p-3 flex items-center border-b border-border dark:border-dark-border">
        <GavelIcon className="h-4 w-4 mr-2 text-primary dark:text-dark-primary" />
        <span className="font-medium text-accent-foreground dark:text-dark-accent-foreground">
          Citation Verification
        </span>
      </div>
      
      <div className="divide-y divide-border dark:divide-dark-border">
        {verifications.map((verification, idx) => (
          <div key={idx} className="p-3 bg-background dark:bg-dark-background">
            <div className="flex items-start gap-2">
              {verification.verified ? (
                <CheckCircle2 className="h-5 w-5 text-success dark:text-dark-success mt-0.5 flex-shrink-0" />
              ) : verification.correctedCitation ? (
                <AlertCircle className="h-5 w-5 text-warning dark:text-dark-warning mt-0.5 flex-shrink-0" />
              ) : (
                <HelpCircle className="h-5 w-5 text-muted-foreground dark:text-dark-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              
              <div className="flex-1">
                <div className="font-mono text-sm text-foreground dark:text-dark-foreground">
                  {verification.citation}
                </div>
                
                {verification.correctedCitation && (
                  <div className="mt-1 text-sm">
                    <span className="text-warning dark:text-dark-warning font-medium">Correction: </span>
                    <span className="font-mono text-foreground dark:text-dark-foreground">{verification.correctedCitation}</span>
                  </div>
                )}
                
                {verification.court && verification.date && (
                  <div className="mt-1.5 text-xs text-muted-foreground dark:text-dark-muted-foreground">
                    {verification.court} • {verification.date}
                  </div>
                )}
                
                {verification.summary && (
                  <div className="mt-2 text-sm text-muted-foreground dark:text-dark-muted-foreground bg-muted/50 dark:bg-dark-muted/50 p-2 rounded border-l-2 border-primary dark:border-dark-primary">
                    {verification.summary}
                  </div>
                )}
                
                {verification.sources && verification.sources.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground dark:text-dark-muted-foreground mb-1">Sources:</div>
                    {verification.sources.slice(0, 2).map((source, sIdx) => (
                      <a 
                        key={sIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary dark:text-dark-primary hover:underline flex items-center mt-1"
                      >
                        <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                        {source.title}
                      </a>
                    ))}
                  </div>
                )}
                
                {verification.error && !verification.verified && !verification.correctedCitation && (
                  <div className="mt-1 text-xs">
                    <span className="text-muted-foreground dark:text-dark-muted-foreground">Could not verify: </span>
                    <span className="text-destructive dark:text-dark-destructive">{verification.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegalCitationVerification;
