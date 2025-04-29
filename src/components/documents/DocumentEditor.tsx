import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSetAtom } from 'jotai';
import { editorTextToQueryAtom, ActiveEditorItem as AppActiveEditorItem } from '@/atoms/appAtoms';
import { useEditor, EditorContent, Editor, BubbleMenu, AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
// Slash commands are currently broken due to deleted file
// import { slashCommandSuggestion } from '@/lib/editor/slashCommands';
// import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
// import { CommandItem } from '@/components/editor/SlashCommandList';
// Removed service imports as save logic moves to parent
// import * as templateService from '@/services/templateService';
// import * as documentService from '@/services/documentService';
import { Button, ButtonVariant, ButtonSize } from '@/components/ui/Button'; // Import types
import { Spinner } from '@/components/ui/Spinner';
import { Icons as CustomIcons } from '@/components/ui/Icons'; // Renamed to avoid clash
// Import necessary Lucide icons
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Undo, Redo,
  TextQuote as TextQuoteIcon, // Alias for Bubble Menu
  Save,
  Sparkles,
  Code, // <-- Import Code icon for the placeholder button
} from 'lucide-react';
import './DocumentEditor.css';
import InlineAIPopup from '@/components/editor/InlineAIPopup';

// Define type for the item being viewed/edited in the main panel - Allow 'template'
export type ActiveEditorItem = AppActiveEditorItem | { type: 'template'; id: string };

// Define type for the key used in editor.isActive() checks
type EditorActiveKey = string | { [key: string]: any };

