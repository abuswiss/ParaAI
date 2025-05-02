import React, { useState } from 'react';
// Remove NavLink/useNavigate, use Button or div instead
// import { NavLink, useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai'; // Import useSetAtom
import { activeConversationIdAtom } from '@/atoms/appAtoms'; // Import atom
import { ConversationListItem } from '@/types/conversation';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteConversation } from '@/services/conversationService';
import { useToast } from "@/hooks/use-toast";

interface ChatHistoryItemProps {
  conversation: ConversationListItem;
  onDeleteSuccess: () => void;
  isActive: boolean; // Add prop to indicate if this item is the active one
}

const ChatHistoryItem: React.FC<ChatHistoryItemProps> = ({ conversation, onDeleteSuccess, isActive }) => {
  // const navigate = useNavigate();
  const setActiveConversationId = useSetAtom(activeConversationIdAtom); // Get setter for atom
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = () => {
    console.log('Setting active conversation:', conversation.id);
    setActiveConversationId(conversation.id);
    // No navigation needed
  };

  // Helper function to safely format the date
  const formatUpdateTime = (updatedAt: string | null | undefined): string => {
    if (!updatedAt) {
        return '-'; // Return dash if no date
    }
    try {
        const date = new Date(updatedAt);
        // Check if the date is valid
        if (isNaN(date.getTime())) { 
            console.warn('Invalid date value received for conversation updated_at:', updatedAt);
            return '-'; // Return dash if date is invalid
        }
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        console.error('Error formatting date:', updatedAt, e);
        return '-'; // Return dash on error
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering handleClick

    if (!window.confirm('Are you sure you want to delete this chat history?')) {
      return;
    }

    setIsDeleting(true);
    const conversationIdToDelete = conversation.id;
    try {
      // Call the service function and destructure the result
      const { success, error } = await deleteConversation(conversationIdToDelete);

      if (success) {
        toast({
          title: "Chat Deleted",
          description: "The conversation history has been removed.",
        });
        onDeleteSuccess();
        // Consider handling the active conversation state update here or in the parent
      } else {
        // Use the error message from the service if available
        throw error || new Error('Failed to delete conversation from service');
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast({
        title: "Error",
        // Display the specific error message if it exists
        description: error instanceof Error ? error.message : "Could not delete the conversation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Use a button or div instead of NavLink
  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative w-full justify-start h-auto px-2 py-1.5 text-left flex flex-col items-start cursor-pointer rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isActive && 'bg-accent text-accent-foreground'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <span className="text-sm font-medium truncate block w-full pointer-events-none">{conversation.title || 'Untitled Chat'}</span>
      <span className="text-xs text-muted-foreground mt-0.5 pointer-events-none">
        {formatUpdateTime(conversation.updated_at)}
      </span>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          'absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          'focus:opacity-100 focus:ring-1 focus:ring-ring rounded-full',
          isDeleting && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Delete conversation"
        title="Delete conversation"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ChatHistoryItem; 