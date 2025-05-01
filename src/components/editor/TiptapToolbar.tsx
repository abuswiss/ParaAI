import React from 'react';
import { Editor } from '@tiptap/react'; // Import Tiptap types when implemented
import { Button } from '@/components/ui/Button';
import { Bold, Italic, Strikethrough, List, ListOrdered, Quote, Heading2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder for Tiptap Toolbar
// We will add actual functionality tied to the Tiptap editor instance

interface TiptapToolbarProps {
  editor: Editor | null; // Pass the Tiptap editor instance here
}

const TiptapToolbar: React.FC<TiptapToolbarProps> = ({ editor }) => {
  // TODO: Add AI actions (Summarize, Rewrite) - potentially in a separate toolbar/menu

  if (!editor) {
    // Optionally render a disabled state or return null
    // For now, let's return null to hide toolbar if editor isn't ready
    return null; 
  }

  return (
    <div className="border-b border-muted p-2 flex flex-wrap items-center gap-1 sticky top-0 bg-background z-10">
      {/* Bold */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Bold" 
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn(editor.isActive('bold') ? 'bg-muted' : '')}
      >
        <Bold className="h-4 w-4" />
      </Button>
      {/* Italic */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Italic" 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn(editor.isActive('italic') ? 'bg-muted' : '')}
      >
        <Italic className="h-4 w-4" />
      </Button>
      {/* Strikethrough */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Strikethrough" 
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={cn(editor.isActive('strike') ? 'bg-muted' : '')}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      {/* Separator */}
      <div className="h-5 w-px bg-muted mx-1" />
       {/* Heading 2 */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Heading 2" 
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(editor.isActive('heading', { level: 2 }) ? 'bg-muted' : '')}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      {/* Separator */}
      <div className="h-5 w-px bg-muted mx-1" />
       {/* Bullet List */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Bullet List" 
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        className={cn(editor.isActive('bulletList') ? 'bg-muted' : '')}
      >
        <List className="h-4 w-4" />
      </Button>
      {/* Ordered List */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Ordered List" 
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        className={cn(editor.isActive('orderedList') ? 'bg-muted' : '')}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      {/* Separator */}
      <div className="h-5 w-px bg-muted mx-1" />
       {/* Blockquote */}
      <Button 
        variant="ghost" 
        size="sm" 
        title="Blockquote" 
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={!editor.can().chain().focus().toggleBlockquote().run()}
        className={cn(editor.isActive('blockquote') ? 'bg-muted' : '')}
      >
        <Quote className="h-4 w-4" />
      </Button>
      {/* TODO: Add more buttons (Link, Color, AI actions) */}
    </div>
  );
};

export default TiptapToolbar; 