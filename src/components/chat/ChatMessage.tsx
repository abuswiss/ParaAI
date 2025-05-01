import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/Textarea";
import { CourtListenerSnippet, PerplexitySource, SourceInfo } from '@/types/sources';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { Avatar } from "../ui/Avatar";
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

  const messageBgClass = cn(
    'group relative rounded-lg px-4 py-3 transition-colors duration-150 w-full', // Apply py-3 baseline
    isUser 
      ? 'bg-primary/10' 
      : isError
        ? 'bg-destructive/10'
        : message.analysisContext
          ? 'bg-blue-500/5' // Subtle background for analysis results
          : 'bg-muted/30',
    isHovered && !isUser && !isError && 'bg-muted/50', // Slightly darker hover for assistant
    isHovered && isUser && 'bg-primary/15' // Slightly darker hover for user
  );

  return (
    <div 
        className={cn('flex', isUser ? 'justify-end' : 'justify-start', 'w-full')} 
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => setIsHovered(false)}
    > 
      <TooltipProvider delayDuration={100}> 
           {/* Apply max-width and margin based on role */} 
           <div className={cn(
               messageBgClass, 
               'max-w-[85%]', // Max width for message bubble
               isUser ? 'ml-auto' : 'mr-auto' // Push to right/left
            )}> 
               <div className="flex items-start space-x-3">
                   {/* Avatar/Icon */}
                   <Avatar 
                       name={isUser ? 'User' : 'AI'} 
                       size="sm"
                       className="flex-shrink-0 mt-1"
                   />
                   {/* Message content */}
                   <div className="flex-1 min-w-0">
                       <div className="flex items-center space-x-2">
                           <span className="text-sm font-medium text-foreground">
                               {isUser ? 'You' : 'Paralegal AI'}
                           </span>
                           <span className="text-xs text-muted-foreground">
                               {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                           {isStreaming && !isUser && (
                               <span className="text-xs text-primary animate-pulse">typing...</span>
                           )}
                       </div>
                       
                       {/* Context Indicators */} 
                       {/* ... (Keep existing context indicator rendering) ... */} 

                       {/* Message Content Body */} 
                       <div className="mt-1 text-sm text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
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
                            <div className="relative my-1"> {/* Reduced margin for edit mode */} 
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
                                   <Button onClick={handleEdit} variant="secondary" size="sm">Save</Button> {/* Use secondary variant */} 
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
                        
                       {/* Source Rendering - ENHANCED */}
                       {!isUser && message.sources && message.sources.length > 0 && (
                           <div className="mt-3 pt-2 border-t border-border/50 text-xs"> 
                               <h4 className="font-semibold text-muted-foreground mb-1">Sources:</h4>
                               <ul className="space-y-1">
                                   {message.sources.map((source, index) => {
                                       // Check if it's a CourtListenerSnippet to access date
                                       const isCourtListener = 'case_name' in source || ('date' in source && source.url.includes('courtlistener'));
                                       const snippetDate = isCourtListener ? (source as CourtListenerSnippet).date : undefined;

                                       return (
                                          <li key={index} className="flex items-start space-x-1.5 text-muted-foreground">
                                             <span className="flex-shrink-0 pt-0.5">{index + 1}.</span>
                                             <div className="flex-1 min-w-0">
                                                 <a 
                                                    href={source.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-blue-600 dark:text-blue-400 hover:underline truncate block text-sm"
                                                    title={source.title || source.url} 
                                                 >
                                                     {source.title || new URL(source.url).hostname}
                                                 </a>
                                                 {snippetDate && (
                                                     <span className="text-xs block text-muted-foreground/80">
                                                         Filed: {new Date(snippetDate).toLocaleDateString()}
                                                     </span>
                                                 )}
                                                 {/* Optional: Show snippet text if needed */} 
                                                 {/* {source.snippet && <p className="text-xs text-gray-500 mt-0.5 italic truncate">{source.snippet}</p>} */} 
                                             </div>
                                          </li>
                                       );
                                   })}
                               </ul>
                           </div>
                        )}

                   </div>
                    
                   {/* Action Buttons (Absolute Positioned within the message bubble) */} 
                   {(isHovered || message.isEditing) && !isStreaming && !isError && ( 
                       <div className="absolute top-1 right-1 flex items-center space-x-0.5 bg-background/80 backdrop-blur-sm p-0.5 rounded border border-border/50 opacity-100"> {/* Simpler styling, always visible on hover */} 
                           {/* Edit Button */} 
                           {isUser && !message.isEditing && ( 
                               <Tooltip>
                                   <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground"
                                            onClick={() => onEditMessage(message.id, message.content)} // Trigger edit mode
                                        >
                                            <Icons.Edit className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                           )}
                            {/* Regenerate Button - Corrected Condition */} 
                           {!isUser && onRegenerateResponse && ( 
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground"
                                            onClick={() => onRegenerateResponse(message.id)}
                                        >
                                            <Icons.Refresh className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Regenerate</TooltipContent>
                                </Tooltip>
                            )}
                            {/* Copy Button */} 
                           {onCopyContent && ( 
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground"
                                            onClick={handleCopy}
                                        >
                                            <Icons.Copy className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy</TooltipContent>
                                </Tooltip>
                           )}
                            {/* Insert Button */} 
                           {!isUser && onInsertContent && ( 
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground"
                                            onClick={handleInsert}
                                        >
                                            <Icons.Plus className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Insert into Editor</TooltipContent>
                                </Tooltip>
                           )}
                       </div>
                   )} 
               </div> 
           </div> 
       </TooltipProvider> 
    </div>
  );
};

export default ChatMessage;