// Toolbar Component with Formatting Buttons
interface EditorToolbarProps {
  editor: Editor | null;
  isDirty: boolean;
  isSaving: boolean;
  saveStatus: string;
  onSave: () => void;
  onAskAi: () => void;
  onRewrite: () => void;
  onSummarize: () => void;
  isSaveDisabled?: boolean;
  // Allow 'draft' as well, defaulting to null if undefined
  editorType: 'document' | 'template' | 'draft' | null;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  isDirty,
  isSaving,
  saveStatus,
  onSave,
  onAskAi,
  onRewrite,
  onSummarize,
  isSaveDisabled = false,
  editorType, 
}) => {
  if (!editor) return null;

  // Helper to create button props - Now defaults to 'md' size
  const getButtonProps = (action: () => void, isActiveKey: EditorActiveKey, title: string) => ({
    onClick: () => action(),
    variant: (editor.isActive(isActiveKey) ? 'secondary' : 'ghost') as ButtonVariant,
    size: 'md' as ButtonSize, // Changed default size to 'md'
    title: title,
    // Adjusted className for potentially larger size ('md') - might need fine-tuning
    className: "p-1.5 data-[state=on]:bg-muted data-[state=on]:text-foreground",
    disabled: isSaving
  });

  const hasSelection = editor.state.selection && !editor.state.selection.empty;

  const handleInsertPlaceholder = () => {
    editor.chain().focus().insertContent('%%[Enter Placeholder Name]%% ').run(); // Use a clearer placeholder text
  };

  return (
    // Increased vertical padding (py-2) for a bigger toolbar
    <div className="editor-toolbar sticky top-0 z-10 flex items-center justify-between p-2 border-b border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface flex-shrink-0">
      {/* Formatting Buttons Group */}
      <div className="flex items-center space-x-1">
        {/* Use getButtonProps with descriptive titles */}
        <Button {...getButtonProps(() => editor.chain().focus().toggleBold().run(), 'bold', 'Bold (⌘+B)')} aria-label="Bold">
          <Bold className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleItalic().run(), 'italic', 'Italic (⌘+I)')} aria-label="Italic">
          <Italic className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleStrike().run(), 'strike', 'Strikethrough (⌘+Shift+X)')} aria-label="Strikethrough">
          <Strikethrough className="h-5 w-5" />
        </Button>
        <div className="h-6 w-px bg-border mx-1.5"></div>
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), { heading: { level: 1 } }, 'Heading 1 (⌘+Alt+1)')} aria-label="Heading 1">
          <Heading1 className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), { heading: { level: 2 } }, 'Heading 2 (⌘+Alt+2)')} aria-label="Heading 2">
          <Heading2 className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), { heading: { level: 3 } }, 'Heading 3 (⌘+Alt+3)')} aria-label="Heading 3">
          <Heading3 className="h-5 w-5" />
        </Button>
        <div className="h-6 w-px bg-border mx-1.5"></div>
        <Button {...getButtonProps(() => editor.chain().focus().toggleBulletList().run(), 'bulletList', 'Bullet List (⌘+Shift+8)')} aria-label="Bullet List">
          <List className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleOrderedList().run(), 'orderedList', 'Numbered List (⌘+Shift+7)')} aria-label="Numbered List">
          <ListOrdered className="h-5 w-5" />
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleBlockquote().run(), 'blockquote', 'Blockquote (⌘+Shift+B)')} aria-label="Blockquote">
          <Quote className="h-5 w-5" />
        </Button>
         <div className="h-6 w-px bg-border mx-1.5"></div>
         {/* Conditionally render Placeholder Button */}
         {editorType === 'template' && (
            <Button
              onClick={handleInsertPlaceholder}
              variant="secondary" // Use secondary variant for potential distinct styling
              size="md"
              className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white" // Apply orange background and white text
              title="Insert Placeholder"
              aria-label="Insert Placeholder"
              disabled={isSaving}
            >
              <Code className="h-5 w-5" /> {/* Use Code icon */}
            </Button>
         )}
         {/* AI Buttons - Placeholder comment removed, these were likely intended for the BubbleMenu */}
         {/* We keep the separator for Undo/Redo */}
         <div className="h-6 w-px bg-border mx-1.5"></div>
         {/* Undo/Redo buttons */}
        <Button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} variant="ghost" size="md" className="p-1.5" title="Undo" aria-label="Undo">
          <Undo className="h-5 w-5" />
        </Button>
        <Button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} variant="ghost" size="md" className="p-1.5" title="Redo" aria-label="Redo">
          <Redo className="h-5 w-5" />
        </Button>
      </div>

      {/* Save Status and Button Group */}
      <div className="flex items-center space-x-2">
          <span className={`text-sm mr-2 ${saveStatus === 'Error' ? 'text-error' : isDirty ? 'text-warning dark:text-warning' : 'text-text-tertiary'}`}> {/* Slightly larger text */}
             {isSaving ? 'Saving...' : (saveStatus === 'Saved' && !isDirty) ? 'Saved' : isDirty ? 'Unsaved changes' : 'Up to date'}
             {saveStatus === 'Error' && <span className="ml-1">(Error)</span>}
           </span>
        {/* Keep Save button size potentially different if desired, using md here for consistency */}
        <Button onClick={onSave} size="md" disabled={!isDirty || isSaving || isSaveDisabled} variant="primary">
          {isSaving ? <Spinner size="sm" className="mr-1.5" /> : <Save className="mr-1.5 h-5 w-5" />} {/* Increased icon size */}
          Save
        </Button>
      </div>
    </div>
  );
};

interface DocumentEditorProps {
  initialContent: string;
  editorItem: ActiveEditorItem; // Use updated type
  showToolbar?: boolean; // Prop to optionally hide the toolbar
  // Add props to receive state and handlers from parent (EditPage)
  isSaving: boolean;
  saveStatus: 'Idle' | 'Saving' | 'Saved' | 'Error';
  isDirty: boolean;
  onSave: () => void; // Parent save function
  onDirtyChange: (dirty: boolean) => void; // Inform parent about dirty state
  onSaveStatusChange: (status: DocumentEditorProps['saveStatus']) => void; // Inform parent about save status changes (might not be needed if parent controls this)
}

// Define the type for the methods we want to expose via the ref
export interface DocumentEditorRef {
  insertContent: (content: string) => void;
  getContent: () => string | undefined; // Add getContent method
  editor: Editor | null; // <-- Expose editor instance
}

