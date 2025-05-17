import React from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { githubGist as atomOneLightGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { cn } from '@/lib/utils';

import LegalThinkingPanel from './LegalThinkingPanel';
import LegalSourcesDisplay, { SourceInfo } from './LegalSourcesDisplay';
import LegalCitationVerification, { VerifiedCitation } from './LegalCitationVerification';

export interface Thought {
  id: string;
  content: string;
}

export type ResponseType = 'simple' | 'complex' | 'research' | 'deep_research' | 'error';

export interface ClaudeMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  responseType?: ResponseType;
  model?: string;
  thoughts?: Thought[];
  sources?: SourceInfo[];
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

// Define shared Markdown renderers, especially for code blocks
export const markdownRenderers = (): Options['components'] => ({
  code({ inline, className, children, ...props }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  }) {
    const match = /language-(\w+)/.exec(className || '');
    const currentTheme = typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') ? 'dark' : 'light' : 'light';
    return !inline && match ? (
      <SyntaxHighlighter
        style={currentTheme === 'dark' ? atomOneDark : atomOneLightGist}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children ?? '').replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a: ({ ...props }) => {
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
});

/**
 * Enhanced chat message component specifically for Claude responses
 * Handles different response types (simple, complex, research) with appropriate UI
 */
const ClaudeChatMessage: React.FC<ClaudeMessageProps> = ({
  id,
  role,
  content, // This content will now have markdown links from the AI
  responseType = 'simple',
  model,
  thoughts = [],
  sources = [], // Still used by LegalSourcesDisplay
  createdAt,
  metadata = {},
}) => {
  const isUser = role === 'user';
  const isError = responseType === 'error';

  // Simplified getModelLabel or use existing
  const getModelLabel = (currentModel?: string, currentResponseType?: ResponseType): string => {
    if (currentResponseType === 'deep_research') return 'Perplexity Deep Research';
    if (currentResponseType === 'research') return 'Research Response';
    if (currentModel?.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
    if (currentModel?.includes('claude-3-opus')) return 'Claude 3 Opus';
    if (currentModel?.includes('claude-3-haiku')) return 'Claude 3 Haiku';
    return currentModel || 'AI Assistant';
  };

  const avatarContent = isUser ? 'You' : getModelLabel(model, responseType).charAt(0);
  const senderName = isUser ? 'You' : getModelLabel(model, responseType);

  // --- Citation Verification Logic ---
  const citationVerifications: VerifiedCitation[] = [];
  let isCitationVerificationMessage = false;
  if (role === 'system' && metadata?.type === 'citation_verification') {
      isCitationVerificationMessage = true;
      try {
          const lines = content.split('\n');
          let currentCitation: Partial<VerifiedCitation> | null = null;
          lines.forEach(line => {
            if (line.includes('✅') || line.includes('⚠️') || line.includes('❓')) {
              if (currentCitation) citationVerifications.push(currentCitation as VerifiedCitation);
              const citationText = line.match(/\*\*([^*]+)\*\*/)?.[1] || '';
              const verified = line.includes('✅');
              const correctedCitationText = line.includes('Correction:') ? line.split('Correction:')[1].trim() : undefined;
              currentCitation = { citation: citationText, verified, correctedCitation: correctedCitationText };
            } else if (line.startsWith('> ') && currentCitation) {
              currentCitation.summary = line.replace('> ', '');
            } else if (line.startsWith('- [') && currentCitation) {
              const titleMatch = line.match(/\[([^\]]+)\]/)?.[1];
              const urlMatch = line.match(/\]\(([^)]+)\)/)?.[1];
              if (titleMatch && urlMatch) {
                if (!currentCitation.sources) currentCitation.sources = [];
                currentCitation.sources.push({ title: titleMatch, url: urlMatch });
              }
            }
          });
          if (currentCitation) citationVerifications.push(currentCitation as VerifiedCitation);

      } catch (error) {
          console.error('Error parsing citation verification data:', error);
      }
  }

  if (isCitationVerificationMessage) {
      if (citationVerifications.length > 0) {
          return <LegalCitationVerification verifications={citationVerifications} />;
      }
      return null;
  }

  // Skip rendering *other* (non-citation-verification) system messages
  if (role === 'system' && !isCitationVerificationMessage) {
    return null;
  }
  // --- End Citation Verification Logic ---

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 md:p-4 rounded-lg shadow-lg backdrop-blur-md transition-all duration-150 ease-in-out bg-card/70 dark:bg-dark-card/70 border border-card-border dark:border-dark-card-border",
        isUser && "ring-1 ring-primary/20 dark:ring-dark-primary/20 justify-end",
        isError && "border-destructive dark:border-dark-destructive"
      )}
      id={`message-${id}`}
    >
      {!isUser && (
        <div className={cn(
          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold",
          "bg-card/80 text-card-foreground dark:bg-dark-card/80 dark:text-dark-card-foreground border border-card-border dark:border-dark-card-border"
        )}>
          {avatarContent}
        </div>
      )}
      <div className={cn("flex-1 overflow-hidden", isUser ? "text-right" : "text-left")}> 
        <div className={cn(
            "flex items-center mb-1",
            isUser ? "justify-end" : "justify-start"
        )}>
          <span className="text-sm font-medium text-card-foreground dark:text-dark-card-foreground">{senderName}</span>
          <time className="ml-2 text-xs text-muted-foreground dark:text-dark-muted-foreground">
            {createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </time>
        </div>
        {isError ? (
          <div className="text-destructive dark:text-dark-destructive prose prose-sm dark:prose-invert max-w-none">
            <p><strong>Error:</strong> {content}</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground dark:text-dark-card-foreground message-content-clickable-links">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownRenderers()}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        {!isUser && thoughts && thoughts.length > 0 && (
          <div className="mt-3">
            <LegalThinkingPanel thoughts={thoughts} sources={sources} />
          </div>
        )}
        {!isUser && sources && sources.length > 0 && (responseType === 'research' || responseType === 'deep_research') && (
          <div className="mt-3">
            <LegalSourcesDisplay sources={sources} />
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-primary/80 text-primary-foreground dark:bg-dark-primary/80 dark:text-dark-primary-foreground border border-card-border dark:border-dark-card-border">
          {avatarContent}
        </div>
      )}
    </div>
  );
};

export default ClaudeChatMessage;
