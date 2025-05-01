import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { 
  resetChatTriggerAtom,
  activeCaseIdAtom,
  activeDocumentContextIdAtom,
  addTaskAtom,
  updateTaskAtom,
  removeTaskAtom,
  uploadModalOpenAtom
} from '@/atoms/appAtoms';
import { parseCommand } from '@/lib/commandParser';
import { handleUserTurn } from '@/lib/taskDispatcher';
import { Task } from '@/lib/commandParser';
import { getConversationMessages } from '@/services/chatService';
import { v4 as uuidv4 } from 'uuid';
import { MessageCircle, Wand2 } from 'lucide-react';
import ChatInput from './ChatInput';
import ChatMessage, { Message } from './ChatMessage';
import { Spinner } from '@/components/ui/Spinner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Icons } from "@/components/ui/Icons";
import { toast } from 'react-hot-toast';

interface ChatInterfaceProps {
  conversationId?: string;
  documentId?: string;
  onInsertContent?: (content: string) => void;
  initialInput?: string;
}

function ChatInterface({ 
  conversationId: initialConversationId,
  documentId: initialDocumentContextId,
  onInsertContent,
  initialInput
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const activeDocIdFromAtom = useAtomValue(activeDocumentContextIdAtom);
  const initialContextId = initialDocumentContextId ?? activeDocIdFromAtom;
  const [currentDocumentContextId, setCurrentDocumentContextId] = useState<string | null>(initialContextId);

  const navigate = useNavigate();
  const activeCaseId = useAtomValue(activeCaseIdAtom);

  const addTask = useSetAtom(addTaskAtom);
  const updateTask = useSetAtom(updateTaskAtom);
  const removeTask = useSetAtom(removeTaskAtom);
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resetTriggerValue = useAtomValue(resetChatTriggerAtom);
  const isInitialMount = useRef(true);

  const howToUseTips = [
      { icon: <MessageCircle className="h-6 w-6 text-primary" />, title: 'Ask Anything', desc: 'Ask questions about the current document or general legal topics.', example: 'Summarize this document.' },
      { icon: <Wand2 className="h-6 w-6 text-purple-400" />, title: 'Use Commands', desc: 'Type / for helpful commands.', example: '/research ...' },
  ];

  const resetChat = useCallback(() => {
    console.log('Resetting chat state...');
    setMessages([]);
    setError(null);
    setIsSendingMessage(false);
    setActiveConversationId(undefined);
    setIsLoadingHistory(false);
    setCurrentDocumentContextId(initialContextId);
  }, [initialContextId]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (resetTriggerValue > 0) {
      console.log('Reset chat triggered by atom change.');
      resetChat();
    }
  }, [resetTriggerValue, resetChat]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId || conversationId === 'new') {
        resetChat();
        return;
    }
    console.log('Fetching messages for conversation:', conversationId);
    setIsLoadingHistory(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getConversationMessages(conversationId);
      if (fetchError) throw fetchError;
      
      const formattedMessages = (data || []).map(msg => ({
        ...msg,
        id: msg.id || uuidv4(),
        timestamp: msg.timestamp || new Date().toISOString(),
      }));
      setMessages(formattedMessages);
    } catch (error: unknown) {
      console.error('Error fetching messages:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to load conversation: ${message}`);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [resetChat]);

  useEffect(() => {
    console.log('ChatInterface: conversationId prop changed to:', initialConversationId);
    setActiveConversationId(initialConversationId);
    fetchMessages(initialConversationId || 'new');
    const newEffectiveInitialContextId = initialDocumentContextId ?? activeDocIdFromAtom;
    if (newEffectiveInitialContextId !== currentDocumentContextId) {
        setCurrentDocumentContextId(newEffectiveInitialContextId);
    }
  }, [initialConversationId, initialDocumentContextId, activeDocIdFromAtom, fetchMessages, currentDocumentContextId]);

  useEffect(() => {
    if (!isSendingMessage) { 
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSendingMessage]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prevMessages => {
      if (prevMessages.some(m => m.id === message.id)) {
        return prevMessages;
      }
      return [...prevMessages, message];
    });
  }, []);

  const updateStreamingMessage = useCallback((chunk: string) => {
      setMessages(prevMessages => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
              return [
                  ...prevMessages.slice(0, -1),
                  {
                      ...lastMessage,
                      content: lastMessage.content + chunk,
                      documentContext: lastMessage.documentContext,
                  },
              ];
          } else {
              console.warn('UpdateStreamingMessage called without a streaming message present.');
              const assistantMessage: Message = {
                  id: uuidv4(), 
                  role: 'assistant',
                  content: chunk,
                  timestamp: new Date().toISOString(),
                  isStreaming: true,
                  conversation_id: activeConversationId,
                  ...(currentDocumentContextId && { documentContext: currentDocumentContextId })
              };
              return [...prevMessages, assistantMessage];
          }
      });
  }, [activeConversationId, currentDocumentContextId]);

  const finalizeStreamingMessage = useCallback(() => {
        setMessages(prevMessages => {
            const lastMessageIndex = prevMessages.length - 1;
            if (lastMessageIndex >= 0 && prevMessages[lastMessageIndex].isStreaming) {
                const updatedMessages = [...prevMessages];
                updatedMessages[lastMessageIndex] = {
                    ...updatedMessages[lastMessageIndex],
                    isStreaming: false,
                    documentContext: updatedMessages[lastMessageIndex].documentContext,
                };
                return updatedMessages;
            }
            return prevMessages;
        });
    }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    setError(null);

    const currentConversationId = activeConversationId;

    const contextIdToUse = currentDocumentContextId;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      conversation_id: currentConversationId,
      ...(contextIdToUse && { documentContext: contextIdToUse })
    };
    addMessage(userMessage);

    const assistantMessageId = uuidv4();
    const assistantPlaceHolder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      conversation_id: currentConversationId,
      ...(contextIdToUse && { documentContext: contextIdToUse })
    };
    addMessage(assistantPlaceHolder);

    const command = parseCommand(content);
    const task: Task = command;

    try {
      const dispatcherResponse = await handleUserTurn({
        task,
        message: content, 
        onChunk: updateStreamingMessage, 
        conversationId: currentConversationId, 
        caseId: activeCaseId || undefined,
        documentContext: contextIdToUse ? [contextIdToUse] : undefined,
        navigate,
        setActiveDocumentId: (id: string | null) => { console.log("Dummy setActiveDocumentId called with:", id); },
        params: {
          addTask,
          updateTask,
          removeTask,
          wsContext: undefined,
        }
      });

      if (!dispatcherResponse.success) {
         console.error('Dispatcher error:', dispatcherResponse.error);
         const errorMsg = dispatcherResponse.error instanceof Error ? dispatcherResponse.error.message : 'Task failed';
         setMessages(prev => prev.map(m => 
           m.id === assistantMessageId ? { ...m, content: `Error: ${errorMsg}`, isStreaming: false, role: 'error' } : m
         ));
      } else {
          setMessages(prev => {
             const lastMsg = prev[prev.length - 1];
             if (lastMsg?.id === assistantMessageId && lastMsg?.content === '') {
                 return prev.slice(0, -1);
             }
             return prev;
          });
      }
    } catch (err: unknown) {
      console.error('Error handling user turn:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error processing message: ${message}`);
       setMessages(prev => prev.map(m => 
         m.id === assistantMessageId ? { ...m, content: `Error: ${message}`, isStreaming: false, role: 'error' } : m
       ));
    } finally {
      finalizeStreamingMessage();
      setIsSendingMessage(false);
    }
  }, [ 
      isSendingMessage, 
      currentDocumentContextId, 
      activeConversationId, 
      addMessage, 
      activeCaseId, 
      navigate,
      updateStreamingMessage, 
      finalizeStreamingMessage,
      addTask,
      updateTask,
      removeTask
  ]);

  const handleContextChange = useCallback((contextId: string | null) => {
      console.log("ChatInterface: Context changed via picker to:", contextId);
      setCurrentDocumentContextId(contextId);
  }, []);

  const handleEditMessage = (messageId: string, newContent: string) => {
    console.log(`Editing message ${messageId} to: ${newContent}`);
    setMessages(prevMessages =>
      prevMessages.map(message =>
        message.id === messageId ? { ...message, content: newContent } : message
      )
    );
  };

  const handleRegenerateResponse = (messageId: string) => {
    console.log('Regenerating response for message:', messageId);
    toast('Regenerate response not implemented yet.');
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(err => {
      toast.error('Failed to copy!');
      console.error('Clipboard copy failed:', err);
    });
  };

  const handleInsertToEditor = (content: string) => {
      if (onInsertContent) {
          onInsertContent(content);
      } else {
          console.warn('onInsertContent prop not provided to ChatInterface');
      }
  };

  const handleFileUpload = (files: File[]) => {
      console.log("Files selected in chat input:", files);
      setUploadModalOpen(true);
  };

  const showEmptyState = messages.length === 0 && !isLoadingHistory && !error;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
        <ScrollArea className="flex-grow p-4 space-y-4">
            {isLoadingHistory && (
                 <div className="flex justify-center items-center h-full">
                    <Spinner />
                 </div>
            )}
            {!isLoadingHistory && error && (
                <Alert variant="destructive" className="m-4">
                    <Icons.Alert className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
             {!isLoadingHistory && !error && messages.map((msg, index) => (
                <ChatMessage
                    key={msg.id || index}
                    message={msg}
                    isStreaming={msg.isStreaming && index === messages.length - 1}
                    onEditMessage={handleEditMessage}
                    onRegenerateResponse={handleRegenerateResponse}
                    onCopyContent={handleCopyContent}
                    onInsertContent={onInsertContent ? handleInsertToEditor : undefined}
                />
            ))}
             {showEmptyState && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Icons.Message className="h-16 w-16 text-muted-foreground/50 mb-6" />
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Start Chatting</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                        Ask questions, use commands, or interact with your document context.
                    </p>
                    <div className="space-y-3 w-full max-w-sm">
                         {howToUseTips.slice(0, 2).map(tip => (
                             <div key={tip.title} className="flex items-start p-3 bg-muted/30 rounded-md border border-border/50">
                                {tip.icon && <div className="mr-3 mt-1 flex-shrink-0">{tip.icon}</div>}
                                <div>
                                     <p className="text-sm font-medium text-foreground mb-0.5">{tip.title}</p>
                                     <p className="text-xs text-muted-foreground">{tip.desc}</p>
                                </div>
                            </div>
                         ))}
                    </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
        </ScrollArea>
        
        <ChatInput 
            onSendMessage={handleSendMessage} 
            disabled={isSendingMessage || isLoadingHistory} 
            currentContextId={currentDocumentContextId}
            onContextChange={handleContextChange}
            initialValue={initialInput}
            isLoading={isSendingMessage}
            onInsertContent={onInsertContent}
            onFileUpload={handleFileUpload}
        />
    </div>
  );
}

export default ChatInterface;