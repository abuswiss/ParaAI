import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import { Brain, StopCircle, Plus, History, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from 'next-themes';
import { 
  activeCaseAtom,
  activeCaseIdAtom,
  activeConversationIdAtom,
  chatDocumentContextIdsAtom,
  chatPreloadContextAtom,
  activeEditorItemAtom,
  deepResearchModeAtom
} from '@/atoms/appAtoms';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabaseClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import ChatHistoryList from '@/components/history/ChatHistoryList';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { cn } from '@/lib/utils';

import ClaudeChatMessage, { Thought, ResponseType, markdownRenderers } from './ClaudeChatMessage';
import LegalThinkingPanel from './LegalThinkingPanel';
import { SourceInfo } from './LegalSourcesDisplay';
import ChatInput from '../chat/ChatInput';
import DocumentContextPicker from '../chat/DocumentContextPicker';
import ChatSkeletonLoader from './ChatSkeletonLoader';

// Define interface for the messages
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  responseType?: ResponseType;
  model?: string;
  thoughts?: Thought[];
  sources?: SourceInfo[];
  createdAt: Date;
  metadata?: Record<string, any>;
}

interface StreamEvent {
  type: 'metadata' | 'answer' | 'thought' | 'complete' | 'error';
  content?: string;
  responseType?: ResponseType;
  model?: string;
  sources?: SourceInfo[];
  error?: string;
}

/**
 * Main Claude-powered chat interface that implements the legal assistant architecture
 * with automatic query routing, thinking process display, and research capabilities
 */
