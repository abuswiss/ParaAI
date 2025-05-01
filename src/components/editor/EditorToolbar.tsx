import React from 'react';
import { type Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Undo, Redo,
  Code, // For placeholder button
  Sparkles, // For Ask AI
  RefreshCcw, // For Rewrite
  TextQuote as TextQuoteIcon, // For Summarize & Bubble Menu
  Save,
} from 'lucide-react';
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/Button"; // Use Button for non-toggle actions
import { Spinner } from '@/components/ui/Spinner';

// Define the props the toolbar will need
interface EditorToolbarProps {
  editor: Editor | null;
  editorType: 'document' | 'template' | 'draft' | null;
  isDirty: boolean;
  isSaving: boolean;
  saveStatus: 'Idle' | 'Saving' | 'Saved' | 'Error';
  onSave: () => void;
  // AI Action Handlers - Can be simplified if only in BubbleMenu
  onAskAi: () => void; 
  onRewrite: () => void;
  onSummarize: () => void;
  hasSelection: boolean; // Needed to disable AI buttons
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  editorType,
  isDirty,
  isSaving,
  saveStatus,
  onSave,
  onAskAi,
  onRewrite,
  onSummarize,
  hasSelection,
}) => {
  if (!editor) return null;

  const handleInsertPlaceholder = () => {
    // editor.chain().focus().insertContent('%%[Placeholder Name]%% ').run();
    // Wrap the placeholder text with a highlight mark and a data attribute
    editor
      .chain()
      .focus()
      .setHighlight({ color: '#FFF3A3' }) // Give it a distinct default color
      .insertContent('%%[Placeholder Name]%% ')
      .unsetHighlight()
      .run();

    // Note: Applying the highlight with specific attributes like data-placeholder
    // might require a custom extension or modification if Highlight doesn't directly support arbitrary attrs.
    // For now, we use color and the %%[]%% syntax for identification.
    // If we need more robust identification, we'd modify the Highlight extension
    // or create a custom Placeholder node/mark.
  };

  return (
    <div className="border-b border-border p-2 flex items-center justify-between flex-wrap gap-1 sticky top-0 z-10 bg-background">
      {/* Left Group: Formatting & Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Basic Formatting Toggles */}
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
          title="Bold (⌘+B)"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
          title="Italic (⌘+I)"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Toggle strikethrough"
          title="Strikethrough (⌘+Shift+X)"
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Heading Toggles */}
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Toggle heading 1"
           title="Heading 1 (⌘+Alt+1)"
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Toggle heading 2"
           title="Heading 2 (⌘+Alt+2)"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Toggle heading 3"
           title="Heading 3 (⌘+Alt+3)"
        >
          <Heading3 className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* List Toggles */}
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Toggle bullet list"
          title="Bullet List (⌘+Shift+8)"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Toggle ordered list"
          title="Numbered List (⌘+Shift+7)"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('blockquote')}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Toggle blockquote"
           title="Blockquote (⌘+Shift+B)"
        >
          <Quote className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Placeholder Button (Template only) */}
        {editorType === 'template' && (
            <Button
              variant="secondary" 
              size="sm"
              onClick={handleInsertPlaceholder}
              title="Insert Placeholder"
              aria-label="Insert Template Placeholder"
            >
              <Code className="h-4 w-4" />
            </Button>
         )}
         
        {/* Undo/Redo Buttons */}
        <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            aria-label="Undo"
             title="Undo (⌘+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            aria-label="Redo"
             title="Redo (⌘+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </Button>
         
         {/* AI Buttons (Optional in main toolbar) */}
         {/* 
         <Separator orientation="vertical" className="h-6 mx-1" />
         <Button variant="ghost" size="sm" onClick={onAskAi} disabled={isSaving || !hasSelection} title="Send Selection to Chat">
             <Sparkles className="h-4 w-4" />
         </Button>
         <Button variant="ghost" size="sm" onClick={onRewrite} disabled={isSaving || !hasSelection} title="Rewrite Selection">
             <RefreshCcw className="h-4 w-4" />
         </Button>
         <Button variant="ghost" size="sm" onClick={onSummarize} disabled={isSaving || !hasSelection} title="Summarize Selection">
             <TextQuoteIcon className="h-4 w-4" />
         </Button> 
         */}
      </div>

      {/* Right Group: Save Status & Button */}
      <div className="flex items-center gap-2">
          {/* Save Status Indicator */}
           <span className={`text-xs ${saveStatus === 'Error' ? 'text-destructive' : isDirty ? 'text-yellow-500' : 'text-muted-foreground'}`}> 
             {isSaving ? 'Saving...' : (saveStatus === 'Saved' && !isDirty) ? 'Saved' : isDirty ? 'Unsaved' : 'Saved'}
             {saveStatus === 'Error' && '(Error)'}
           </span>
           <Button onClick={onSave} size="sm" disabled={!isDirty || isSaving} variant="default"> {/* Changed to default variant */} 
              {isSaving ? <Spinner size="xs" className="mr-1.5" /> : <Save className="mr-1.5 h-4 w-4" />} 
              Save
           </Button>
      </div>
    </div>
  );
}; 