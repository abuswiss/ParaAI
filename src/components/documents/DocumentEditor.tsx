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
import * as templateService from '@/services/templateService';
import * as documentService from '@/services/documentService';
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
  Sparkles
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
  // Add handlers for AI actions triggered from toolbar
  onAskAi: () => void;
  onRewrite: () => void;
  onSummarize: () => void;
  isSaveDisabled?: boolean; // Add prop to disable save button externally
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
  isSaveDisabled = false, // Default to false
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

  return (
    // Increased vertical padding (py-2) for a bigger toolbar
    <div className="editor-toolbar sticky top-0 z-10 flex items-center justify-between p-2 border-b border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface">
      {/* Formatting Buttons Group */}
      <div className="flex items-center space-x-1">
        {/* Use getButtonProps for formatting buttons */}
        <Button {...getButtonProps(() => editor.chain().focus().toggleBold().run(), 'bold', 'Bold')} aria-label="Bold">
          <Bold className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleItalic().run(), 'italic', 'Italic')} aria-label="Italic">
          <Italic className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleStrike().run(), 'strike', 'Strikethrough')} aria-label="Strikethrough">
          <Strikethrough className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <div className="h-6 w-px bg-border mx-1.5"></div> {/* Adjusted Separator */}
        {/* Pass heading object directly to isActiveKey */}
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), { heading: { level: 1 } }, 'Heading 1')} aria-label="Heading 1">
          <Heading1 className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), { heading: { level: 2 } }, 'Heading 2')} aria-label="Heading 2">
          <Heading2 className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), { heading: { level: 3 } }, 'Heading 3')} aria-label="Heading 3">
          <Heading3 className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <div className="h-6 w-px bg-border mx-1.5"></div> {/* Adjusted Separator */}
        <Button {...getButtonProps(() => editor.chain().focus().toggleBulletList().run(), 'bulletList', 'Bullet List')} aria-label="Bullet List">
          <List className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleOrderedList().run(), 'orderedList', 'Numbered List')} aria-label="Numbered List">
          <ListOrdered className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button {...getButtonProps(() => editor.chain().focus().toggleBlockquote().run(), 'blockquote', 'Blockquote')} aria-label="Blockquote">
          <Quote className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
         <div className="h-6 w-px bg-border mx-1.5"></div> {/* Adjusted Separator */}
         {/* Added AI Action Buttons */} 
         <Button variant="ghost" size="md" onClick={onAskAi} disabled={!hasSelection || isSaving} title="Send selected text to chat">
            <Sparkles className="h-5 w-5" />
         </Button>
         <Button variant="ghost" size="md" onClick={onRewrite} disabled={!hasSelection || isSaving} title="Rewrite selection with AI">
            <CustomIcons.Refresh className="h-5 w-5" />
         </Button>
         <Button variant="ghost" size="md" onClick={onSummarize} disabled={!hasSelection || isSaving} title="Summarize selection with AI">
            <TextQuoteIcon className="h-5 w-5" />
         </Button>
         <div className="h-6 w-px bg-border mx-1.5"></div> {/* Adjusted Separator */} 
         {/* Undo/Redo buttons - using 'md' size */}
        <Button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} variant="ghost" size="md" className="p-1.5" title="Undo" aria-label="Undo">
          <Undo className="h-5 w-5" /> {/* Increased icon size */}
        </Button>
        <Button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} variant="ghost" size="md" className="p-1.5" title="Redo" aria-label="Redo">
          <Redo className="h-5 w-5" /> {/* Increased icon size */}
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
}

// Define the type for the methods we want to expose via the ref
export interface DocumentEditorRef {
  insertContent: (content: string) => void;
  getContent: () => string | undefined; // Add getContent method
}

