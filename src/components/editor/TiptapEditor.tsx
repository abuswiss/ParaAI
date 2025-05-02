import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
import { Decoration, DecorationSet } from '@tiptap/pm/view'; 
import { Node } from '@tiptap/pm/model'; 
import { EditorState } from '@tiptap/pm/state';
import { getEditorExtensions } from '@/lib/editor/extensions';
import { handleSummarizeStream, handleRewriteStream } from '@/services/agentService';
import './TiptapEditor.css';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { BoldToolbar } from "@/components/editor/toolbars/bold";
import { ItalicToolbar } from "@/components/editor/toolbars/italic";
import { UnderlineToolbar } from "@/components/editor/toolbars/underline";
import { HeadingsToolbar } from "@/components/editor/toolbars/headings";
import { Separator } from "@/components/ui/separator";
import { BulletListToolbar } from "@/components/editor/toolbars/bullet-list";
import { OrderedListToolbar } from "@/components/editor/toolbars/ordered-list";
import { BlockquoteToolbar } from "@/components/editor/toolbars/blockquote";
import { SummarizeButton } from '@/components/editor/toolbars/summarize-button';
import { ToolbarProvider } from "@/components/editor/toolbars/toolbar-provider";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { PilcrowSquare, ArrowDownToLine, ArrowUpToLine, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Extension } from '@tiptap/core';
import { EditorExtensionsOptions } from '@/lib/editor/extensions';
import { HighlightInfo, HighlightPosition } from '@/components/documents/DocumentViewer';

type RewriteMode = 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple';

const PLACEHOLDER_REGEX = /\{\{([^}]+?)\}\}/g;

const createPlaceholderDecorations = (doc: Node | null): DecorationSet => {
  if (!doc) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    const text = node.text;
    let match;
    // Reset lastIndex before each exec loop on the same string segment
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      // Basic validation for range
      if (from < to && to <= doc.content.size) { 
          console.log(`Found placeholder: ${match[0]} at [${from}, ${to}]`);
          decorations.push(
              Decoration.inline(from, to, {
                  class: 'placeholder-highlight', // Use specific class
                  nodeName: 'span',
              })
          );
      } else {
          console.warn(`Skipping invalid placeholder match range [${from}, ${to}] for text: ${match[0]}`);
      }
      // Ensure regex progresses if zero-length match possible (though unlikely here)
      if (match.index === PLACEHOLDER_REGEX.lastIndex) {
          PLACEHOLDER_REGEX.lastIndex++;
      }
    }
  });

  if (decorations.length > 0) {
      console.log(`Created ${decorations.length} placeholder decorations.`);
  }
  return DecorationSet.create(doc, decorations);
};

interface TiptapEditorProps {
  content?: string | object;
  editable?: boolean;
  placeholder?: string;
  onChange?: (htmlContent: string) => void;
  onJsonChange?: (jsonContent: object) => void;
  className?: string;
  caseId?: string;
  documentId?: string;
  allHighlights?: HighlightInfo[];
  activeHighlightPosition?: HighlightPosition | null;
}

