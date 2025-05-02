import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversationsList, ConversationListItem } from '@/services/conversationService';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, activeConversationIdAtom } from '@/atoms/appAtoms';
import ChatHistoryItem from './ChatHistoryItem';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

const ChatHistoryList: React.FC = () => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [activeConversationId, setActiveConversationId] = useAtom(activeConversationIdAtom);
  const queryClient = useQueryClient();

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

  return (
    <div className="flex flex-col">
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
    </div>
  );
};

export default ChatHistoryList; 