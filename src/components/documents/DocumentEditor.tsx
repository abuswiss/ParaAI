import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSetAtom } from 'jotai'; // Import Jotai hooks (useAtom removed)
import { editorTextToQueryAtom, ActiveEditorItem } from '@/atoms/appAtoms'; // Import atoms
import { useEditor, EditorContent, Editor, BubbleMenu, AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { slashCommandSuggestion } from '@/lib/editor/slashCommands'; // Uncommented
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'; // Uncommented
import { CommandItem } from '@/components/editor/SlashCommandList'; // Import CommandItem type for assertion
import * as templateService from '@/services/templateService'; // For updating drafts
import * as documentService from '@/services/documentService'; // For updating documents
// import { ActiveEditorItem, useAppStore } from '@/store/appStore'; // Remove Zustand import
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { RefreshCcw as RefreshCcwIcon, TextQuote as TextQuoteIcon } from 'lucide-react';
import './DocumentEditor.css';
import InlineAIPopup from '@/components/editor/InlineAIPopup'; // Correct the import path for InlineAIPopup

// Simple Toolbar Component
interface EditorToolbarProps {
  editor: Editor | null;
  isDirty: boolean;
  isSaving: boolean;
  saveStatus: string; // e.g., "Unsaved", "Saving...", "Saved", "Error"
  onSave: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, isDirty, isSaving, saveStatus, onSave }) => {
  if (!editor) return null;

  return (
    <div className="editor-toolbar sticky top-0 z-10 flex items-center justify-between p-2 border-b border-neutral-200 dark:border-surface-lighter bg-white dark:bg-surface">
      {/* Placeholder for formatting buttons later */}
      <div className="flex items-center space-x-2">
        {/* Example: <Button variant="ghost" size="sm">Bold</Button> */}
      </div>
      <div className="flex items-center space-x-2">
          <span className={`text-xs mr-2 ${saveStatus === 'Error' ? 'text-error' : isDirty ? 'text-warning dark:text-warning' : 'text-text-tertiary'}`}>
             {isSaving ? 'Saving...' : (saveStatus === 'Saved' && !isDirty) ? 'Saved' : isDirty ? 'Unsaved changes' : 'Up to date'}
             {saveStatus === 'Error' && <span className="ml-1">(Error)</span>}
           </span>
        <Button onClick={onSave} size="sm" disabled={!isDirty || isSaving} variant="primary">
          {isSaving ? <Spinner size="sm" className="mr-1" /> : <Icons.Save className="mr-1 h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );
};

interface DocumentEditorProps {
  initialContent: string;
  editorItem: ActiveEditorItem; // Receive item type and ID
}

// Define the type for the methods we want to expose via the ref
export interface DocumentEditorRef {
  insertContent: (content: string) => void;
}

// Wrap the component with forwardRef
const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  ({ initialContent, editorItem }, ref) => {
    // Local state
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Idle' | 'Saving' | 'Saved' | 'Error'>('Idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showAIPopup, setShowAIPopup] = useState(false);
    const [aiPopupContent, setAiPopupContent] = useState<string | null>(null);
    const [currentSelectionRange, setCurrentSelectionRange] = useState<{ from: number; to: number } | null>(null);
    
    // Use Jotai setter for textToQuery
    const setTextToQuery = useSetAtom(editorTextToQueryAtom);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // Ensure common block types are enabled
          heading: { levels: [1, 2, 3] },
          bulletList: { keepMarks: true, keepAttributes: true },
          orderedList: { keepMarks: true, keepAttributes: true },
          blockquote: {},
          codeBlock: {},
          // Also ensure formatting marks are enabled
          bold: {},
          italic: {},
        }),
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'paragraph' && node.content.size === 0 && node.nodeSize === 2) {
              return "Type '/' for commands, or just start writing...";
            }
            return '';
          },
           includeChildren: true,
        }),
        // Use type assertion with imported types
        Suggestion(slashCommandSuggestion as SuggestionOptions<CommandItem>), 
      ] as AnyExtension[],
      content: initialContent || '<p></p>',
      editable: true,
      editorProps: {
        attributes: {
          class:
            'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none dark:prose-invert max-w-full',
        },
      },
      onUpdate: () => {
        setIsDirty(true);
        setSaveStatus('Idle');
      },
    });

    // Debounce save function to avoid saving on every keystroke (optional, but good UX)
    const handleSave = useCallback(async () => {
      if (!editor || !editorItem || !isDirty) return;

      setIsSaving(true);
      setSaveStatus('Saving');
      setSaveError(null);
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
        setSaveError(err instanceof Error ? err.message : "Failed to save content.");
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
      setCurrentSelectionRange(range);
      return editor.state.doc.textBetween(from, to, ' ');
    }, [editor]);

    const handleAskAi = useCallback(() => {
      const selectedText = storeSelection();
      if (selectedText) {
          console.log("Sending selected text to chat:", selectedText);
          setTextToQuery(selectedText.trim());
          setShowAIPopup(false); // Ensure popup closes if Ask Chat is clicked
      }
    }, [storeSelection, setTextToQuery]);

    // Generic handler for inline AI actions
    const handleInlineAIAction = useCallback(async (action: 'rewrite' | 'summarize', text: string) => {
        if (!text) return;
        setShowAIPopup(true);
        setAiPopupContent(null); 
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
            setAiPopupContent(null);
        }
    }, []);

    const handleRewrite = useCallback(() => {
      const selectedText = storeSelection();
      if (selectedText) {
        handleInlineAIAction('rewrite', selectedText);
      }
    }, [storeSelection, handleInlineAIAction]);

    const handleSummarize = useCallback(() => {
      const selectedText = storeSelection();
      if (selectedText) {
        handleInlineAIAction('summarize', selectedText);
      }
    }, [storeSelection, handleInlineAIAction]);

    // Callback for popup: Replace selection
    const handleReplaceSelection = useCallback((newContent: string) => {
      if (editor && currentSelectionRange) {
        editor
          .chain()
          .focus()
          .deleteRange(currentSelectionRange)
          .insertContent(newContent)
          .run();
        setCurrentSelectionRange(null); // Clear range after replacing
      }
    }, [editor, currentSelectionRange]);

    // Callback for popup: Copy content
    const handleCopyContent = useCallback((content: string) => {
      navigator.clipboard.writeText(content).then(() => {
        console.log("AI content copied to clipboard");
        // Optionally show a toast message
      }).catch(err => {
        console.error("Failed to copy text:", err);
      });
    }, []);

    // Add closeAIPopup function with empty dependency array
    const closeAIPopup = useCallback(() => {
      setShowAIPopup(false);
      setAiPopupContent(null);
      setCurrentSelectionRange(null);
    }, []);

    // Expose the insertContent method using useImperativeHandle
    useImperativeHandle(ref, () => ({ // Pass the ref here
      insertContent: (content: string) => {
        if (editor) {
          // Use Tiptap's commands to insert content at the current cursor position
          editor.chain().focus().insertContent(content).run();
        }
      },
    }));

    if (!editor) {
      return null;
    }

    return (
      <div className="document-editor-container relative border border-neutral-300 dark:border-surface-lighter rounded-md overflow-hidden h-full flex flex-col bg-white dark:bg-background">
        <EditorToolbar
          editor={editor}
          isDirty={isDirty}
          isSaving={isSaving}
          saveStatus={saveStatus}
          onSave={handleSave}
        />

        {/* Bubble Menu for Inline Formatting */}
        {editor && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'top-start' }}
            className="flex items-center flex-wrap gap-1 bg-surface dark:bg-surface-darker border border-surface-lighter dark:border-surface-lighter rounded-md shadow-lg px-2 py-1"
            shouldShow={({ from, to }) => {
              // Only show for text selections, not cursor position
              return from !== to;
            }}
          >
            {/* Formatting Buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1 h-auto ${editor.isActive('heading', { level: 1 }) ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Heading 1"
            >
              <Icons.Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1 h-auto ${editor.isActive('heading', { level: 2 }) ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Heading 2"
            >
              <Icons.Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`p-1 h-auto ${editor.isActive('bold') ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Bold (Ctrl+B)"
            >
              <Icons.Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`p-1 h-auto ${editor.isActive('italic') ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Italic (Ctrl+I)"
            >
              <Icons.Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1 h-auto ${editor.isActive('bulletList') ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Bullet List"
            >
              <Icons.List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1 h-auto ${editor.isActive('orderedList') ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Numbered List"
            >
              <Icons.ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1 h-auto ${editor.isActive('blockquote') ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary' : 'text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter'}`}
              title="Blockquote"
            >
              <Icons.Quote className="h-4 w-4" />
            </Button>
            {/* Separator */}
            <div className="h-4 w-px bg-neutral-300 dark:bg-surface-lighter mx-1"></div>
            {/* AI Action Buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAskAi}
              disabled={editor.state.selection.empty}
              className={`p-1 h-auto text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter flex items-center disabled:opacity-50`}
              title="Ask AI about selected text (sends to chat)"
            >
              <Icons.Sparkles className="h-4 w-4 mr-1" /> Ask Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRewrite}
              disabled={editor.state.selection.empty}
              className={`p-1 h-auto text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter flex items-center disabled:opacity-50`}
              title="Rewrite selected text"
            >
              <RefreshCcwIcon className="h-4 w-4 mr-1" /> Rewrite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSummarize}
              disabled={editor.state.selection.empty}
              className={`p-1 h-auto text-text-secondary hover:bg-surface-lighter dark:hover:bg-surface-lighter flex items-center disabled:opacity-50`}
              title="Summarize selected text"
            >
              <TextQuoteIcon className="h-4 w-4 mr-1" /> Summarize
            </Button>
          </BubbleMenu>
        )}

        <div className="editor-content-area flex-grow overflow-y-auto p-0"> {/* Remove padding here, handled by prose class */}
          <EditorContent editor={editor} className="h-full" />
        </div>
        {showAIPopup && (
          <InlineAIPopup
            content={aiPopupContent}
            isLoading={false}
            originalSelectionRange={currentSelectionRange ?? undefined}
            onClose={closeAIPopup}
            onReplace={handleReplaceSelection}
            onCopy={handleCopyContent}
          />
        )}
        {saveError && (
           <div className="text-xs text-error p-2 border-t border-neutral-200 dark:border-surface-lighter bg-red-50 dark:bg-error/10">
             Save Error: {saveError}
           </div>
         )}
      </div>
    );
  }
);

export default DocumentEditor;