// DocumentEditor Component
const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  ({ initialContent, editorItem, showToolbar = true }, ref) => {
    // Local state
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Idle' | 'Saving' | 'Saved' | 'Error'>('Idle');
    const [showAIPopup, setShowAIPopup] = useState(false);
    const [aiPopupContent, setAiPopupContent] = useState<string | null>(null);
    // Consider adding a dedicated loading state for AI actions
    // const [isAILoading, setIsAILoading] = useState(false);
    const [currentSelectionRange, setCurrentSelectionRange] = useState<{ from: number; to: number } | null>(null);

    // Use Jotai setter for textToQuery
    const setTextToQuery = useSetAtom(editorTextToQueryAtom);

    const editor = useEditor({
      extensions: [
        StarterKit, // Keep StarterKit for basic functionality
        Placeholder.configure({
          // Placeholder handled by CSS now
          placeholder: ' ', // Use non-breaking space or empty to prevent default rendering
        }),
        // Slash commands are disabled
        // Suggestion(slashCommandSuggestion as SuggestionOptions<CommandItem>),
      ] as AnyExtension[],
      content: initialContent || '<p></p>',
      editable: true,
      editorProps: {
        attributes: {
          // Keep existing editor styling class
          class:
            'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert max-w-full p-4 min-h-[300px]',
        },
      },
      onUpdate: () => {
        setIsDirty(true);
        setSaveStatus('Idle');
      },
       onSelectionUpdate: ({ editor: currentEditor }) => {
        if (currentEditor.state.selection.empty || !showAIPopup) {
          setShowAIPopup(false);
          setCurrentSelectionRange(null);
        }
        // Force toolbar re-render on selection change to update disabled states
        forceToolbarUpdate(); // Call the new force update function
      },
    });

    // Use a counter state to force re-render for toolbar disabled state updates
    const [, setToolbarUpdateKey] = useState(0); // Omit unused state variable
    const forceToolbarUpdate = useCallback(() => setToolbarUpdateKey(k => k + 1), []);

    // Debounce save function to avoid saving on every keystroke (optional, but good UX)
    const handleSave = useCallback(async () => {
      if (!editor || !editorItem || !isDirty || editorItem.type === 'template') return;

      setIsSaving(true);
      setSaveStatus('Saving');
      console.log(`Saving ${editorItem.type} with ID ${editorItem.id}`);

      const contentToSave = editor.getHTML();

      try {
        let result: { success: boolean; error: Error | null } | undefined;
        if (editorItem.type === 'draft') {
          result = await templateService.updateDraft(editorItem.id, { content: contentToSave });
        } else if (editorItem.type === 'document') {
          // Assuming we update extractedText for now
          result = await documentService.updateDocument(editorItem.id, { extractedText: contentToSave });
        }

        if (!result || result.error) {
          throw result?.error || new Error('Save operation failed unexpectedly.');
        }

        console.log(`${editorItem.type} ${editorItem.id} saved successfully.`);
        setIsDirty(false); // Reset dirty state on successful save
        setSaveStatus('Saved');
        // Optionally show a success toast/message here

      } catch (err) {
        console.error("Error saving content:", err);
        setSaveStatus('Error');
        // Optionally show an error toast/message here
      } finally {
        setIsSaving(false);
      }
    }, [editor, editorItem, isDirty]);

    // Effect to update editor content if initialContent changes externally
    // (e.g., switching documents)
    useEffect(() => {
      if (editor && !isDirty) { // Only update if not dirty to avoid overwriting user edits
        const currentContent = editor.getHTML();
        if (initialContent !== currentContent) {
          // Use resetContent to avoid marking as dirty immediately if content is the same
          editor.commands.setContent(initialContent || '', false); // false = don't emit update event
          console.log("Editor content reset based on initialContent prop.");
          setIsDirty(false); // Ensure dirty state is reset
          setSaveStatus('Idle');
        }
      }
    }, [initialContent, editor, isDirty]);

    // Shared function to store selection before calling AI
    const storeSelection = useCallback(() => {
      if (!editor || editor.state.selection.empty) return null;
      const { from, to } = editor.state.selection;
      const range = { from, to };
      setCurrentSelectionRange(range); // Store range for potential replacement
      forceToolbarUpdate(); // Update toolbar when selection changes
      return editor.state.doc.textBetween(from, to, ' ');
    }, [editor, forceToolbarUpdate]);

    const handleAskAi = useCallback(() => {
      const selectedText = storeSelection(); // Store selection first
      if (selectedText) {
          console.log("Sending selected text to chat:", selectedText);
          setTextToQuery(selectedText.trim());
          setShowAIPopup(false); // Ensure popup closes if Ask Chat is clicked
      }
    }, [storeSelection, setTextToQuery]);

    // Generic handler for inline AI actions (rewrite, summarize)
    const handleInlineAIAction = useCallback(async (action: 'rewrite' | 'summarize', text: string) => {
        if (!text) return;
        storeSelection(); // Ensure selection range is stored before showing popup
        setShowAIPopup(true);
        setAiPopupContent(null); // Indicate loading visually
        // setIsAILoading(true); // If using dedicated state
        try {
            const response = await fetch(`/api/ai/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to process AI request.' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAiPopupContent(data.result); // Set result from backend

        } catch (error: unknown) {
            console.error(`Error during ${action}:`, error);
            setAiPopupContent(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`); // Display error in popup
        } finally {
           // setIsAILoading(false); // If using dedicated state
        }
    }, [storeSelection]);

    // Define handlers for toolbar AI buttons
    const handleToolbarRewrite = useCallback(() => {
      // Get selected text directly within the handler
      const text = editor?.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
      if (text) {
          // Call the main AI action handler with specific action
          handleInlineAIAction('rewrite', text);
      }
    }, [editor, handleInlineAIAction]); // Dependencies: editor and the main handler

    const handleToolbarSummarize = useCallback(() => {
      // Get selected text directly within the handler
      const text = editor?.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
      if (text) {
          // Call the main AI action handler with specific action
          handleInlineAIAction('summarize', text);
      }
    }, [editor, handleInlineAIAction]); // Dependencies: editor and the main handler

    // Callback passed to popup for replacing selection
    const handleReplace = useCallback((newContent: string) => {
      if (editor && currentSelectionRange) {
        editor
          .chain()
          .focus()
          .deleteRange(currentSelectionRange)
          .insertContent(newContent)
          .run();
        setCurrentSelectionRange(null); // Clear range after replacing
        setShowAIPopup(false); // Close popup
      }
    }, [editor, currentSelectionRange]);

    // Callback passed to popup for copying content
    const handleCopy = useCallback((contentToCopy: string) => {
      navigator.clipboard.writeText(contentToCopy).then(() => {
        console.log("AI content copied to clipboard");
        // Optionally show a toast message
      }).catch(err => {
        console.error("Failed to copy text:", err);
      });
      // Decide whether to close popup after copy
       setShowAIPopup(false);
    }, []);

    // Expose the insertContent method using useImperativeHandle
    useImperativeHandle(ref, () => ({ // Pass the ref here
      insertContent: (content: string) => {
        if (editor) {
          // Use Tiptap's commands to insert content at the current cursor position
          editor.chain().focus().insertContent(content).run();
        }
      },
      // Implement getContent
      getContent: () => {
          return editor?.getHTML();
      }
    }));

    if (!editor) {
      return null;
    }

    // Determine if the toolbar save should be disabled
    const isToolbarSaveDisabled = editorItem?.type === 'template'; // Add null check

    return (
      <div className="document-editor-container h-full flex flex-col border border-border rounded-md shadow-sm overflow-hidden">
        {showToolbar && (
           <EditorToolbar
            editor={editor}
            isDirty={isDirty}
            isSaving={isSaving}
            saveStatus={saveStatus}
            onSave={handleSave}
            onAskAi={handleAskAi}
            onRewrite={handleToolbarRewrite}
            onSummarize={handleToolbarSummarize}
            isSaveDisabled={isToolbarSaveDisabled} // Pass disable flag
          />
        )}
        {editor && (
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 100 }}
              // Keeping BubbleMenu smaller/more compact
              className="bg-background border border-border rounded-md shadow-lg p-1 flex items-center space-x-1"
            >
              {/* Ask Chat Button */}
              <Button
                onClick={handleAskAi}
                variant="ghost"
                size="sm" // Keep bubble menu buttons small
                className="text-xs px-2 py-1"
                disabled={!editor.state.selection.content()}
                title="Send selected text to chat"
              >
                <Sparkles className="h-3 w-3 mr-1" /> Ask Chat
              </Button>
              {/* Rewrite Button */}
              <Button
                onClick={handleToolbarRewrite} // Use specific handler
                variant="ghost"
                size="sm" // Keep bubble menu buttons small
                className="text-xs px-2 py-1"
                disabled={!editor.state.selection.content()}
                title="Rewrite selection with AI"
              >
                 <CustomIcons.Refresh className="h-3 w-3 mr-1" /> Rewrite
              </Button>
              {/* Summarize Button */}
               <Button
                onClick={handleToolbarSummarize} // Use specific handler
                variant="ghost"
                size="sm" // Keep bubble menu buttons small
                className="text-xs px-2 py-1"
                disabled={!editor.state.selection.content()}
                title="Summarize selection with AI"
              >
                 <TextQuoteIcon className="h-3 w-3 mr-1" /> Summarize
              </Button>
            </BubbleMenu>
          )}

         {/* Render InlineAIPopup conditionally */}
         {showAIPopup && currentSelectionRange && (
            <InlineAIPopup
              originalSelectionRange={currentSelectionRange}
              content={aiPopupContent}
              isLoading={aiPopupContent === null}
              onClose={() => setShowAIPopup(false)}
              onReplace={handleReplace}
              onCopy={handleCopy}
            />
          )}

        <div className="editor-content-wrapper flex-grow overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    );
  }
);

export default DocumentEditor;