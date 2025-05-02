import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/Textarea";
import { CourtListenerSnippet, PerplexitySource, SourceInfo } from '@/types/sources';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import { DocumentAnalysisResult } from '@/services/documentAnalysisService'; 
import { RiskAssessment } from '../documents/RiskAssessment'; 

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  conversation_id?: string;
  documentContext?: string | null; 
  analysisContext?: DocumentAnalysisResult; // Add analysisContext type
  isEditing?: boolean; // Add isEditing flag
  sources?: SourceInfo[]; 
  isError?: boolean; // Added optional error flag
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onEditMessage: (id: string, newContent: string) => void;
  onRegenerateResponse: (id: string) => void;
  onCopyContent: (content: string) => void;
  onInsertContent?: (content: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message,
  isStreaming,
  onEditMessage,
  onRegenerateResponse,
  onCopyContent,
  onInsertContent
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isError = message.role === 'error';
  const isRiskAnalysis = message.analysisContext?.analysisType === 'risks';
  const isKeyClauses = message.analysisContext?.analysisType === 'clauses';
  const isDocumentSummary = message.content.startsWith('Summary of document'); // Basic check

  // Reset edited content if message content changes externally (e.g., streaming ends)
  useEffect(() => {
      setEditedContent(message.content);
  }, [message.content]);
  
  // Focus and select text when entering edit mode
  useEffect(() => {
    if (message.isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.select();
    }
  }, [message.isEditing]);

  const handleCopy = () => {
    onCopyContent(message.content);
  };

  const handleInsert = () => {
    if (onInsertContent) {
      onInsertContent(message.content);
    }
  };

  const handleUpdateEditContent = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(event.target.value);
    // Auto-resize textarea (optional)
    if (editTextareaRef.current) {
      editTextareaRef.current.style.height = 'inherit';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  };

  const handleEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
        onEditMessage(message.id, editedContent);
    } else {
         // If content hasn't changed, just exit edit mode
         // Passing original content signals exit from edit mode in parent
         onEditMessage(message.id, message.content); 
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (if not Shift+Enter)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleEdit();
    }
    // Cancel on Escape
    if (event.key === 'Escape') {
      setEditedContent(message.content); // Reset content
      onEditMessage(message.id, message.content); // Exit edit mode
    }
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

  return (
    <div 
        className={messageContainerClass}
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => setIsHovered(false)}
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
                       {/* ... (Keep existing context indicator rendering) ... */} 

                       {/* Message Content Body */}
                       <div className={cn(
                           'text-sm text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5',
                           isAssistant ? 'mt-0' : 'mt-1' // Reduce top margin for assistant
                        )}>
                         {isStreaming && !isUser ? (
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
                           'flex items-center space-x-1 mt-1.5',
                           isUser ? 'absolute top-1 right-1 bg-background/80 backdrop-blur-sm p-0.5 rounded border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity' : 'opacity-70 hover:opacity-100' // Always visible but dimmer for AI, fades in for User
                       )}>
                           {/* Regenerate Button (Assistant only) */} 
                           {isAssistant && !isStreaming && ( 
                                <Tooltip>
                                   <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground" onClick={() => onRegenerateResponse(message.id)}>
                                            <Icons.Refresh className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Regenerate</TooltipContent>
                                </Tooltip>
                           )} 
                           {/* Edit Button (User only) */} 
                           {isUser && !message.isEditing && ( 
                               <Tooltip>
                                   <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground" onClick={() => onEditMessage(message.id, message.content)}>
                                            <Icons.Edit className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                           )} 
                           {/* Copy Button (All non-streaming/non-editing) */} 
                           {!isStreaming && !message.isEditing && (
                               <Tooltip>
                                   <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
                                            <Icons.Copy className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy</TooltipContent>
                                </Tooltip>
                           )}
                           {/* Insert Button (If handler provided, non-user, non-streaming) */} 
                           {onInsertContent && !isUser && !isStreaming && !message.isEditing && (
                               <Tooltip>
                                   <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground" onClick={handleInsert}>
                                            <Icons.Insert className="h-3 w-3" /> 
                                        </Button>
                                   </TooltipTrigger>
                                   <TooltipContent>Insert into Editor</TooltipContent>
                                </Tooltip>
                           )}
                       </div>

                   </div>
               </div>
           </div>
       </TooltipProvider>
    </div>
  );
};

export default ChatMessage;