// DocumentEditor Component
const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  ({
    initialContent,
    editorItem,
    showToolbar = true,
    isSaving, // Receive from parent
    saveStatus, // Receive from parent
    isDirty, // Receive from parent
    onSave, // Receive from parent
    onDirtyChange, // Receive from parent
    onSaveStatusChange, // Receive from parent
  }, ref) => {
    // Remove local state for isDirty, isSaving, saveStatus as they are now props
    // const [isDirty, setIsDirty] = useState(false);
    // const [isSaving, setIsSaving] = useState(false);
    // const [saveStatus, setSaveStatus] = useState<'Idle' | 'Saving' | 'Saved' | 'Error'>('Idle');
    
    // Keep local state for UI-specific things like popups
    const [showAIPopup, setShowAIPopup] = useState(false);
    const [aiPopupContent, setAiPopupContent] = useState<string | null>(null);
    const [isAILoading, setIsAILoading] = useState(false); // Add loading state for AI popup
    const [currentSelectionRange, setCurrentSelectionRange] = useState<{ from: number; to: number } | null>(null);

    // Use Jotai setter for textToQuery
    const setTextToQuery = useSetAtom(editorTextToQueryAtom);

    const editor = useEditor({
      // Define base extensions
      extensions: (() => {
        const baseExtensions: AnyExtension[] = [
          StarterKit,
          Placeholder.configure({
            placeholder: 'Start writing your document here...',
          }),
        ];
        
        return baseExtensions;
      })(),
      content: initialContent,
      editable: true,
      editorProps: {
        attributes: {
          class:
            'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert max-w-full p-4 h-full',
        },
      },
      // When editor updates, inform parent that it's dirty
      onUpdate: () => {
        onDirtyChange(true);
        // Optionally reset save status in parent if needed
        // onSaveStatusChange('Idle');
      },
       onSelectionUpdate: ({ editor: currentEditor }) => {
        const { from, to } = currentEditor.state.selection;
        // Only show popup if there is a selection
        if (!currentEditor.state.selection.empty) {
            setCurrentSelectionRange({ from, to });
            // Don't automatically show popup on selection, BubbleMenu handles this
            // setShowAIPopup(true); 
        } else {
            // Clear range and potentially hide any persistent popups if needed
            setCurrentSelectionRange(null);
            setShowAIPopup(false); // Hide explicit popup if shown by AI action
        }
      },
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertContent: (content: string) => {
        editor?.chain().focus().insertContent(content).run();
      },
      getContent: () => {
        return editor?.getHTML();
      },
      editor: editor, // <-- Pass editor instance
    }), [editor]);

    // Ensure editor content is updated if initialContent changes (e.g., navigating between items)
    useEffect(() => {
        if (editor && initialContent !== editor.getHTML()) {
            editor.commands.setContent(initialContent);
            // Reset dirty state when content is externally changed
             onDirtyChange(false); 
             // Optionally reset save status
             // onSaveStatusChange('Idle');
        }
    }, [initialContent, editor, onDirtyChange]);

    // AI Action Handlers (Examples - Implement actual logic)
    const handleAskAi = useCallback(() => {
      if (!editor || !currentSelectionRange) return;
      const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
      setTextToQuery(selectedText); // Send selected text to chat context
      // Optionally close the popup or give feedback
      setShowAIPopup(false);
      setAiPopupContent(null);
    }, [editor, currentSelectionRange, setTextToQuery]);

    const handleRewrite = useCallback(async () => {
        if (!editor || !currentSelectionRange) return;
        const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
        console.log("Rewrite triggered for:", selectedText);
        setShowAIPopup(true); // Show the popup to display loading/result
        setAiPopupContent(null);
        setIsAILoading(true);
        // TODO: Call AI service for rewriting
        await new Promise(res => setTimeout(res, 1500)); // Simulate AI call
        setAiPopupContent("This is the rewritten text from the AI."); // Set dummy result
        setIsAILoading(false);
        // Do NOT close popup automatically, let user interact
        // setShowAIPopup(false); 
    }, [editor, currentSelectionRange]);

    const handleSummarize = useCallback(async () => {
        if (!editor || !currentSelectionRange) return;
        const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
        console.log("Summarize triggered for:", selectedText);
        setShowAIPopup(true); // Show the popup
        setAiPopupContent(null);
        setIsAILoading(true);
        // TODO: Call AI service for summarization
        await new Promise(res => setTimeout(res, 1500)); // Simulate AI call
        setAiPopupContent("This is the AI summary."); // Set dummy result
        setIsAILoading(false);
        // Keep popup open to show summary
        // setShowAIPopup(false);
    }, [editor, currentSelectionRange]);

    // Callback to handle replacing the original selection with AI content
    const handleReplaceSelection = useCallback((newContent: string) => {
      if (editor && currentSelectionRange) {
        editor
          .chain()
          .focus()
          .deleteRange(currentSelectionRange) // Delete the original selected range
          .insertContent(newContent) // Insert the AI content
          .run();
          
        // After replacing, close the popup and clear selection state
        setShowAIPopup(false);
        setAiPopupContent(null);
        setCurrentSelectionRange(null);
        onDirtyChange(true); // Mark editor as dirty
      }
    }, [editor, currentSelectionRange, onDirtyChange]);

    // Callback to handle copying AI content to clipboard
    const handleCopyContent = useCallback((contentToCopy: string) => {
      navigator.clipboard.writeText(contentToCopy).then(() => {
        console.log("AI content copied to clipboard");
        // TODO: Show a success toast notification for better UX
      }).catch(err => {
        console.error("Failed to copy text:", err);
        // TODO: Show an error toast notification
      });
      // Optionally close the popup after copying, or keep it open
      // setShowAIPopup(false);
      // setAiPopupContent(null);
    }, []);

    // Callback to handle closing the AI popup
    const handleCloseAIPopup = () => {
      setShowAIPopup(false);
      setAiPopupContent(null);
    };

    // Remove the internal handleSave logic
    /*
    const handleSave = useCallback(async () => {
      ...
    }, [editor, editorItem]);
    */

    return (
      <div className="document-editor flex flex-col h-full relative"> {/* Added relative positioning */}
        {showToolbar && (
          <EditorToolbar
            editor={editor}
            isDirty={isDirty} // Pass prop from parent
            isSaving={isSaving} // Pass prop from parent
            saveStatus={saveStatus} // Pass prop from parent
            onSave={onSave} // Pass parent's save handler
            onAskAi={handleAskAi}
            onRewrite={handleRewrite}
            onSummarize={handleSummarize}
            isSaveDisabled={false} // Or control externally if needed
            editorType={editorItem?.type ?? null} // Pass type or null if editorItem is null
          />
        )}

        {/* Tiptap Bubble Menu for Inline AI Actions */}
        {editor && (
             <BubbleMenu
                editor={editor}
                tippyOptions={{ 
                    duration: 100,
                    placement: 'top-start', // Adjust placement as needed
                    // animation: 'shift-away', // Optional: add animation
                }}
                className="bg-background dark:bg-surface-lighter shadow-lg rounded-md border border-border dark:border-surface-lightest p-1 flex space-x-1"
                shouldShow={({ editor: currentEditor }) => {
                    // Only show when text is selected
                    return !currentEditor.state.selection.empty;
                }}
            >
                <Button variant="ghost" size="sm" onClick={handleAskAi} title="Send to Chat" className="p-1">
                    <Sparkles className="h-4 w-4" />
                </Button>
                 <Button variant="ghost" size="sm" onClick={handleRewrite} title="Rewrite" className="p-1">
                    <CustomIcons.Refresh className="h-4 w-4" />
                </Button>
                 <Button variant="ghost" size="sm" onClick={handleSummarize} title="Summarize" className="p-1">
                    <TextQuoteIcon className="h-4 w-4" />
                </Button>
                {/* Potentially add more actions */} 
             </BubbleMenu>
        )}
        
        {/* Editor Content Area - takes remaining space */}
        <EditorContent editor={editor} className="flex-grow overflow-y-auto" />

        {/* Inline AI Popup (if used for displaying results) */}
        {
          showAIPopup && editor && currentSelectionRange && (
            <InlineAIPopup
              // Removed incorrect editor and range props
              originalSelectionRange={currentSelectionRange} // Pass the stored range
              content={aiPopupContent}
              isLoading={isAILoading}
              onClose={handleCloseAIPopup}
              onReplace={handleReplaceSelection} // Pass the replace callback
              onCopy={handleCopyContent} // Pass the copy callback
            />
          )
        }
      </div>
    );
  }
);

export default DocumentEditor;