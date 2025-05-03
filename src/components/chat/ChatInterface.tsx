import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from 'ai/react';
import { Loader2, SendHorizontal, StopCircle, X, Paperclip } from 'lucide-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { 
  activeCaseAtom,
  activeCaseIdAtom,
  activeConversationIdAtom,
  uploadModalOpenAtom,
  chatDocumentContextIdsAtom,
  chatPreloadContextAtom
} from '@/atoms/appAtoms';
import { getConversationMessages, saveMessage } from '@/services/messageService';
import { createConversation, getConversation } from '@/services/conversationService';
import { v4 as uuidv4 } from 'uuid';
import { MessageCircle, Wand2, PlusSquare } from 'lucide-react';
import ChatInput from './ChatInput';
import ChatMessage, { Message } from './ChatMessage';
import { Spinner } from '@/components/ui/Spinner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Icons } from "@/components/ui/Icons";
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { MAX_CONTEXT_DOCUMENTS } from '@/config/constants';
import type { Message as VercelMessage } from 'ai';
import { Message as DbMessage } from '@/types/db';

interface ChatInterfaceProps {
  conversationId?: string | null;
  onNewConversationStart?: (newId: string) => void;
}

interface PreloadContext {
  analysisItem: any;
  analysisType: string;
  documentText: string;
  documentId: string;
  documentName: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversationId: initialConversationId,
  onNewConversationStart,
}) => {
  const { toast: useToastToast } = useToast();
  const { user, session, loading: authLoading } = useAuth();
  const selectedCaseDetails = useAtomValue(activeCaseAtom).details;
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const queryClient = useQueryClient();

  const [currentConversationId, setCurrentConversationId] = useState<string | null | undefined>(initialConversationId);
  const latestConversationIdRef = useRef<string | null | undefined>(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useAtom(chatDocumentContextIdsAtom);
  const [preloadedContext, setPreloadedContext] = useAtom(chatPreloadContextAtom);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isAiLoading,
    error: aiError,
    stop,
    setMessages,
    reload,
    append,
  } = useChat({
    api: '/api/supabase/generic-chat-agent',
    id: currentConversationId || undefined,
    initialMessages: [],
    body: {
      caseId: activeCaseId,
      documentContextIds: selectedDocumentIds,
    },
    headers: {
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : ''
    },
    onResponse: (response) => {
      if (response.ok) {
        const newConvId = response.headers.get('X-Conversation-Id');
        if (newConvId && !currentConversationId) {
          console.log("New conversation started, ID:", newConvId);
          setCurrentConversationId(newConvId);
          latestConversationIdRef.current = newConvId;
          if (onNewConversationStart) {
            onNewConversationStart(newConvId);
          }
          queryClient.invalidateQueries({ queryKey: ['conversations', activeCaseId] });
        }
      } else {
        console.error("API response error:", response.statusText);
      }
    },
    onFinish: async (message) => {
      const finalConversationId = latestConversationIdRef.current;
      console.log(`AI finished responding for conversation ${finalConversationId}. Saving assistant message (Vercel ID: ${message.id}):`, message);
      if (finalConversationId && user) {
        const dbMessageId = uuidv4();
        console.log(`Generated new UUID for DB message: ${dbMessageId}`);

        const assistantMessageToSave: DbMessage = {
          id: dbMessageId,
          conversation_id: finalConversationId,
          role: 'assistant',
          content: message.content,
          sender_id: user.id,
          created_at: message.createdAt?.toISOString() || new Date().toISOString(),
          document_context: selectedDocumentIds.length > 0 ? selectedDocumentIds.join(',') : undefined,
        };
        try {
          const { data: savedMsg, error: saveError } = await saveMessage(assistantMessageToSave);
          if (saveError) {
            console.error("Error saving assistant message:", saveError);
            useToastToast({ title: "Save Error", description: "Failed to save assistant's response.", variant: "destructive" });
          } else {
            console.log("Assistant message saved to DB:", savedMsg?.id);
          }
        } catch (error) {
          console.error("Exception saving assistant message:", error);
          useToastToast({ title: "Save Error", description: "An unexpected error occurred while saving the response.", variant: "destructive" });
        }
      } else {
        console.warn("Could not save assistant message: Missing conversationId or userId.", { finalConversationId, userExists: !!user });
      }
      scrollToBottom();
      if (finalConversationId) {
        console.log(`Invalidating messages query for conversation: ${finalConversationId}`);
        queryClient.invalidateQueries({ queryKey: ['messages', finalConversationId] });
      }
    },
    onError: (error) => {
      console.error("Chat API Error:", error);
      useToastToast({
        variant: "destructive",
        title: "Chat Error",
        description: error.message || "An error occurred while communicating with the AI.",
      });
    },
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const handleSend = useCallback((messageContent: string) => {
    if (!activeCaseId) return;
    if (!messageContent.trim() && selectedDocumentIds.length === 0) return;

    const tempUserMessage: VercelMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent
    };
    
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
    const idToSend = latestConversationIdRef.current;

    console.log(`Sending programmatic message for conversation: ${idToSend ?? 'NEW'} | Case ID (in hook body): ${activeCaseId}`);
    
    append(tempUserMessage, {
        options: {
            body: {
              conversationId: idToSend,
              caseId: activeCaseId,
              documentContextIds: selectedDocumentIds,
            }
        }
    });

    scrollToBottom();
  }, [activeCaseId, selectedDocumentIds, append, scrollToBottom]);

  useEffect(() => {
    setCurrentConversationId(initialConversationId);
    setMessages([]);
    setConversationTitle(initialConversationId ? 'Loading...' : 'New Chat');
    setHistoryError(null);

    if (initialConversationId) {
      setIsHistoryLoading(true);
      console.log(`Fetching history for conversation: ${initialConversationId}`);

      const fetchHistory = async () => {
        try {
          const { data: convData, error: convError } = await getConversation(initialConversationId);
          if (convError || !convData) {
            throw convError || new Error("Conversation not found.");
          }
          setConversationTitle(convData.title || `Chat ${initialConversationId.substring(0, 8)}`);

          const { data: historyData, error: historyError } = await getConversationMessages(initialConversationId);

          if (historyError) {
            throw historyError;
          }

          if (historyData) {
            console.log(`Fetched ${historyData.length} messages.`);
            const formattedMessages = historyData.map((msg): Message => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              createdAt: msg.created_at,
              model: msg.model,
              documentContext: msg.document_context,
            }));
            setMessages(formattedMessages);
          } else {
            setMessages([]);
          }
        } catch (err: any) {
          console.error("Error fetching conversation history:", err);
          setHistoryError(err.message || "Failed to load chat history.");
          useToastToast({
            variant: "destructive",
            title: "Load Error",
            description: err.message || "Failed to load chat history.",
          });
        } finally {
          setIsHistoryLoading(false);
        }
      };
      fetchHistory();
    } else {
      setMessages([]);
      setIsHistoryLoading(false);
    }
  }, [initialConversationId, setMessages, useToastToast]);

  useEffect(() => {
    if (preloadedContext) {
      console.log('ChatInterface detected preloaded context:', preloadedContext);
      
      let contextMessage = `Let's discuss the ${preloadedContext.analysisType} from the document "${preloadedContext.documentName}".`;
      
      if (preloadedContext.analysisType === 'risks' && preloadedContext.analysisItem.title) {
        contextMessage += `\n\nRisk: ${preloadedContext.analysisItem.title}\nSeverity: ${preloadedContext.analysisItem.severity}\nExplanation: ${preloadedContext.analysisItem.explanation}`;
      } else if (preloadedContext.analysisType === 'clauses' && preloadedContext.analysisItem.title) {
         contextMessage += `\n\nClause: ${preloadedContext.analysisItem.title}\nText: ${preloadedContext.analysisItem.text}`;
      } else {
        contextMessage += `\n\nDetails:\n\`\`\`json\n${JSON.stringify(preloadedContext.analysisItem, null, 2)}\`\`\`\n`;
      }

      handleSend(contextMessage);

      setPreloadedContext(null);
    }
  }, [preloadedContext, setPreloadedContext, handleSend]);

  useEffect(() => {
    if (!isHistoryLoading) {
      scrollToBottom();
    }
  }, [messages.length, isHistoryLoading, scrollToBottom]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeCaseId) {
      useToastToast({ title: "No Case Selected", description: "Please select a case before sending a message.", variant: "destructive" });
      return;
    }
    if (!input.trim() && selectedDocumentIds.length === 0) {
      useToastToast({ title: "Empty message", description: "Please enter a message or select documents.", variant: "destructive" });
      return;
    }
    const idToSend = latestConversationIdRef.current;
    console.log(`Submitting message for conversation: ${idToSend ?? 'NEW'} | Case ID (in hook body): ${activeCaseId}`);
    handleSubmit(e, {
      options: {
        body: {
          conversationId: idToSend,
        }
      }
    });
    scrollToBottom();
  };

  const handleDocumentSelection = (docIds: string[]) => {
    setSelectedDocumentIds(docIds);
    console.log("Selected document IDs updated:", docIds);
  };

  const renderMessages = () => {
    if (isHistoryLoading) {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-16 w-1/2 ml-auto" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    if (historyError) {
      return <div className="p-4 text-center text-red-600">{historyError}</div>;
    }

    if (!isHistoryLoading && messages.length === 0 && currentConversationId) {
      return <div className="p-4 text-center text-gray-500">No messages in this conversation yet.</div>;
    }

    if (!isHistoryLoading && messages.length === 0 && !currentConversationId) {
      return <div className="p-4 text-center text-gray-500">Start the conversation by sending a message or selecting documents.</div>;
    }

    const displayMessages = messages.filter(m => m.role !== 'system');

    return displayMessages.map((message, index) => (
      <ChatMessage
        key={message.id || `msg-${index}`}
        message={message as Message}
      />
    ));
  };

  const isLoading = isHistoryLoading || isAiLoading || authLoading;
  const isInputDisabled = !activeCaseId || !user || authLoading || isLoading;
  const placeholderText = authLoading
    ? "Checking auth..."
    : !user
    ? "Please log in first"
    : activeCaseId
    ? "Ask BenchWise anything..."
    : "Please select a case first";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold truncate pr-2" title={conversationTitle}>
            {conversationTitle}
          </h2>
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {renderMessages()}
            {isAiLoading && (
              <ChatMessage
                message={{
                  id: 'loading-indicator',
                  role: 'assistant',
                  content: '',
                  createdAt: new Date().toISOString(),
                  isLoading: true,
                }}
              />
            )}
            {aiError && (
                <ChatMessage
                message={{
                  id: 'error-indicator',
                  role: 'error',
                  content: `Error: ${aiError.message}`,
                  createdAt: new Date().toISOString(),
                }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <Separator />

        <div className="p-0 border-t">
        <ChatInput 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleFormSubmit}
            isLoading={isAiLoading} 
            stop={stop}
            isDisabled={isInputDisabled}
            placeholder={placeholderText}
            activeCaseId={activeCaseId}
            selectedDocumentIds={selectedDocumentIds}
            handleDocumentSelection={handleDocumentSelection}
            maxContextDocuments={MAX_CONTEXT_DOCUMENTS}
          />
        </div>
    </div>
    </TooltipProvider>
  );
};

export default ChatInterface;