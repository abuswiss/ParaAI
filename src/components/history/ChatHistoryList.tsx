import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversationsList, ConversationListItem, deleteAllUserConversations } from '@/services/conversationService';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, activeConversationIdAtom } from '@/atoms/appAtoms';
import ChatHistoryItem from './ChatHistoryItem';
import { Button, buttonVariants } from '@/components/ui/Button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Spinner } from '@/components/ui/Spinner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { useStartNewChat } from '@/hooks/useStartNewChat';

const ChatHistoryList: React.FC = () => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [activeConversationId, setActiveConversationId] = useAtom(activeConversationIdAtom);
  const queryClient = useQueryClient();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const startNewChat = useStartNewChat();

  const { data: conversations, isLoading, error: fetchError, refetch } = useQuery<ConversationListItem[], Error>({
    queryKey: ['conversationsList', activeCaseId],
    queryFn: () => {
      if (!activeCaseId) return Promise.resolve([]);
      return getConversationsList(activeCaseId).then(result => {
          if (result.error) throw result.error;
          return result.data || [];
      });
    },
    enabled: !!activeCaseId,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const handleNewChat = () => {
    console.log('Setting active conversation to null (New Chat)');
    setActiveConversationId(null);
  };

  const handleDeleteSuccess = (deletedId: string) => {
    refetch();
    if (activeConversationId === deletedId) {
      console.log('Deleted conversation was active, resetting active ID.');
      setActiveConversationId(null);
    }
  };

  const handleClearAllConfirm = async () => {
    setIsDeletingAll(true);
    setDeleteError(null);
    try {
        const { success, deletedCount, error: apiDeleteError } = await deleteAllUserConversations();
        if (success) {
            toast({ 
                title: "History Cleared", 
                description: `${deletedCount ?? 0} conversation(s) deleted.` 
            });
            setActiveConversationId(null);
            refetch();
        } else {
            throw apiDeleteError || new Error('Failed to clear history.');
        }
    } catch (err) {
        console.error('Error clearing all conversations:', err);
        const message = err instanceof Error ? err.message : 'Could not clear history.';
        setDeleteError(message);
        toast({ 
            title: "Error", 
            description: message, 
            variant: "destructive"
        });
    } finally {
        setIsDeletingAll(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex justify-between items-center border-b border-border dark:border-dark-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground dark:text-dark-muted-foreground tracking-wider">Chat History</h3>
        <Button variant="ghost" size="sm" onClick={startNewChat} title="New Chat" className="text-muted-foreground dark:text-dark-muted-foreground hover:text-primary dark:hover:text-primary">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-border dark:scrollbar-thumb-dark-border scrollbar-track-transparent">
        <div className="flex flex-col gap-1 px-2 py-1">
          {isLoading && <p className="px-2 py-1 text-sm text-muted-foreground dark:text-dark-muted-foreground">Loading...</p>}
          {fetchError && <p className="px-2 py-1 text-sm text-destructive dark:text-dark-destructive">Error loading history: {fetchError.message}</p>}
          {deleteError && <p className="px-2 py-1 text-sm text-destructive dark:text-dark-destructive">Deletion Error: {deleteError}</p>}
          {!isLoading && !fetchError && conversations?.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground dark:text-dark-muted-foreground">No chat history yet.</p>
          )}
          {conversations &&
            conversations
              .map((conv) => (
                <ChatHistoryItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversationId === conv.id}
                  onDeleteSuccess={() => handleDeleteSuccess(conv.id)}
                />
              ))}
        </div>
      </div>

      {!isLoading && conversations && conversations.length > 0 && (
        <div className="p-2 border-t border-border dark:border-dark-border mt-auto">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        variant="destructive"
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={isDeletingAll}
                    >
                        {isDeletingAll ? <Spinner size="xs" className="mr-1"/> : <Trash2 className="h-3 w-3 mr-1" />} 
                        Clear All History
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground dark:text-dark-muted-foreground">
                        This action cannot be undone. This will permanently delete all your conversation history.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleClearAllConfirm}
                        disabled={isDeletingAll}
                    >
                        {isDeletingAll ? <Spinner size="xs" /> : "Yes, delete all"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      )}
    </div>
  );
};

export default ChatHistoryList; 