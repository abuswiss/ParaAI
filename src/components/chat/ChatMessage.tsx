import React, { useState, useRef } from 'react';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Badge, Button, IconButton, Tooltip, Icons } from '../ui';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  documentContext?: string;
  analysisContext?: DocumentAnalysisResult;
  isEditing?: boolean;
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onSaveMessage?: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onCopyContent?: (content: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  isStreaming, 
  onSaveMessage, 
  onEditMessage, 
  onRegenerateResponse, 
  onCopyContent 
}) => {
  const isUser = message.role === 'user';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when editing starts
  React.useEffect(() => {
    if (message.isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      // Place cursor at the end of text
      const textLength = editTextareaRef.current.value.length;
      editTextareaRef.current.setSelectionRange(textLength, textLength);
    }
  }, [message.isEditing]);
  
  // Determine if this is a document summary message
  const isDocumentSummary = !isUser && (
    message.analysisContext?.analysisType === 'summary' ||
    (message.content.includes('summary') && message.documentContext)
  );
  
  // Determine if this is an analysis result message
  const isAnalysisResult = !isUser && message.analysisContext && 
    message.analysisContext.analysisType !== 'summary';

  const handleCopy = () => {
    if (onCopyContent) {
      onCopyContent(message.content);
    }
  };

  const handleEdit = () => {
    if (onEditMessage) {
      onEditMessage(message.id, editedContent);
    }
  };

  const handleUpdateEditContent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (onEditMessage) {
        onEditMessage(message.id, message.content); // Cancel edit
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleEdit(); // Save on Ctrl/Cmd + Enter
    }
  };

  return (
    <div 
      className={`py-4 transition-colors duration-200 ${isUser ? 'bg-transparent' : isDocumentSummary ? 'bg-primary/10 border-l-2 border-primary' : isAnalysisResult ? 'bg-blue-900/10 border-l-2 border-blue-500' : isHovered ? 'bg-gray-900/40' : 'bg-gray-900/30'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-start">
          {/* Avatar/Icon */}
          <div className="flex-shrink-0 mr-3">
            {isUser ? (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
            )}
          </div>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-text-primary">
                {isUser ? 'You' : 'Paralegal AI'}
              </span>
              
              {/* Timestamp */}
              <span className="text-xs text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {/* Typing indicator */}
              {isStreaming && !isUser && (
                <span className="text-xs text-primary animate-pulse">typing...</span>
              )}
            </div>

            {/* Document context indicator */}
            {message.documentContext && !isUser && (
              <div className="text-xs text-gray-400 mt-1 mb-1 flex items-center">
                <Icons.Document className="h-3 w-3 mr-1" />
                <span>{isDocumentSummary ? 'Document Summary' : 'Using document context'}</span>
                {isDocumentSummary && (
                  <Badge variant="primary" size="xs" rounded className="ml-1">
                    Summary
                  </Badge>
                )}
              </div>
            )}

            {/* Analysis context indicator */}
            {message.analysisContext && !isUser && (
              <div className="text-xs text-blue-400 mt-1 mb-1 flex items-center">
                <Icons.Info className="h-3 w-3 mr-1" />
                <span>
                  {message.analysisContext.analysisType.charAt(0).toUpperCase() + 
                  message.analysisContext.analysisType.slice(1)} Analysis
                </span>
                <Badge variant="info" size="xs" rounded className="ml-1">
                  {message.analysisContext.analysisType}
                </Badge>
              </div>
            )}

            {/* Message content with typing animation, edit mode, or regular content */}
            {isStreaming && !isUser ? (
              <div className="text-text-primary whitespace-pre-wrap">
                {message.content}
                <span className="inline-flex ml-1">
                  <span className="animate-pulse delay-0">.</span>
                  <span className="animate-pulse delay-100">.</span>
                  <span className="animate-pulse delay-200">.</span>
                </span>
              </div>
            ) : message.isEditing && isUser && onEditMessage ? (
              <div className="relative">
                <textarea
                  ref={editTextareaRef}
                  value={editedContent}
                  onChange={handleUpdateEditContent}
                  onKeyDown={handleKeyDown}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-text-primary focus:border-primary focus:ring-1 focus:ring-primary min-h-[100px] transition-all duration-200"
                  placeholder="Edit your message..."
                ></textarea>
                <div className="flex space-x-2 mt-2 justify-end">
                  <Button
                    onClick={() => onEditMessage(message.id, message.content)}
                    variant="ghost"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleEdit}
                    variant="primary"
                    size="sm"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`${isDocumentSummary ? 'p-2 border border-primary/20 rounded-md bg-primary/5' : 
                                isAnalysisResult ? 'p-2 border border-blue-500/20 rounded-md bg-blue-900/5' : 
                                ''} text-text-primary ${isDocumentSummary || isAnalysisResult ? 'max-h-60 overflow-y-auto' : ''} ${!isExpanded && (isDocumentSummary || isAnalysisResult) && message.content.length > 500 ? 'whitespace-pre-line line-clamp-8' : 'whitespace-pre-wrap'}`}>
                {message.content}
                
                {/* Show expand/collapse button for long content */}
                {(isDocumentSummary || isAnalysisResult) && message.content.length > 500 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-xs text-primary hover:text-primary-light focus:outline-none transition-colors flex items-center"
                  >
                    {isExpanded ? (
                      <>
                        <Icons.ChevronUp className="h-3 w-3 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <Icons.ChevronDown className="h-3 w-3 mr-1" />
                        Show More
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* Message actions */}
            {(!isUser || (isUser && !message.isEditing)) && (
              <motion.div 
                className={`flex mt-2 space-x-2 ${!isHovered && isUser ? 'opacity-0' : 'opacity-100'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered || !isUser ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Add to Notes button */}
                <Tooltip content="Add to your case notes" placement="top">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={
                      <Icons.Document className="h-3 w-3" />
                    }
                  >
                    Add to Notes
                  </Button>
                </Tooltip>
                
                {/* Save button for analysis results */}
                {(isDocumentSummary || isAnalysisResult) && onSaveMessage && (
                  <Tooltip content="Save this analysis">
                    <Button
                      onClick={onSaveMessage}
                      variant="secondary"
                      size="sm"
                      leftIcon={
                      <Icons.FileText className="h-3 w-3" />
                      }
                    >
                      Save
                    </Button>
                  </Tooltip>
                )}
                
                {/* Copy button */}
                {!isUser && onCopyContent && (
                  <Tooltip content="Copy to clipboard">
                    <IconButton
                      onClick={handleCopy}
                      variant="ghost"
                      size="sm"
                      icon={
                      <Icons.Copy className="h-3 w-3" />
                      }
                      label="Copy to clipboard"
                    />
                  </Tooltip>
                )}
                
                {/* Regenerate button */}
                {!isUser && onRegenerateResponse && !isStreaming && (
                  <Tooltip content="Regenerate response">
                    <Button
                      onClick={() => onRegenerateResponse(message.id)}
                      variant="primary"
                      size="sm"
                      leftIcon={
                      <Icons.Refresh className="h-3 w-3" />
                      }
                    >
                      Regenerate
                    </Button>
                  </Tooltip>
                )}
                
                {/* Edit button - only for user messages */}
                {isUser && onEditMessage && (
                  <Tooltip content="Edit your message">
                    <IconButton
                      onClick={() => onEditMessage(message.id, editedContent)}
                      variant="ghost"
                      size="sm"
                      icon={
                      <Icons.Edit className="h-3 w-3" />
                      }
                      label="Edit message"
                    />
                  </Tooltip>
                )}
                
                {/* Timestamp */}
                <Badge variant="secondary" size="xs" className="ml-auto">
                  <span className="flex items-center">
                    <Icons.Clock className="h-3 w-3 mr-1" />
                    {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                  </span>
                </Badge>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
