import React from 'react';
import ChatInterface from '../components/chat/ChatInterface';

const Dashboard: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <ChatInterface />
    </div>
  );
};

export default Dashboard;
