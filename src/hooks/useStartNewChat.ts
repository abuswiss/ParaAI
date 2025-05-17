import { useSetAtom } from 'jotai';
import { activeConversationIdAtom, chatDocumentContextIdsAtom } from '@/atoms/appAtoms';
import { useCallback } from 'react';

export function useStartNewChat() {
  const setActiveConversationId = useSetAtom(activeConversationIdAtom);
  const setSelectedDocumentIds = useSetAtom(chatDocumentContextIdsAtom);

  return useCallback(() => {
    // Simply reset the conversation state without navigating away
    setActiveConversationId(null);
    setSelectedDocumentIds([]);
    // Stay on current page, don't navigate to /claude anymore
  }, [setActiveConversationId, setSelectedDocumentIds]);
} 