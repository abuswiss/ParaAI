import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatInterface from '../components/chat/ChatInterface';

const Chat: React.FC = () => {
  const { id } = useParams();
  
  // If this is a new chat, it will be loaded with a clean state
  const isNewChat = id === 'new';
  
  // If we're viewing /chat/new, we want to create a new conversation
  useEffect(() => {
    if (isNewChat) {
      // The ChatInterface component will handle showing the welcome screen
      // when no conversation is active
      console.log('Creating new chat conversation');
    }
  }, [isNewChat]);

  return (
    <div className="h-full flex flex-col">
      <ChatInterface key={id} conversationId={isNewChat ? undefined : id} />
    </div>
  );
};

export default Chat;
