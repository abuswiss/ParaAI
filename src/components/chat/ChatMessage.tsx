import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Copy, Edit, RefreshCw, Check, Wand2, ClipboardPaste, User, Bot, Paperclip, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Icons } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Spinner";
import { CourtListenerSnippet, PerplexitySource, SourceInfo } from '@/types/sources';
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentAnalysisResult } from '@/services/documentAnalysisService'; 
import { RiskAssessment } from '../documents/RiskAssessment'; 
import { getDocumentsMetadataByIds, DocumentMetadata } from '@/services/documentService';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool' | 'error';
  content: string;
  createdAt?: string | Date;
  isLoading?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  model?: string;
  documentContext?: string;
  conversation_id?: string;
  owner_id?: string;
  analysisContext?: DocumentAnalysisResult;
  isEditing?: boolean;
  sources?: SourceInfo[];
  timestamp?: string;
}

interface ChatMessageProps {
  message: Message;
}

// Type for the context document state
type ContextDoc = Pick<DocumentMetadata, 'id' | 'filename'>;

const ChatMessage: React.FC<ChatMessageProps> = memo(({ 
  message, 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State for fetched context document metadata
  const [contextDocs, setContextDocs] = useState<ContextDoc[]>([]);
  const [contextLoading, setContextLoading] = useState<boolean>(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant' || message.role === 'error';
  const isInternal = message.role === 'system' || message.role === 'function' || message.role === 'tool' || message.role === 'data';
  const isError = message.isError || message.role === 'error';
  const isRiskAnalysis = message.analysisContext?.analysisType === 'risks';
  const isKeyClauses = message.analysisContext?.analysisType === 'clauses';
  const isDocumentSummary = message.content.startsWith('Summary of document');

  // Memoize the parsed document IDs
  const contextDocIds = useMemo(() => {
    if (isAssistant && message.documentContext) {
      return message.documentContext.split(',').filter(id => id.trim() !== '');
    }
    return [];
  }, [isAssistant, message.documentContext]);

  // Effect to fetch context document metadata
  useEffect(() => {
    if (contextDocIds.length > 0) {
      let isMounted = true;
      const fetchContext = async () => {
        setContextLoading(true);
        setContextError(null);
        setContextDocs([]); // Clear previous docs
        try {
          const { data, error } = await getDocumentsMetadataByIds(contextDocIds);
          if (error) throw error;
          if (isMounted && data) {
            setContextDocs(data.map(d => ({ id: d.id, filename: d.filename })));
          }
        } catch (err) {
          console.error("Error fetching context document metadata:", err);
          if (isMounted) {
            setContextError("Failed to load context document details.");
          }
        } finally {
          if (isMounted) {
            setContextLoading(false);
          }
        }
      };
      fetchContext();
      return () => { isMounted = false; }; // Cleanup function
    } else {
      // Reset state if there are no context docs for this message
      setContextDocs([]);
      setContextLoading(false);
      setContextError(null);
    }
  }, [contextDocIds]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(err => console.error('Failed to copy text: ', err));
  };

  const handleEdit = () => {
    if (isUser) {
      setIsEditing(true);
      setEditedContent(message.content);
    }
  };

  const handleSaveEdit = () => {
    console.warn("Saving edited message not implemented yet.");
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedContent]);

  const renderContent = () => {
    if (isEditing) {
      return (
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            } else if (e.key === 'Escape') {
              handleCancelEdit();
            }
          }}
          className="w-full p-2 border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary text-sm bg-background"
          rows={1}
        />
      );
    } 

    if (message.isLoading) {
      return (
        <div className="space-y-2 py-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
        </div>
      );
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        className="prose prose-sm dark:prose-invert max-w-none break-words"
        components={{
        }}
      >
        {message.content}
      </ReactMarkdown>
    );
  };

  const renderActions = () => {
    if (isEditing) {
      return (
        <div className="flex items-center space-x-1">
          <Button size="xs-icon" variant="ghost" onClick={handleSaveEdit} className="text-green-600 hover:text-green-700">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="xs-icon" variant="ghost" onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="xs-icon" variant="ghost" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  // Conditional styling based on role
  const messageContainerClass = cn(
    'flex w-full', 
    isUser ? 'justify-end' : 'justify-start'
  );

  const messageContentClass = cn(
    'group relative transition-colors duration-150', // Base styles
    'max-w-[85%]', // Max width 
    isUser 
      ? 'bg-primary/10 rounded-lg px-4 py-3 ml-auto' // User bubble
      : isError
        ? 'bg-destructive/10 rounded-lg px-4 py-3 mr-auto' // Error bubble
        : isAssistant
          ? 'px-0 py-1 mr-auto' // Assistant: No background/padding, allow full width basically
          : 'bg-muted/30 rounded-lg px-4 py-3 mr-auto' // Default bubble (system? though system shouldn't be displayed)
  );

  const renderContextIndicator = () => {
    if (!isAssistant || contextLoading || contextError || contextDocs.length === 0) {
      return null;
    }

    const tooltipContent = contextDocs.map(doc => doc.filename).join(', ');

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center text-xs text-muted-foreground mt-1.5 cursor-default">
            <FileText className="h-3.5 w-3.5 mr-1" />
            <span>Context ({contextDocs.length})</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <p className="max-w-xs break-words text-xs">
            Used context from: {tooltipContent}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div 
        className={messageContainerClass}
    > 
      <TooltipProvider delayDuration={100}> 
           {/* Apply role-specific styling to the content container */}
           <div className={messageContentClass}> 
               {/* Layout: Icon/Label first, then content+actions */} 
               <div className={cn(
                   'flex items-start',
                   isAssistant ? 'space-x-2' : 'space-x-3' // Smaller space for AI label
               )}>
                   {/* Avatar/Icon/Label */}
                   {!isUser && (
                       <div className={cn(
                           'flex-shrink-0 mt-1 font-medium text-xs uppercase tracking-wider',
                           isAssistant ? 'text-muted-foreground' : 'hidden' // Show 'AI' label for assistant, hide otherwise
                       )}>
                           AI
                       </div>
                   )}
                   {isUser && (
                       <div className={cn(
                           'flex-shrink-0 mt-1 font-medium text-xs uppercase tracking-wider text-primary'
                       )}>
                           You
                       </div>
                   )}

                   {/* Message Content & Actions Container */}
                   <div className="flex-1 min-w-0">
                       {/* Only show timestamp for non-assistant messages, or adjust styling */}
                       {!isAssistant && (
                           <div className="flex items-center space-x-2 mb-0.5">
                               <span className="text-xs text-muted-foreground">
                                   {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </span>
                               {/* Keep streaming indicator if needed for user edits? Unlikely. */}
                           </div>
                       )}
                       
                       {/* Context Indicators */} 
                       {renderContextIndicator()}

                       {/* Message Content Body */}
                       <div className={cn(
                           'text-sm text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5',
                           isAssistant ? 'mt-0' : 'mt-1' // Reduce top margin for assistant
                        )}>
                         {message.isStreaming && !isUser ? (
                           <div className="whitespace-pre-wrap">
                             {message.content}
                             <span className="inline-flex ml-1">
                               <span className="animate-pulse delay-0">.</span>
                               <span className="animate-pulse delay-100">.</span>
                               <span className="animate-pulse delay-200">.</span>
                             </span>
                           </div>
                         ) : message.isEditing && isUser ? (
                            <div className="relative my-1"> 
                               <Textarea
                                   ref={editTextareaRef}
                                   value={editedContent}
                                   onChange={handleUpdateEditContent}
                                   onKeyDown={handleKeyDown}
                                   className="w-full p-2 bg-background border border-input rounded-md text-foreground focus:border-primary focus:ring-1 focus:ring-primary min-h-[80px] text-sm transition-all duration-200"
                                   placeholder="Edit your message..."
                               />
                               <div className="flex space-x-1 mt-1 justify-end">
                                   <Button onClick={() => { setEditedContent(message.content); onEditMessage(message.id, message.content); }} variant="ghost" size="sm">Cancel</Button>
                                   <Button onClick={handleEdit} variant="secondary" size="sm">Save</Button>
                               </div>
                           </div>
                         ) : isError ? ( 
                             <p className="text-destructive">{message.content}</p>
                         ) : ( 
                            <ReactMarkdown>
                               {message.content}
                             </ReactMarkdown>
                         )}
                       </div>
                        
                       {/* Source Rendering - Keep as is */}
                       {!isUser && message.sources && message.sources.length > 0 && (
                           <div className="mt-3 pt-2 border-t border-border/50 text-xs"> 
                               <h4 className="font-semibold text-muted-foreground mb-1">Sources:</h4>
                               <ul className="space-y-1">
                                   {message.sources.map((source, index) => {
                                       const isCourtListener = 'case_name' in source || ('date' in source && source.url.includes('courtlistener'));
                                       const snippetDate = isCourtListener ? (source as CourtListenerSnippet).date : undefined;
                                       return (
                                          <li key={index} className="flex items-start space-x-1.5 text-muted-foreground">
                                             <span className="flex-shrink-0 pt-0.5">{index + 1}.</span>
                                             <div className="flex-1 min-w-0">
                                                 <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block text-sm" title={source.title || source.url}>{source.title || new URL(source.url).hostname}</a>
                                                 {snippetDate && (<span className="text-xs block text-muted-foreground/80">Filed: {new Date(snippetDate).toLocaleDateString()}</span>)}
                                             </div>
                                          </li>
                                       );
                                   })}
                               </ul>
                           </div>
                        )}

                       {/* Action Buttons (Show below content for Assistant, or on hover for User) */}
                       {/* Modify positioning and visibility based on role */} 
                       <div className={cn(
                           'absolute -bottom-4 text-xs text-muted-foreground',
                           isUser ? "right-1" : "left-1"
                       )}>
                           {!isEditing && renderActions()}
                       </div>

                   </div>
               </div>
           </div>
       </TooltipProvider>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
