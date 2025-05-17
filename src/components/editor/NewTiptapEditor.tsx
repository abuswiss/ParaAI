import React, { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import EditorToolbar from './toolbars/EditorToolbar';

interface NewTiptapEditorProps {
  content: string | object;
  editable: boolean;
  onChangeHtml?: (html: string) => void;
  onChangeJson?: (json: object) => void;
  onContentUpdate?: () => void;
  placeholder?: string;
  onSummarize?: () => void;
  onRewrite?: (mode: string) => void;
  onGenerate?: () => void;
}

export interface NewTiptapEditorRef {
  getHTML: () => string;
  getJSON: () => object;
  setContent: (content: string | object, emitUpdate?: boolean) => void;
  focus: (position?: 'start' | 'end' | 'all' | number | null, options?: { scrollIntoView?: boolean }) => void;
  scrollToPosition: (position: number) => void;
  addMarkToRange: (start: number, end: number, markType: string, attributes?: Record<string, any>) => void;
  removeMarkFromRange: (start: number, end: number, markType: string) => void;
  clearMarks: (markType?: string) => void;
  getSelectedText: () => string;
  getFullText: () => string;
  getSelectionRange: () => { from: number; to: number; isEmpty: boolean };
}

const NewTiptapEditor = forwardRef<NewTiptapEditorRef, NewTiptapEditorProps>((
  {
    content,
    editable,
    onChangeHtml,
    onChangeJson,
    onContentUpdate,
    placeholder = 'Start typing...',
    onSummarize,
    onRewrite,
    onGenerate
  },
  ref
) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: true, autolink: true, defaultProtocol: 'https' }),
    ],
    content: typeof content === 'string' ? content : JSON.stringify(content),
    editable,
    onUpdate: ({ editor: currentEditor }: { editor: Editor }) => {
      if (onChangeHtml) {
        onChangeHtml(currentEditor.getHTML());
      }
      if (onChangeJson) {
        onChangeJson(currentEditor.getJSON());
      }
      if (onContentUpdate) {
        onContentUpdate();
      }
    },
  });

  useImperativeHandle(ref, () => ({
    editor,
    getHTML: () => editor?.getHTML() || '',
    getJSON: () => editor?.getJSON() || {},
    setContent: (newContent: string | object, emitUpdate?: boolean) => {
      if (editor) {
        if (typeof newContent === 'string') {
          editor.commands.setContent(newContent, emitUpdate);
        } else {
          editor.commands.setContent(newContent as any, emitUpdate);
        }
      }
    },
    focus: (position, options) => {
      editor?.chain().focus(position, options).run();
    },
    scrollToPosition: (position: number) => {
      editor?.commands.setTextSelection({ from: position, to: position });
      editor?.commands.scrollIntoView();
    },
    addMarkToRange: (start: number, end: number, markType: string, attributes?: Record<string, any>) => {
      editor?.chain().setTextSelection({ from: start, to: end }).setMark(markType, attributes).run();
    },
    removeMarkFromRange: (start: number, end: number, markType: string) => {
      editor?.chain().setTextSelection({ from: start, to: end }).unsetMark(markType).run();
    },
    clearMarks: (markType?: string) => {
      if (markType) {
        editor?.chain().focus().unsetMark(markType).run();
      } else {
        editor?.chain().focus().unsetAllMarks().run();
      }
    },
    getSelectedText: () => {
      if (!editor || editor.state.selection.empty) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, " \n\n ");
    },
    getFullText: () => {
      return editor?.state.doc.textContent || '';
    },
    getSelectionRange: () => {
      if (!editor) return { from: 0, to: 0, isEmpty: true };
      const { from, to, empty } = editor.state.selection;
      return { from, to, isEmpty: empty };
    }
  }), [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full w-full focus:outline-none">
      {editable && (
        <EditorToolbar 
          editor={editor} 
          onSummarize={onSummarize}
          onRewrite={onRewrite}
          onGenerate={onGenerate}
        />
      )}
      <div className="prose dark:prose-invert max-w-none w-full flex-grow focus:outline-none p-4 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export default NewTiptapEditor; 