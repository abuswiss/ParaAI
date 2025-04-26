import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ChatInterface from '../components/chat/ChatInterface';

const Chat: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  // Use a timestamp to force re-render when navigating to the same route
  const [instanceKey, setInstanceKey] = useState<string>(Date.now().toString());
  
  // If this is a new chat, it will be loaded with a clean state
  const isNewChat = id === 'new';
  
  // If we're viewing /chat/new, we want to create a new conversation
  useEffect(() => {
    if (isNewChat) {
      // Generate a new key to force a complete re-render of the ChatInterface
      setInstanceKey(Date.now().toString());
      console.log('Creating new chat conversation', instanceKey);
    }
  }, [isNewChat, location.key]); // Also react to location.key changes

  return (
    <div className="h-full flex flex-col">
      <ChatInterface 
        key={isNewChat ? instanceKey : id} 
        conversationId={isNewChat ? 'new' : id} 
      />
    </div>
  );
};

export default Chat;
