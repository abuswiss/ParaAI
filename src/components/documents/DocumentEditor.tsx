import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useSetAtom } from 'jotai';
import { editorTextToQueryAtom, ActiveEditorItem as AppActiveEditorItem } from '@/atoms/appAtoms';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
import { editorExtensions } from '@/lib/editor/extensions';
import { Spinner } from '@/components/ui/Spinner';
import { Icons as CustomIcons } from '@/components/ui/Icons';
import {
  Sparkles,
  TextQuote as TextQuoteIcon,
  RefreshCcw,
} from 'lucide-react';
import './DocumentEditor.css';
import InlineAIPopup from '@/components/editor/InlineAIPopup';
import { handleRewriteStream, handleSummarizeStream } from '@/services/chatService';
import { toast } from 'sonner';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { Button } from "@/components/ui/Button";

export type ActiveEditorItem = AppActiveEditorItem | { type: 'template'; id: string };

export interface DocumentEditorRef {
  insertContent: (content: string) => void;
  getContent: () => string | undefined;
  editor: Editor | null;
}

interface DocumentEditorProps {
  initialContent: string;
  editorItem: ActiveEditorItem;
  showToolbar?: boolean;
  isSaving: boolean;
  saveStatus: 'Idle' | 'Saving' | 'Saved' | 'Error';
  isDirty: boolean;
  onSave: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaveStatusChange: (status: DocumentEditorProps['saveStatus']) => void;
}