// *** ADDED: Define Ref type ***
export interface TiptapEditorRef {
  getEditor: () => Editor | null;
}

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>((
  {
    content,
    editable = true,
    placeholder = 'Start typing...',
    onChange,
    onJsonChange,
    className = '',
    caseId,
    documentId,
    allHighlights = [],
    activeHighlightPosition = null
  },
  ref // *** ADDED: Accept ref ***
) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const isFirstChunkRef = useRef(true);

  // Memoize handleSummarize and handleRewrite with only necessary dependencies
  const handleSummarize = useCallback(async (editorInstance: Editor) => {
    if (!caseId || !documentId || isSummarizing || !editable || !editorInstance) return;
    const { from, to, empty } = editorInstance.state.selection;
    if (empty) return;

    const selectedText = editorInstance.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    console.log('Starting summarization for:', selectedText);
    setIsSummarizing(true);
    isFirstChunkRef.current = true;

    const onChunk = (chunk: string) => {
      if (!editorInstance) return;
      editorInstance.view.focus();
      if (isFirstChunkRef.current) {
        const currentSelection = editorInstance.state.selection;
        const insertPos = (currentSelection.from === from && currentSelection.to === to) ? from : currentSelection.from;
        try {
             editorInstance.chain().focus(insertPos).deleteRange({ from, to }).insertContent(chunk).run();
        } catch (e) {
             console.warn("Error deleting range, inserting at current pos:", e);
             editorInstance.chain().focus(insertPos).insertContent(chunk).run();
        }
        isFirstChunkRef.current = false;
      } else {
        editorInstance.chain().focus().insertContent(chunk).run();
      }
    };

    try {
      const result = await handleSummarizeStream(selectedText, onChunk, caseId, documentId);
      if (!result.success) {
        console.error('Summarization failed:', result.error);
        if (!isFirstChunkRef.current) {
          editorInstance?.chain().focus().insertContent(`\n\n[Error summarizing: ${result.error?.message || 'Unknown error'}]`).run();
        }
      }
    } catch (error) {
      console.error('Error calling handleSummarizeStream:', error);
      if (!isFirstChunkRef.current) {
        editorInstance?.chain().focus().insertContent(`\n\n[Error summarizing: ${error instanceof Error ? error.message : 'Unknown error'}]`).run();
      }
    } finally {
      setIsSummarizing(false);
    }
  }, [caseId, documentId, isSummarizing, editable]);

  const handleRewrite = useCallback(async (editorInstance: Editor, mode?: string) => {
    if (!caseId || !documentId || isRewriting || !editable || !editorInstance) return;
    const { from, to, empty } = editorInstance.state.selection;
    if (empty) return;

    const selectedText = editorInstance.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    console.log(`Starting rewrite (mode: ${mode}) for:`, selectedText);
    setIsRewriting(true);
    isFirstChunkRef.current = true;

    const onChunk = (chunk: string) => {
      if (!editorInstance) return;
      editorInstance.view.focus();
      if (isFirstChunkRef.current) {
         const currentSelection = editorInstance.state.selection;
         const insertPos = (currentSelection.from === from && currentSelection.to === to) ? from : currentSelection.from;
        try {
             editorInstance.chain().focus(insertPos).deleteRange({ from, to }).insertContent(chunk).run();
        } catch (e) {
             console.warn("Error deleting range, inserting at current pos:", e);
             editorInstance.chain().focus(insertPos).insertContent(chunk).run();
        }
        isFirstChunkRef.current = false;
      } else {
        editorInstance.chain().focus().insertContent(chunk).run();
      }
    };

    try {
      const result = await handleRewriteStream(selectedText, onChunk, caseId, documentId, mode);
      if (!result.success) {
        console.error('Rewrite failed:', result.error);
        if (!isFirstChunkRef.current) {
          editorInstance?.chain().focus().insertContent(`\n\n[Error rewriting: ${result.error?.message || 'Unknown error'}]`).run();
        }
      }
    } catch (error) {
      console.error('Error calling handleRewriteStream:', error);
      if (!isFirstChunkRef.current) {
        editorInstance?.chain().focus().insertContent(`\n\n[Error rewriting: ${error instanceof Error ? error.message : 'Unknown error'}]`).run();
      }
    } finally {
      setIsRewriting(false);
    }
  }, [caseId, documentId, isRewriting, editable]);

  // Initialize editor AFTER handlers are defined
  const editor = useEditor({
    extensions: getEditorExtensions({
      placeholder: placeholder,
    } as EditorExtensionsOptions) as Extension[],
    content: content || '',
    editable: editable,
    editorProps: {
      attributes: {
        class: cn(
          'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[150px] w-full max-w-full',
          '[&_p]:my-2 [&_h1]:my-4 [&_h2]:my-3 [&_h3]:my-2',
          editable ? 'cursor-text' : 'cursor-default',
        ),
      },
      decorations(state: EditorState): DecorationSet {
          let allDecorations: Decoration[] = [];

          // 1. Create decorations from allHighlights prop (our primary interactive highlights)
          if (allHighlights && Array.isArray(allHighlights)) {
              allHighlights.forEach(highlight => {
                  // Strict validation and error handling
                  if (
                    typeof highlight.start !== 'number' || 
                    typeof highlight.end !== 'number' || 
                    highlight.start < 0 || 
                    highlight.end <= highlight.start || 
                    highlight.end > state.doc.content.size
                  ) {
                      // Skip invalid highlights without error logs in production
                      return;
                  }
                  
                  const from = Math.max(0, highlight.start);
                  const to = Math.min(state.doc.content.size, highlight.end);
                  
                  try {
                      let highlightClass = `analysis-highlight type-${highlight.type}`;
                      
                      // Add risk severity class if present
                      if (highlight.details?.severity) {
                          highlightClass += ` risk-${highlight.details.severity.toLowerCase()}`;
                      }
                      
                      // Check if this highlight is the currently active one
                      if (activeHighlightPosition && 
                          highlight.start === activeHighlightPosition.start && 
                          highlight.end === activeHighlightPosition.end) {
                          highlightClass += ' active-highlight';
                      }

                      // Create a tooltip attribute from details if available
                      let tooltipAttr = '';
                      if (highlight.details) {
                          tooltipAttr = typeof highlight.details === 'string' 
                              ? highlight.details 
                              : (highlight.details.title || highlight.details.explanation || JSON.stringify(highlight.details));
                      }

                      allDecorations.push(
                          Decoration.inline(from, to, {
                              class: highlightClass,
                              'data-highlight-type': highlight.type,
                              'data-highlight-details': JSON.stringify(highlight.details || {}),
                              'title': tooltipAttr || `${highlight.type} highlight`
                          })
                      );
                  } catch (err) {
                      // Silent error in production, log only in development
                      if (process.env.NODE_ENV === 'development') {
                          console.warn('Error creating highlight decoration:', highlight, err);
                      }
                  }
              });
          }

          // 2. Create placeholder decorations (non-interactive, different style)
          try {
              const placeholderDecorations = createPlaceholderDecorations(state.doc);
              allDecorations = allDecorations.concat(placeholderDecorations.find());
          } catch (err) {
              // Silent error in production, log only in development
              if (process.env.NODE_ENV === 'development') {
                  console.warn('Error creating placeholder decorations:', err);
              }
          }

          // 3. Combine and return
          return DecorationSet.create(state.doc, allDecorations);
      }
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      if (onJsonChange) {
        onJsonChange(editor.getJSON());
      }
    },
  }, [editable, placeholder, content]);

  // *** ADDED: Expose editor instance via ref ***
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }));

  // Handle toolbar button clicks (use the functions defined above)
  const handleSummarizeClick = useCallback(() => {
    if (editor) {
      handleSummarize(editor);
    }
  }, [editor, handleSummarize]);

  const handleRewriteClick = useCallback((mode: RewriteMode) => {
    if (editor) {
      handleRewrite(editor, mode);
    }
  }, [editor, handleRewrite]);

  const findAndSelectPlaceholder = useCallback((direction: 'next' | 'previous') => {
    if (!editor || !editable) return;
    const { doc, selection } = editor.state;
    const { from, to } = selection;
    let foundPlaceholder: { from: number; to: number } | null = null;

    // Determine start position for search based on direction
    const searchStartPos = direction === 'next' ? to : from;

    const allPlaceholders: { from: number; to: number }[] = [];
    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            const text = node.text;
            let match;
            PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex index for each node
            while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
                const matchFrom = pos + match.index;
                const matchTo = matchFrom + match[0].length;
                 // Basic range check
                 if (matchFrom < matchTo && matchTo <= doc.content.size) {
                     allPlaceholders.push({ from: matchFrom, to: matchTo });
                 }
                 if (match.index === PLACEHOLDER_REGEX.lastIndex) {
                     PLACEHOLDER_REGEX.lastIndex++; // Prevent infinite loops on empty matches
                 }
            }
        }
    });

    if (allPlaceholders.length === 0) {
        toast.info("No placeholders found in the document.");
        return;
    }

    if (direction === 'next') {
        // Find the first placeholder whose 'from' is >= searchStartPos
        foundPlaceholder = allPlaceholders.find(p => p.from >= searchStartPos) || null;
        // If none found after cursor, wrap around to the first one
        if (!foundPlaceholder) {
            foundPlaceholder = allPlaceholders[0];
        }
    } else { // previous
        // Find the last placeholder whose 'to' is <= searchStartPos
        const candidates = allPlaceholders.filter(p => p.to <= searchStartPos);
        foundPlaceholder = candidates.pop() || null;
        // If none found before cursor, wrap around to the last one
        if (!foundPlaceholder) {
            foundPlaceholder = allPlaceholders[allPlaceholders.length - 1];
        }
    }

    if (foundPlaceholder) {
        editor.chain().focus()
              .setTextSelection({ from: foundPlaceholder.from, to: foundPlaceholder.to })
              .scrollIntoView()
              .run();
    } else {
        // This case should ideally not be reached due to our checks
        console.warn("Could not select a placeholder despite finding some.");
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Function to determine when to show the bubble menu
  const shouldShowBubbleMenu = useCallback(() => {
    if (!editor || !editor.isEditable) return false;
    const { from, to } = editor.state.selection;
    return from !== to; // Show when text is selected
  }, [editor]);

  // Add useEffect to scroll to active highlight when it changes
  useEffect(() => {
    if (editor && activeHighlightPosition) {
      // Add a small delay to ensure rendering is complete
      const timer = setTimeout(() => {
        try {
          // Find the active highlight element and scroll to it
          const highlightElement = document.querySelector('.analysis-highlight.active-highlight');
          if (highlightElement) {
            highlightElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }
        } catch (err) {
          // Silent error in production
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error scrolling to active highlight:', err);
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [editor, activeHighlightPosition]);

  if (!editor) {
    return <div className={cn("flex items-center justify-center min-h-[150px] border rounded-md", className)}><Spinner /></div>;
  }

  return (
    <div className={cn("tiptap-editor-wrapper relative h-full border border-input rounded-md", className)}> 
      {(isSummarizing || isRewriting) && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50 rounded-md">
          <Spinner />
        </div>
      )}
      
      {/* Fixed top toolbar */}
      <div className="border-b border-input p-1 bg-background/80 sticky top-0 z-10">
        <ToolbarProvider editor={editor}>
          <div className="flex items-center gap-1 flex-wrap">
            <BoldToolbar />
            <ItalicToolbar />
            <UnderlineToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" />
            <HeadingsToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" />
            <BulletListToolbar />
            <OrderedListToolbar />
            <BlockquoteToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
                <TooltipTrigger asChild>
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2" 
                        onClick={handleSummarizeClick} 
                        disabled={!caseId || !documentId || isSummarizing || isRewriting}
                    >
                        <StickyNote className="h-4 w-4 mr-1" />
                        <span>Summarize</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Summarize Selection</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-2" 
                      disabled={!caseId || !documentId || isSummarizing || isRewriting}
                    >
                      <PilcrowSquare className="h-4 w-4 mr-1" />
                      <span>Rewrite</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>AI Rewrite Options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => handleRewriteClick('improve')} disabled={isSummarizing || isRewriting}>Improve Writing</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('shorten')} disabled={isSummarizing || isRewriting}>Make Shorter</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('expand')} disabled={isSummarizing || isRewriting}>Expand</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleRewriteClick('professional')} disabled={isSummarizing || isRewriting}>Professional Tone</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('formal')} disabled={isSummarizing || isRewriting}>Formal Tone</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('simple')} disabled={isSummarizing || isRewriting}>Simplify Language</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 placeholder-nav-button"
                        onClick={() => findAndSelectPlaceholder('previous')}
                        disabled={!editable}
                        aria-label="Previous Placeholder"
                    >
                        <ArrowUpToLine className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Previous Placeholder</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 placeholder-nav-button"
                        onClick={() => findAndSelectPlaceholder('next')}
                        disabled={!editable}
                        aria-label="Next Placeholder"
                    >
                        <ArrowDownToLine className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Next Placeholder</TooltipContent>
            </Tooltip>
          </div>
        </ToolbarProvider>
      </div>
      
      {/* Existing bubble menu for text selection */}
      <TooltipProvider>
        <BubbleMenu 
          editor={editor} 
          shouldShow={shouldShowBubbleMenu}
          tippyOptions={{ duration: 100, placement: 'top', offset: [0, 8] }}
          className="flex h-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
        >
          <ToolbarProvider editor={editor}>
            <BoldToolbar />
            <ItalicToolbar />
            <UnderlineToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" />
            <HeadingsToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" />
            <BulletListToolbar />
            <OrderedListToolbar />
            <BlockquoteToolbar />
            <Separator orientation="vertical" className="h-6 mx-1" /> 
            <Tooltip>
              <TooltipTrigger asChild>
                <SummarizeButton 
                    onClick={handleSummarizeClick} 
                    disabled={!caseId || !documentId || isSummarizing || isRewriting} 
                />
              </TooltipTrigger>
              <TooltipContent>Summarize Selection</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-1.5"
                        disabled={!caseId || !documentId || isSummarizing || isRewriting}
                        aria-label="Rewrite options"
                      >
                        <PilcrowSquare className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rewrite Text</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => handleRewriteClick('improve')} disabled={isSummarizing || isRewriting}>Improve Writing</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('shorten')} disabled={isSummarizing || isRewriting}>Make Shorter</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('expand')} disabled={isSummarizing || isRewriting}>Expand</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleRewriteClick('professional')} disabled={isSummarizing || isRewriting}>Professional Tone</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('formal')} disabled={isSummarizing || isRewriting}>Formal Tone</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRewriteClick('simple')} disabled={isSummarizing || isRewriting}>Simplify Language</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarProvider>
        </BubbleMenu>
      </TooltipProvider>
      
      <EditorContent editor={editor} className="h-full p-2 overflow-y-auto" />
    </div>
  );
}); // *** ADDED: Wrap component with forwardRef ***

export default TiptapEditor; // Ensure default export if not already 