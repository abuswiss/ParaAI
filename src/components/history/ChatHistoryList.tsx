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

const ChatHistoryList: React.FC = () => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [activeConversationId, setActiveConversationId] = useAtom(activeConversationIdAtom);
  const queryClient = useQueryClient();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { toast } = useToast();

  const { data: conversations, isLoading, error, refetch } = useQuery<ConversationListItem[], Error>({
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
    setError(null);
    try {
        const { success, deletedCount, error: deleteError } = await deleteAllUserConversations();
        if (success) {
            toast({ 
                title: "History Cleared", 
                description: `${deletedCount ?? 0} conversation(s) deleted.` 
            });
            setActiveConversationId(null);
            refetch();
        } else {
            throw deleteError || new Error('Failed to clear history.');
        }
    } catch (err) {
        console.error('Error clearing all conversations:', err);
        setError(err instanceof Error ? err.message : 'Could not clear history.');
        toast({ 
            title: "Error", 
            description: err instanceof Error ? err.message : 'Could not clear history.', 
            variant: "destructive"
        });
    } finally {
        setIsDeletingAll(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="p-2 flex justify-between items-center border-b">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Chat History</h3>
        <Button variant="ghost" size="sm" onClick={handleNewChat} title="New Chat">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="flex flex-col gap-1 px-2 py-1">
          {isLoading && <p className="px-2 py-1 text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="px-2 py-1 text-sm text-destructive">Error loading history: {error.message}</p>}
          {!isLoading && !error && conversations?.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">No chat history yet.</p>
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
        <div className="p-2 border-t mt-auto">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        variant="destructive" 
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
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all your conversation history.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleClearAllConfirm}
                        className={cn(buttonVariants({ variant: "destructive" }))}
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