const ClaudeChatInterface: React.FC = () => {
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();
  const selectedCaseDetails = useAtomValue(activeCaseAtom).details;
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const activeConversationId = useAtomValue(activeConversationIdAtom);
  const setActiveConversationId = useSetAtom(activeConversationIdAtom);
  const latestConversationIdRef = useRef<string | null>(activeConversationId);
  
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useAtom(chatDocumentContextIdsAtom);
  const [preloadedContext, setPreloadedContext] = useAtom(chatPreloadContextAtom);
  const [deepResearchMode, setDeepResearchMode] = useAtom(deepResearchModeAtom);

  // Add console.log to check deepResearchMode state
  console.log('[ClaudeChatInterface] deepResearchMode is:', deepResearchMode);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for messages and streaming
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  
  // Thoughts are always enabled by default
  const showThoughts = true; // Not using state anymore since it's always true
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [currentThoughts, setCurrentThoughts] = useState<Thought[]>([]);
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [responseMetadata, setResponseMetadata] = useState<{
    type: ResponseType;
    model: string;
    sources?: SourceInfo[];
  }>({ 
    type: 'simple', 
    model: 'claude-3-5-sonnet',
    sources: [] 
  });

  // Controller to abort fetch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeEditorItem = useAtomValue(activeEditorItemAtom);

  // Function to start a new chat
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setSelectedDocumentIds([]);
    setMessages([]);
    setConversationTitle('New Chat');
    setPreloadedContext(null);
    console.log("New chat started, state reset.");
  }, [setActiveConversationId, setSelectedDocumentIds, setMessages, setConversationTitle, setPreloadedContext]);

  // Load conversation messages when conversation ID changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsHistoryLoading(true);
      setHistoryError(null);
      
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConversationId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        
        if (data) {
          const formattedMessages = data.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            responseType: msg.metadata?.responseType as ResponseType | undefined,
            model: msg.model,
            thoughts: msg.metadata?.thoughts as Thought[] | undefined,
            sources: msg.metadata?.sources as SourceInfo[] | undefined,
            createdAt: new Date(msg.created_at),
            metadata: msg.metadata || {}
          }));
          
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setHistoryError('Failed to load conversation history');
      } finally {
        setIsHistoryLoading(false);
      }
    };

    loadMessages();
  }, [activeConversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedAnswer]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Handle sending message to Claude
  const handleSend = useCallback(async (messageContent: string) => {
    if (!activeCaseId) {
      toast({
        title: "No Case Selected",
        description: "Please select a case before sending a message.",
        variant: "destructive"
      });
      return;
    }
    
    if (!messageContent.trim() && selectedDocumentIds.size === 0 && !preloadedContext) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageContent,
      createdAt: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    setIsStreaming(true);
    setCurrentThoughts([]); // Reset thoughts, Perplexity might not use them
    setStreamedAnswer('');
    setResponseMetadata({
      type: deepResearchMode ? 'deep_research' : 'simple', // Default to simple for non-deep research
      model: deepResearchMode ? 'sonar-pro' : 'claude-3-5-sonnet', // Adjust default Claude model if needed
      sources: []
    });
    setStreamError(null);
    
    try {
      abortControllerRef.current = new AbortController();
      
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      formattedMessages.push({
        role: 'user',
        content: messageContent
      });
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        setStreamError('Supabase URL is not configured. Please check environment variables.');
        toast({
          title: "Configuration Error",
          description: "Supabase URL is not configured. Please contact support.",
          variant: "destructive",
        });
        setIsStreaming(false);
        return;
      }

      const endpoint = deepResearchMode 
        ? `${supabaseUrl}/functions/v1/deep-research-agent` 
        : `${supabaseUrl}/functions/v1/claude-router`;

      console.log(`[ClaudeChatInterface] Sending to: ${endpoint}`);
      console.log('[ClaudeChatInterface] Preparing to send. Selected documentContextIds:', selectedDocumentIds);
      const requestBody: any = {
        messages: formattedMessages,
        caseId: activeCaseId,
        conversationId: activeConversationId,
        documentContextIds: Array.from(selectedDocumentIds),
        // streamThoughts: !deepResearchMode && showThoughts, // Only for Claude, if applicable
        query: messageContent, // Ensure query is passed, especially for deep research
        preloadedContext: preloadedContext || undefined 
      };
      
      // For claude-router, streamThoughts is still relevant
      if (!deepResearchMode) {
        requestBody.streamThoughts = showThoughts;
      }

      if (activeEditorItem?.type === 'document' && activeEditorItem.id) {
        requestBody.activeDocumentId = activeEditorItem.id;
        console.log('[ClaudeChatInterface] Sending with activeDocumentId:', activeEditorItem.id);
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = 'Failed to communicate with the AI service';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Check for new conversation ID in header
      const newConvId = response.headers.get('X-Conversation-Id');
      if (newConvId && !activeConversationId) {
        console.log("New conversation started, ID:", newConvId);
        // Log document context info for debugging
        console.log("Document context IDs being used:", Array.from(selectedDocumentIds));
        setActiveConversationId(newConvId);
        latestConversationIdRef.current = newConvId;
      }
      queryClient.invalidateQueries({ queryKey: ['conversations', activeCaseId] });
      
      // Clear preloaded context after sending
      if (preloadedContext) {
        setPreloadedContext(null);
      }
      
      // Process the streaming response
      await handleClaudeStream(response);
      
      // Debug log to verify streaming completed
      console.log('[ClaudeChatInterface] Streaming completed, answer:', 
        streamedAnswer.substring(0, 50) + '...', 
        'thoughts:', currentThoughts.length);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error sending message:', error);
        setStreamError(error instanceof Error ? error.message : 'Unknown error');
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          variant: "destructive"
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [
    activeCaseId, 
    activeConversationId, 
    messages, 
    selectedDocumentIds, 
    session, 
    showThoughts, 
    setActiveConversationId, 
    queryClient,
    toast,
    activeEditorItem,
    preloadedContext,
    setPreloadedContext,
    deepResearchMode
  ]);
  
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      
      // If we have a partial response, save it
      if (streamedAnswer) {
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: streamedAnswer,
          responseType: responseMetadata.type,
          model: responseMetadata.model,
          thoughts: currentThoughts,
          sources: responseMetadata.sources,
          createdAt: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setStreamedAnswer('');
      }
      
      toast({
        title: "Generation Stopped",
        description: "The AI response generation was stopped",
      });
    }
  }, [streamedAnswer, responseMetadata, currentThoughts, toast]);

  const handleClaudeStream = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is null');
    
    const decoder = new TextDecoder();
    let buffer = '';
    let finalAnswer = '';
    
    let receivedComplete = false;
    let inThinkBlock = false; // New flag for deep research think block
    let thinkBlockContent = ''; // Buffer for think block content

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (line.startsWith('data:')) {
            try {
              const eventData = JSON.parse(line.substring(5).trim()) as StreamEvent;

              if (eventData.type === 'answer' && eventData.content) {
                let currentContentChunk = eventData.content;

                if (deepResearchMode) {
                  if (!inThinkBlock && currentContentChunk.startsWith('<think>')) {
                    inThinkBlock = true;
                    currentContentChunk = currentContentChunk.substring('<think>'.length);
                  }

                  if (inThinkBlock) {
                    const thinkEndIndex = currentContentChunk.indexOf('</think>');
                    if (thinkEndIndex !== -1) {
                      thinkBlockContent += currentContentChunk.substring(0, thinkEndIndex);
                      // Process completed think block
                      const newThoughts = thinkBlockContent.split('\n').filter(t => t.trim() !== '').map(t => ({ id: uuidv4(), content: t.trim() }));
                      if (newThoughts.length > 0) {
                        setCurrentThoughts(prev => [...prev, ...newThoughts]);
                      }
                      // Reset think block state
                      inThinkBlock = false;
                      thinkBlockContent = '';
                      // Remaining part of the chunk is actual answer
                      currentContentChunk = currentContentChunk.substring(thinkEndIndex + '</think>'.length);
                    } else {
                      // Still in think block, append content
                      thinkBlockContent += currentContentChunk;
                      currentContentChunk = ''; // Consume the chunk for think block
                    }
                  }
                }

                // If there's any content left (or not in deep research think block), add to final answer
                if (currentContentChunk) {
                  finalAnswer += currentContentChunk;
                  setStreamedAnswer(prev => prev + currentContentChunk); // Update live stream
                }

              } else if (eventData.type === 'thought' && eventData.content && !deepResearchMode) { // Original thought processing for Claude
                const thought = { id: uuidv4(), content: eventData.content };
                setCurrentThoughts(prev => [...prev, thought]);
              } else if (eventData.type === 'metadata') {
                setResponseMetadata({
                  type: eventData.responseType || (deepResearchMode ? 'deep_research' : 'simple'),
                  model: eventData.model || (deepResearchMode ? 'sonar-pro' : 'claude-3-5-sonnet'),
                  sources: eventData.sources || []
                });
              } else if (eventData.type === 'complete') {
                console.log('[ClaudeChatInterface] Received complete event');
                receivedComplete = true;
              } else if (eventData.type === 'error') {
                setStreamError(eventData.error || 'Unknown error during streaming');
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line, e);
            }
          }
        }
      }
      
      // After loop, if inThinkBlock is still true, it means </think> was not found.
      // Treat buffered thinkBlockContent as part of the answer or log a warning.
      if (inThinkBlock) {
        console.warn("Think block was not properly closed. Content:", thinkBlockContent);
        finalAnswer += thinkBlockContent; // Append to answer as fallback
        setStreamedAnswer(prev => prev + thinkBlockContent);
        inThinkBlock = false; // Reset
        thinkBlockContent = '';
      }

      // Stream is done, add the final AI message
      if (finalAnswer || receivedComplete) { // Ensure we save even if finalAnswer is empty but complete event came
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: finalAnswer || (streamError ? "Error generating response." : "No content received."),
          responseType: responseMetadata.type,
          model: responseMetadata.model,
          // For deep research, currentThoughts are populated by <think> block. For Claude, they are from 'thought' events.
          thoughts: currentThoughts.length > 0 ? [...currentThoughts] : undefined, 
          sources: responseMetadata.sources,
          createdAt: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        // Clear currentThoughts and streamedAnswer after assembling the full message
        setCurrentThoughts([]); 
        setStreamedAnswer(''); 
        
        // Save to database
        if (user) {
          const finalConversationId = latestConversationIdRef.current || activeConversationId;
          if (finalConversationId) {
            try {
              await supabase.from('messages').insert({
                id: assistantMessage.id,
                conversation_id: finalConversationId,
                role: 'assistant',
                content: finalAnswer,
                owner_id: user.id,
                model: responseMetadata.model,
                metadata: {
                  responseType: responseMetadata.type,
                  thoughts: currentThoughts.length > 0 ? currentThoughts : undefined,
                  sources: responseMetadata.sources
                }
              });
              
              queryClient.invalidateQueries({ 
                queryKey: ['messages', finalConversationId] 
              });
            } catch (error) {
              console.error('Error saving assistant message:', error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled the request
        console.log('Stream reading was aborted');
      } else {
        console.error('Stream processing error:', error);
        setStreamError(`Error processing response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  /**
   * Helper function to get a user-friendly label for the model
   */
  const getModelDisplayName = (model?: string): string => {
    if (!model) return 'Claude Router';
    
    // Model-specific labels
    if (model.includes('claude-3-7')) {
      return 'Claude 3 Opus';
    } else if (model.includes('claude-3-5-sonnet')) {
      return 'Claude 3 Sonnet';
    } else if (model.includes('claude-3-5-haiku')) {
      return 'Claude Router';
    } else {
      // Fallback to a nicely formatted version of the model name
      return model.split('-').slice(-2).join(' ');
    }
  };
  
  const processStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'metadata':
        console.log('Received metadata:', event);
        break;
      case 'answer':
        // Content processed in main loop
        console.log('Received answer fragment, length:', event.content?.length || 0);
        break;
      case 'thought':
        // Thoughts processed in main loop
        console.log('Received thought fragment');
        break;
      case 'complete':
        console.log('Message complete event received');
        // Ensure streamedAnswer is properly saved at completion
        if (streamedAnswer) {
          // Log the first part of the answer to verify it exists
          console.log('Final answer at complete:', streamedAnswer.substring(0, 50) + '...');
        }
        break;
      case 'error':
        console.error('Stream error:', event.error);
        setStreamError(event.error || 'Unknown error');
        break;
    }
  };

  // Effect to ensure proper initialization of the chat area height
  useEffect(() => {
    // Force a layout refresh
    const forceReflow = () => {
      if (scrollAreaRef.current) {
        // Access offsetHeight to force a reflow
        const height = scrollAreaRef.current.offsetHeight;
        console.log('Forcing chat area reflow, height:', height);
        scrollToBottom();
      }
    };
    
    // Run on mount
    forceReflow();
    
    // And also after a slight delay to ensure everything is rendered
    const timeoutId = setTimeout(() => {
      forceReflow();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className={cn(
      "flex flex-col h-full text-foreground dark:text-dark-foreground overflow-hidden", // Base classes, removed border-l and specific bg-background here
      deepResearchMode 
        ? "bg-orange-100/50 dark:bg-orange-900/30" // Tailwind classes for tint when active
        : "bg-background dark:bg-dark-background", // Original BGs when inactive
      deepResearchMode && "deep-research-visuals-active" // Keep a marker class if needed for other non-bg CSS, but bg is handled above
    )}>
      {/* Header for Chat Interface */}
      <div className="flex items-center justify-between p-2 border-b h-14 flex-shrink-0 border-border dark:border-dark-border">
        <div className="flex items-center gap-2">
          {/* <Brain className="h-6 w-6 text-primary dark:text-primary" /> */}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="deep-research-toggle"
              checked={deepResearchMode}
              onCheckedChange={setDeepResearchMode}
              aria-label="Toggle Deep Research Mode"
            />
            <Label 
              htmlFor="deep-research-toggle" 
              className={cn(
                "text-sm font-medium cursor-pointer",
                deepResearchMode 
                  ? "text-orange-600 dark:text-orange-400 font-bold" 
                  : "text-foreground dark:text-dark-foreground"
              )}
            >
              Deep Research
            </Label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Chat History" className="text-foreground dark:text-dark-foreground hover:bg-accent/50 dark:hover:bg-dark-accent/50">
                <History className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
              <ChatHistoryList />
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={startNewChat} title="Start New Chat" className="">
            <Plus className="h-4 w-4 mr-1" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-1 md:p-2 bg-background dark:bg-dark-background overflow-y-auto">
        <div className="space-y-3 pb-4">
          <>
            {isHistoryLoading && <ChatSkeletonLoader />} 
            {historyError && (
              <Alert variant="destructive" className="w-full">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{historyError}</AlertDescription>
              </Alert>
            )}
          </>
          {messages.length === 0 && !isHistoryLoading && !isStreaming && (
            <div className="text-center py-8 text-muted-foreground dark:text-dark-muted-foreground w-full">
              <p className="mb-2">No messages yet.</p>
              <p>Ask a legal question to get started.</p>
            </div>
          )}
          {messages.map((message) => (
            <ClaudeChatMessage
              key={message.id}
              id={message.id}
              role={message.role}
              content={message.content}
              responseType={message.responseType}
              model={message.model}
              thoughts={message.thoughts}
              sources={message.sources}
              createdAt={message.createdAt}
              metadata={message.metadata}
            />
          ))}
          
          {/* Skeleton loader for AI response - new position */}
          {isStreaming && !streamedAnswer && currentThoughts.length === 0 && messages.length > 0 && <ChatSkeletonLoader />}
          
          {/* Streaming thought process (if enabled and active) */}
          {isStreaming && showThoughts && currentThoughts.length > 0 && (
            <div className="mt-2">
              <LegalThinkingPanel thoughts={currentThoughts} isPending={true} />
            </div>
          )}

          {/* Display streamed answer as it comes in */}
          {isStreaming && streamedAnswer && (
            <div className="p-4 w-full max-w-full bg-transparent text-foreground dark:text-dark-foreground">
              <div className="flex items-start gap-4 w-full max-w-full">
                <div className="font-semibold">Legal Assistant</div>
                <div className="text-xs px-2 py-0.5 rounded ml-2 text-muted-foreground dark:text-dark-muted-foreground">
                  {getModelDisplayName(responseMetadata.model)}
                </div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none my-4 message-content-clickable-links">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownRenderers(theme)}>
                  {streamedAnswer}
                </ReactMarkdown>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-2 flex-shrink-0 bg-background dark:bg-dark-background dark:border-dark-border sticky bottom-0 z-10">
        {streamError && (
          <Alert variant="destructive" className="w-full mb-2">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{streamError}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-center mb-2 w-full">
          {isStreaming && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopGeneration}
              className="flex items-center"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop Generating
            </Button>
          )}
        </div>
        
        <ChatInput
          onSendMessage={handleSend}
          isLoading={isStreaming}
          stop={stopGeneration}
          isDisabled={isStreaming || authLoading}
          placeholder="Ask your legal question..."
          maxContextDocuments={10}
          selectedDocumentIds={Array.from(selectedDocumentIds)}
          onDocumentPickerOpen={() => setShowContextPicker(true)}
          preloadedContext={preloadedContext}
          clearPreloadedContext={() => setPreloadedContext(null)}
        />
      </div>

      {/* Document Context Picker Modal */}
      <Dialog open={showContextPicker} onOpenChange={setShowContextPicker}>
        <DialogContent className="max-w-lg p-0">
          <DocumentContextPicker onClose={() => setShowContextPicker(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClaudeChatInterface;
