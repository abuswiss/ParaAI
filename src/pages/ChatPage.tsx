import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ChatInterface from '../components/chat/ChatInterface';
import { useAtomValue } from 'jotai';
import { activeEditorItemAtom } from '@/atoms/appAtoms';
import DocumentEditor, { DocumentEditorRef } from '@/components/documents/DocumentEditor';

const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const location = useLocation();
  const activeEditorItem = useAtomValue(activeEditorItemAtom);
  const editorRef = React.useRef<DocumentEditorRef>(null);

  const initialInputValue = location.state?.prefill || '';

  const handleInsertContent = (content: string) => {
    editorRef.current?.insertContent(content);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 h-full">
        <ChatInterface 
          conversationId={conversationId}
          onInsertContent={handleInsertContent}
          initialInputValue={initialInputValue}
        />
      </div>

      {/* Editor Area (Optional - depends on layout decisions) */}
      {/* If editor should always be visible alongside chat: */}
      {/* 
      <div className="w-1/2 border-l border-gray-700 h-full overflow-hidden">
        {activeEditorItem ? (
          <DocumentEditor 
            key={`${activeEditorItem.type}-${activeEditorItem.id}`} 
            initialContent=""
            editorItem={activeEditorItem} 
            ref={editorRef}
          />
        ) : (
          <div className="p-4 text-center text-gray-500">Select a document or draft to edit.</div>
        )}
      </div> 
      */}
    </div>
  );
};

export default ChatPage; 