const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  ({
    initialContent,
    editorItem,
    showToolbar = true,
    isSaving,
    saveStatus,
    isDirty,
    onSave,
    onDirtyChange,
  }, ref) => {
    const [showAIPopup, setShowAIPopup] = useState(false);
    const [aiPopupContent, setAiPopupContent] = useState<string | null>(null);
    const [isAILoading, setIsAILoading] = useState(false);
    const [currentSelectionRange, setCurrentSelectionRange] = useState<{ from: number; to: number } | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);

    const setTextToQuery = useSetAtom(editorTextToQueryAtom);

    const editor = useEditor({
      extensions: editorExtensions,
      content: initialContent,
      editable: true,
      editorProps: {
        attributes: {
          class: 'focus:outline-none dark:text-neutral-100 text-neutral-900 p-4 h-full w-full',
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        onDirtyChange(!currentEditor.state.doc.textContent.length || !currentEditor.isEmpty);
      },
      onSelectionUpdate: ({ editor: currentEditor }) => {
        const { from, to } = currentEditor.state.selection;
        if (!currentEditor.state.selection.empty) {
            setCurrentSelectionRange({ from, to });
        } else {
            setCurrentSelectionRange(null);
            setShowAIPopup(false);
        }
      },
    });

    useImperativeHandle(ref, () => ({
      insertContent: (content: string) => {
        editor?.chain().focus().insertContent(content).run();
      },
      getContent: () => {
        return editor?.getHTML();
      },
      editor: editor,
    }), [editor]);

    useEffect(() => {
        if (editor && initialContent !== editor.getHTML()) {
            editor.commands.setContent(initialContent);
            onDirtyChange(false); 
        }
    }, [initialContent, editor, onDirtyChange]);

    const calculatePopupPosition = useCallback(() => {
      if (!editor || !editor.view || !currentSelectionRange) return;
      try {
          const coords = editor.view.coordsAtPos(currentSelectionRange.from);
          setPopupPosition({ top: coords.top, left: coords.left });
      } catch (e) {
          console.error("Error calculating popup position:", e);
          setPopupPosition(null);
      }
    }, [editor, currentSelectionRange]);

    const handleAskAi = useCallback(() => {
      if (!editor || !currentSelectionRange) return;
      const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
      setTextToQuery(selectedText);
      setShowAIPopup(false);
      setAiPopupContent(null);
    }, [editor, currentSelectionRange, setTextToQuery]);

    const handleRewrite = useCallback(async () => {
      if (!editor || !currentSelectionRange) return;
      const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
      
      calculatePopupPosition();
      setShowAIPopup(true);
      setAiPopupContent('');
      setIsAILoading(true);
      setAiError(null);

      try {
          const handleChunk = (chunk: string) => {
              setAiPopupContent((prev) => (prev ?? '') + chunk);
          };
          const result = await handleRewriteStream(selectedText, handleChunk);
          if (!result.success || result.error) {
              throw result.error || new Error('Rewrite failed.');
          }
      } catch (error) {
          console.error("Error during rewrite:", error);
          setAiError(error instanceof Error ? error.message : "An unknown error occurred during rewrite.");
          setAiPopupContent(null);
      } finally {
          setIsAILoading(false);
      }
    }, [editor, currentSelectionRange, calculatePopupPosition]);

    const handleSummarize = useCallback(async () => {
      if (!editor || !currentSelectionRange) return;
      const selectedText = editor.state.doc.textBetween(currentSelectionRange.from, currentSelectionRange.to);
      
      calculatePopupPosition();
      setShowAIPopup(true);
      setAiPopupContent('');
      setIsAILoading(true);
      setAiError(null);

      try {
          const handleSummaryChunk = (chunk: string) => {
              setAiPopupContent((prev) => (prev ?? '') + chunk);
          };
          const result = await handleSummarizeStream(selectedText, handleSummaryChunk, undefined, "Summarize concisely.");
          if (!result.success || result.error) {
              throw result.error || new Error('Summarization failed.');
          }
      } catch (error) {
          console.error("Error during summarization:", error);
          setAiError(error instanceof Error ? error.message : "An unknown error occurred during summarization.");
          setAiPopupContent(null);
      } finally {
          setIsAILoading(false);
      }
    }, [editor, currentSelectionRange, calculatePopupPosition]);

    const handleReplaceSelection = useCallback((newContent: string) => {
      if (editor && currentSelectionRange) {
        editor
          .chain()
          .focus()
          .deleteRange(currentSelectionRange)
          .insertContent(newContent)
          .run();
        setShowAIPopup(false);
        setAiPopupContent(null);
        setCurrentSelectionRange(null);
        setAiError(null);
        onDirtyChange(true);
        toast.success('Text replaced successfully!');
      }
    }, [editor, currentSelectionRange, onDirtyChange]);

    const handleCopyContent = useCallback((contentToCopy: string) => {
      navigator.clipboard.writeText(contentToCopy).then(() => {
        toast.info('Copied to clipboard');
      }).catch(err => {
        console.error("Failed to copy text:", err);
        toast.error('Failed to copy');
      });
    }, []);

    const handleCloseAIPopup = useCallback(() => {
      setShowAIPopup(false);
      setAiPopupContent(null);
      setPopupPosition(null);
      setAiError(null);
    }, []);

    return (
      <div className="document-editor flex flex-col h-full relative bg-background">
        {showToolbar && editor && (
          <EditorToolbar
            editor={editor}
            editorType={editorItem?.type ?? null}
            isDirty={isDirty}
            isSaving={isSaving}
            saveStatus={saveStatus}
            onSave={onSave}
            onAskAi={handleAskAi}
            onRewrite={handleRewrite}
            onSummarize={handleSummarize}
            hasSelection={!!currentSelectionRange}
          />
        )}

        {editor && (
             <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: 'top-start' }}
                className="bg-background dark:bg-muted shadow-lg rounded-md border border-border p-1 flex items-center space-x-1"
                shouldShow={({ editor: currentEditor }) => !currentEditor.state.selection.empty}
            >
                <Button variant="ghost" size="sm" onClick={handleAskAi} title="Send to Chat" className="p-1 text-xs">
                    <Sparkles className="h-4 w-4 mr-1" /> Ask AI
                </Button>
                 <Button variant="ghost" size="sm" onClick={handleRewrite} title="Rewrite" className="p-1 text-xs">
                    <RefreshCcw className="h-4 w-4 mr-1" /> Rewrite
                </Button>
                 <Button variant="ghost" size="sm" onClick={handleSummarize} title="Summarize" className="p-1 text-xs">
                    <TextQuoteIcon className="h-4 w-4 mr-1" /> Summarize
                </Button>
             </BubbleMenu>
        )}
        
        <div className="flex-grow overflow-y-auto relative">
            <EditorContent editor={editor} className="h-full" />
        </div>

        {
          showAIPopup && editor && currentSelectionRange && popupPosition && (
            <InlineAIPopup
              originalSelectionRange={currentSelectionRange}
              content={aiPopupContent}
              isLoading={isAILoading}
              error={aiError}
              position={popupPosition}
              onReplace={handleReplaceSelection}
              onCopy={handleCopyContent}
              onClose={handleCloseAIPopup}
            />
          )
        }
      </div>
    );
  }
);

DocumentEditor.displayName = 'DocumentEditor';

export default DocumentEditor;