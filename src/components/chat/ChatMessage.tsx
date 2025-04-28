import React, { useState, useRef } from 'react';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';
import { Badge, Button, Tooltip, Icons } from '../ui';
import { RiskAssessment } from '../documents/RiskAssessment';
import ReactMarkdown from 'react-markdown';

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
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onCopyContent?: (content: string) => void;
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
  const isUser = message.role === 'user';
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

  // Determine if this is a risk analysis agent reply
  const isRiskAnalysis = !isUser && message.analysisContext?.analysisType === 'risks';

  // Determine if this is a key clauses agent reply
  const isKeyClauses = !isUser && message.analysisContext?.analysisType === 'clauses';

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

  const handleInsert = () => {
    if (onInsertContent) {
      onInsertContent(message.content);
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
      className={`py-4 transition-colors duration-200 relative ${isUser ? 'bg-transparent' : isDocumentSummary ? 'bg-primary/10 border-l-2 border-primary' : isAnalysisResult ? 'bg-blue-900/10 border-l-2 border-blue-500' : isHovered ? 'bg-gray-900/40' : 'bg-gray-900/30'}`}
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
              isRiskAnalysis && message.analysisContext ? (
                <RiskAssessment analysis={message.analysisContext} />
              ) : isKeyClauses && message.analysisContext ? (
                <div className="space-y-4">
                  {(() => {
                    try {
                      // Split by double newlines to get clause blocks
                      const clauseBlocks = message.analysisContext.result.split('\n\n').filter((block: string) => block.trim());
                      if (clauseBlocks.length > 0) {
                        // Group every 3 blocks (title, key text, analysis) into one card
                        const groupedClauses = [];
                        for (let i = 0; i < clauseBlocks.length; i += 3) {
                          const titleBlock = clauseBlocks[i] || '';
                          const keyTextBlock = clauseBlocks[i + 1] || '';
                          const analysisBlock = clauseBlocks[i + 2] || '';
                          groupedClauses.push({ titleBlock, keyTextBlock, analysisBlock });
                        }
                        return groupedClauses.map((clause, index) => (
                          <div key={index} className="bg-gray-800 rounded-lg border border-primary/30 p-5 space-y-3">
                            {/* Title */}
                            <div className="text-lg font-semibold text-primary mb-1">
                              <ReactMarkdown>{clause.titleBlock.replace(/^#+\s*/, '')}</ReactMarkdown>
                            </div>
                            {/* Key Text */}
                            {clause.keyTextBlock && (
                              <div className="bg-gray-900 rounded p-3 border-l-4 border-primary/50">
                                <div className="text-xs text-gray-400 font-bold mb-1">Key Text:</div>
                                <div className="text-text-primary text-sm whitespace-pre-line">
                                  <ReactMarkdown>{clause.keyTextBlock.replace(/^Key Text:?/i, '').trim()}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                            {/* Analysis */}
                            {clause.analysisBlock && (
                              <div className="bg-gray-900 rounded p-3 border-l-4 border-accent-500">
                                <div className="text-xs text-gray-400 font-bold mb-1">Analysis:</div>
                                <div className="text-text-secondary text-sm whitespace-pre-line">
                                  <ReactMarkdown>{clause.analysisBlock.replace(/^Analysis:?/i, '').trim()}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        ));
                      } else {
                        // If no double newlines, treat the whole thing as one block (fallback)
                        return (
                          <div className="bg-gray-800 rounded-lg border border-primary/30 p-5">
                            <ReactMarkdown>{message.analysisContext.result}</ReactMarkdown>
                          </div>
                        );
                      }
                    } catch (parseError) {
                      console.error('Error parsing key clause result:', parseError);
                      return <div className="text-text-primary whitespace-pre-wrap"><ReactMarkdown>{message.content}</ReactMarkdown></div>; // Fallback to regular rendering
                    }
                  })()}
                </div>
              ) : (
                <div className="text-text-primary whitespace-pre-wrap">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )
            )}
          </div>
        </div>

        {/* Hover actions for non-streaming messages */}
        {!isStreaming && isHovered && (
          <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Tooltip content="Copy message">
              <Button onClick={handleCopy} variant="ghost" size="sm" aria-label="Copy message">
                <Icons.Copy className="h-4 w-4" />
              </Button>
            </Tooltip>
            {!isUser && onRegenerateResponse && (
              <Tooltip content="Regenerate response">
                <Button onClick={() => onRegenerateResponse(message.id)} variant="ghost" size="sm" aria-label="Regenerate response">
                  <Icons.Refresh className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
            {!isUser && onInsertContent && (
              <Tooltip content="Insert to Editor">
                <Button onClick={handleInsert} variant="ghost" size="sm" aria-label="Insert to Editor">
                  <Icons.Plus className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
            {isUser && onEditMessage && (
              <Tooltip content="Edit message">
                <Button onClick={() => onEditMessage(message.id, message.content)} variant="ghost" size="sm" aria-label="Edit message">
                  <Icons.Edit className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
