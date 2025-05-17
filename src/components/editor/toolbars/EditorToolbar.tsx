import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2, Minus, MessageSquare, Sparkles, TextCursorInput } from 'lucide-react';
import { Button } from '../../ui/Button'; // Assuming Button component path
import { cn } from '../../../lib/utils'; // Assuming cn utility path

interface EditorToolbarProps {
  editor: Editor | null;
  // AI action handlers to be added later
  onSummarize?: () => void;
  onRewrite?: (mode: string) => void; // Mode like 'improve', 'shorten'
  onGenerate?: () => void; // For "Ask AI" / inline generation
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onSummarize,
  onRewrite,
  onGenerate
}) => {
  if (!editor) {
    return null;
  }

  const aiFeaturesEnabled = true; // For now, always true. Later can be a prop or config.

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border dark:border-dark-border bg-background dark:bg-dark-background sticky top-0 z-10">
      {/* Basic Formatting Buttons - ideally these would be Toggle components */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn("p-2", editor.isActive('bold') ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn("p-2", editor.isActive('italic') ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={cn("p-2", editor.isActive('underline') ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn("p-2", editor.isActive('heading', { level: 2 }) ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        className={cn("p-2", editor.isActive('bulletList') ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        className={cn("p-2", editor.isActive('orderedList') ? 'bg-accent text-accent-foreground dark:bg-dark-accent dark:text-dark-accent-foreground' : 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={!editor.can().chain().focus().setHorizontalRule().run()}
        className={cn("p-2", 'hover:bg-muted dark:hover:bg-dark-muted')}
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* AI Feature Buttons */}
      {aiFeaturesEnabled && (
        <>
          <div className="h-6 border-l border-border dark:border-dark-border mx-1"></div>
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            className="p-2 text-primary dark:text-dark-primary border-primary dark:border-dark-primary hover:bg-primary/10 hover:text-primary dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary flex items-center"
            title="Ask AI / Generate Text"
          >
            <Sparkles className="h-4 w-4 mr-1.5" /> Ask AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSummarize}
            className="p-2 text-info dark:text-dark-info border-info dark:border-dark-info hover:bg-info/10 hover:text-info dark:hover:bg-dark-info/10 dark:hover:text-dark-info flex items-center"
            title="Summarize Selection/Document"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" /> Summarize
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRewrite && onRewrite('improve')}
            className="p-2 text-success dark:text-dark-success border-success dark:border-dark-success hover:bg-success/10 hover:text-success dark:hover:bg-dark-success/10 dark:hover:text-dark-success flex items-center"
            title="Rewrite Selection"
          >
            <TextCursorInput className="h-4 w-4 mr-1.5" /> Rewrite
          </Button>
        </>
      )}
    </div>
  );
};

export default EditorToolbar; 