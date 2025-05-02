import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { 
  activeCaseIdAtom,
  activeDocumentContextIdAtom,
  activeConversationIdAtom,
  uploadModalOpenAtom
} from '@/atoms/appAtoms';
import { getConversationMessages, saveMessage } from '@/services/messageService';
import { createConversation } from '@/services/conversationService';
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

interface ChatInterfaceProps {
  onInsertContent?: (content: string) => void;
  initialInput?: string;
}

interface ChatFunctionResponse {
  content?: string;
  error?: string;
}

// Type for the payload received from ChatInput
interface SendMessagePayload {
  content: string;
  documentId: string | null;
  agent: string;
  context?: {
    documentText: string;
    analysisItem: any;
    analysisType: string;
  } | null;
}

function ChatInterface({ onInsertContent, initialInput }: ChatInterfaceProps) {
  const [activeConversationId, setActiveConversationId] = useAtom(activeConversationIdAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const activeDocumentContextId = useAtomValue(activeDocumentContextIdAtom);

  const activeCaseId = useAtomValue(activeCaseIdAtom);

  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevActiveConversationIdRef = useRef<string | null | undefined>(undefined);

  const howToUseTips = [
      { icon: <MessageCircle className="h-6 w-6 text-primary" />, title: 'Ask Anything', desc: 'Ask questions about the current document or general legal topics.', example: 'Summarize this document.' },
      { icon: <Wand2 className="h-6 w-6 text-purple-400" />, title: 'Use Commands', desc: 'Type / for helpful commands (Note: complex commands may be disabled).', example: '/research ...' },
  ];

  const resetChat = useCallback(() => {
    console.log('Resetting chat state (likely due to atom change)...');
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setIsLoadingHistory(false);
  }, []);

  const fetchMessages = useCallback(async (convId: string | null | undefined) => {
    if (!convId) {
        resetChat();
        console.log('No active conversation ID, resetting chat.');
        return;
    }
    console.log('Fetching messages for conversation (from atom):', convId);
    setIsLoadingHistory(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getConversationMessages(convId);
      if (fetchError) throw fetchError;
      
      const formattedMessages = (data || []).map(msg => ({
        ...msg,
        id: msg.id || uuidv4(),
        timestamp: msg.timestamp || new Date().toISOString(),
        isStreaming: false,
        isLoading: false,
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
    const prevId = prevActiveConversationIdRef.current;
    console.log(`ChatInterface: activeConversationId ATOM changed from ${prevId} to: ${activeConversationId}`);

    // Simplified: Always fetch if the ID is valid and different from the previous ref
    // This handles initial load and external changes.
    // Redundant fetch after creation in handleSendMessage is acceptable for simplicity.
    if (activeConversationId && activeConversationId !== prevId) {
        console.log('Fetching messages based on atom change.');
        fetchMessages(activeConversationId);
    }
    // Handle case where conversation is cleared
    if (!activeConversationId && prevId) {
        console.log('Conversation cleared, resetting chat.');
        resetChat();
    }

    prevActiveConversationIdRef.current = activeConversationId;

  }, [activeConversationId, fetchMessages, resetChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prevMessages => {
      if (prevMessages.some(m => m.id === message.id)) {
        return prevMessages;
      }
      return [...prevMessages, message];
    });
  }, []);

  const handleSendMessage = useCallback(async (payload: SendMessagePayload) => {
    const { content, documentId, agent, context } = payload;

    if (!content.trim() || isLoading) return;

    const docContextIdForMessage = documentId ?? activeDocumentContextId;
    
    let currentMessages = messages; // Capture current messages state
    let conversationId = activeConversationId;

    setIsLoading(true);
    setError(null);

    // Prepare user message details
    const userMessageDetails = {
      id: uuidv4(),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
      ...(docContextIdForMessage && { documentContext: docContextIdForMessage }),
    };

    // --- Conversation Creation Logic --- 
    if (!conversationId) {
      if (!activeCaseId) {
        setError("Cannot create conversation without an active case.");
        setIsLoading(false);
        return;
      }
      try {
        console.log('Creating new conversation...');
        const { data: newConv, error: createError } = await createConversation(activeCaseId, content.substring(0, 50));
        if (createError) throw createError;
        if (!newConv?.id) throw new Error('Failed to create conversation or get ID.');
        
        conversationId = newConv.id;
        console.log('New conversation created:', conversationId);
        
        // Update user message with the new ID
        const userMessageWithConvId: Message = { ...userMessageDetails, conversation_id: conversationId };

        // Update local state DIRECTLY
        setMessages([userMessageWithConvId]); // Start new history with this message
        currentMessages = [userMessageWithConvId]; // Update local variable for history prep
        
        // Set the global atom
        setActiveConversationId(conversationId);
        
        // Save the user message to DB
        saveMessage(userMessageWithConvId).catch(err => console.error("Failed to save user message after new conv creation:", err));
        
        // **CONTINUE execution within this function**

      } catch (err) {
        console.error('Error creating conversation:', err);
        setError(err instanceof Error ? err.message : 'Could not start new conversation.');
        setIsLoading(false);
        // No optimistic message added yet in this flow, so no cleanup needed here
        return;
      }
    } else {
      // Conversation already exists
      const userMessageExistingConv: Message = { ...userMessageDetails, conversation_id: conversationId };
      
      // Add user message to existing local state
      setMessages(prev => [...prev, userMessageExistingConv]);
      currentMessages = [...messages, userMessageExistingConv]; // Update local variable

      // Save user message to DB
      saveMessage(userMessageExistingConv).catch(err => console.error("Failed to save user message for existing conv:", err));
    }
    
    // --- AI Message Sending Logic (Now runs for both new and existing conv) ---
    
    // Prepare history using the updated `currentMessages` variable
    const historyForBackend = currentMessages
      // Ensure filtering by the correct final conversationId
      .filter(m => m.conversation_id === conversationId) 
      .map(msg => ({ role: msg.role, content: msg.content }));

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<ChatFunctionResponse>(
        'generic-chat-agent',
        {
          body: {
            messages: historyForBackend,
            modelId: agent ?? undefined,
            analysisContext: context ?? undefined,
            documentContext: docContextIdForMessage ? [docContextIdForMessage] : undefined,
            caseId: activeCaseId ?? undefined,
            // Pass conversationId explicitly if needed by backend 
            conversationId: conversationId ?? undefined,
          },
        }
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.content) throw new Error('No content received from AI.');

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        conversation_id: conversationId,
        ...(docContextIdForMessage && { documentContext: docContextIdForMessage }),
      };
      
      // Add assistant message to local state
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to DB
      saveMessage(assistantMessage).catch(err => console.error("Failed to save assistant message:", err));

    } catch (err) {
       console.error('Error during AI call:', err);
       const messageText = err instanceof Error ? err.message : 'An unknown error occurred.';
       setError(`Assistant error: ${messageText}`);
       // Optionally add an error message to the chat UI
       const errorMessage: Message = {
         id: uuidv4(),
         role: 'assistant',
         content: `Sorry, I encountered an error: ${messageText}`,
         timestamp: new Date().toISOString(),
         conversation_id: conversationId,
         isError: true, // Add flag if needed for styling
       };
       setMessages(prev => [...prev, errorMessage]);
    } finally {
       setIsLoading(false);
    }
  }, [activeCaseId, activeConversationId, activeDocumentContextId, isLoading, messages, setActiveConversationId]); // Added dependencies

  const handleEditMessage = (messageId: string, newContent: string) => {
    console.log(`Editing message ${messageId} to: ${newContent}`);
    setMessages(prevMessages =>
      prevMessages.map(message =>
        message.id === messageId ? { ...message, content: newContent } : message
      )
    );
  };

  const handleRegenerateResponse = (messageId: string) => {
    const assistantMessageIndex = messages.findIndex(msg => msg.id === messageId && msg.role === 'assistant');
    if (assistantMessageIndex > 0) {
      const userMessageToResend = messages[assistantMessageIndex - 1];
      if (userMessageToResend.role === 'user') {
        setMessages(prev => prev.slice(0, assistantMessageIndex));
        handleSendMessage({
            content: userMessageToResend.content,
            documentId: userMessageToResend.documentContext || null,
            agent: 'default-chat'
        });
      } else {
         toast.error('Cannot regenerate response for the first message.');
      }
    } else {
         toast.error('Could not find the message to regenerate.');
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => toast.success('Copied to clipboard!'))
      .catch(() => toast.error('Failed to copy text.'));
  };

  const handleInsertToEditor = (content: string) => {
    if (onInsertContent) {
      onInsertContent(content);
      toast.success('Content inserted into editor.');
    } else {
      toast.error('Cannot insert content: No editor connection.');
    }
  };

  const handleFileUpload = (files: File[]) => {
      console.log("Files selected in chat input:", files);
      setUploadModalOpen(true);
  };

  const showEmptyState = messages.length === 0 && !isLoadingHistory && !error;

  const handleNewChatClick = () => {
      console.log("New Chat button clicked, setting active ID to null");
      setActiveConversationId(null);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b">
            <h2 className="text-lg font-semibold">Chat</h2>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNewChatClick} 
                title="New Chat"
            >
                <PlusSquare className="h-5 w-5" />
            </Button>
        </div>
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
            {isLoading && (
                <div className="flex items-start space-x-2 pl-2 pr-4">
                    <div className={cn(
                        'flex-shrink-0 mt-1 font-medium text-xs uppercase tracking-wider text-muted-foreground'
                    )}>
                        AI
                    </div>
                    <div className="flex items-center space-x-1 py-2">
                        <Spinner size="sm" />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </ScrollArea>
        
        <ChatInput 
            onSendMessage={handleSendMessage} 
            disabled={isLoading || isLoadingHistory} 
            initialValue={initialInput}
            isLoading={isLoading}
            onFileUpload={handleFileUpload}
        />
    </div>
  );
}

export default ChatInterface;