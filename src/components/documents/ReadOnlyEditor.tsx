import React from 'react';

interface ReadOnlyEditorProps {
  content: string;
}

// Basic component to render HTML content read-only
// Uses dangerouslySetInnerHTML - ensure content is trusted or sanitized upstream
const ReadOnlyEditor: React.FC<ReadOnlyEditorProps> = ({ content }) => {
  return (
    <div 
      className="prose dark:prose-invert max-w-none" // Apply prose styles for basic formatting
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default ReadOnlyEditor; 