import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
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
} from "@/components/ui/DropdownMenu";
import { PilcrowSquare, ArrowDownToLine, ArrowUpToLine, StickyNote, Sparkles, FileText, Type, BookOpen, ClipboardCopy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AnyExtension } from '@tiptap/core';
import { EditorExtensionsOptions } from '@/lib/editor/extensions';
import { HighlightInfo, HighlightPosition } from '@/components/documents/DocumentViewer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type RewriteMode = 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple' | 'custom';

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
  hoveredHighlightPosition?: HighlightPosition | null;
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
    activeHighlightPosition = null,
    hoveredHighlightPosition = null
  },
  ref // *** ADDED: Accept ref ***
) => {
  const editor = useEditor({
    extensions: [
      ...(getEditorExtensions({ placeholder, editable } as EditorExtensionsOptions) as AnyExtension[]),
    ],
    content: content,
    editable: editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      if (onJsonChange) {
        onJsonChange(editor.getJSON());
      }
    },
  }, [
    // Make dependencies more resilient with null checks and defaults
    content || '',
    editable !== undefined ? editable : true,
    placeholder || 'Start typing...',
    // Only include the minimal necessary highlight properties
    // that might trigger a legitimate re-creation
    allHighlights?.length,  // Just track length changes
    !!activeHighlightPosition, // Just track presence, not the whole object
    !!hoveredHighlightPosition // Just track presence, not the whole object
  ]);

  // Effect to scroll to the active highlight position
  useEffect(() => {
    // Only run this effect after editor is FULLY initialized
    if (editor && !editor.isDestroyed && activeHighlightPosition && editor.state) {
      const { start, end } = activeHighlightPosition;
      
      try {
        // Check that editor's state and doc are properly initialized
        if (typeof start === 'number' && 
            typeof end === 'number' && 
            start < end && 
            editor.state.doc && 
            end <= editor.state.doc.content.size) {
          
          console.log(`TiptapEditor: Scrolling to active highlight:`, activeHighlightPosition);
          
          // We'll use a setTimeout to ensure the editor is fully rendered
          setTimeout(() => {
            if (editor && !editor.isDestroyed) {
              // First scroll to the position
              editor.commands.scrollIntoView();
              
              // Then optionally set the selection if needed
              // Uncomment if you want selection behavior
              // editor.commands.setTextSelection({ from: start, to: end });
            }
          }, 0);
        } else {
          console.warn('TiptapEditor: Invalid activeHighlightPosition or editor state:', 
            activeHighlightPosition, 
            'Doc size:', editor.state?.doc?.content?.size);
        }
      } catch (err) {
        console.error('Error in highlight scrolling effect:', err);
      }
    }
  }, [editor, activeHighlightPosition]); // Scrolling effect depends only on editor and active position

  // Effect to update editor decorations when highlight props change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      console.log('[TiptapEditor Effect] Updating editorProps for decorations...');
      editor.setOptions({
        editorProps: {
          decorations(state: EditorState): DecorationSet | undefined {
            const { doc } = state;
            const allDecos: Decoration[] = [];
            
            // --- Placeholder Decorations --- 
            const placeholderDecosSet = createPlaceholderDecorations(doc);
            placeholderDecosSet.find().forEach(deco => allDecos.push(deco));

            // --- Analysis Highlights --- 
            allHighlights?.forEach(highlight => {
              if (typeof highlight.start === 'number' && typeof highlight.end === 'number' && highlight.start < highlight.end && highlight.start >= 0 && highlight.end <= doc.content.size) {
                let highlightClass = `highlight highlight-${highlight.type}`; // Base class
                const isActive = activeHighlightPosition?.start === highlight.start && activeHighlightPosition?.end === highlight.end;
                const isHovered = hoveredHighlightPosition?.start === highlight.start && hoveredHighlightPosition?.end === highlight.end;

                if (isActive) {
                  highlightClass += ' highlight-active';
                }
                if (isHovered) {
                   highlightClass += ' highlight-hovered'; 
                }

                allDecos.push(
                  Decoration.inline(highlight.start, highlight.end, {
                    class: highlightClass,
                    nodeName: 'span',
                  })
                );
              } else {
                 console.warn('[TiptapEditor] Skipping invalid highlight data in setOptions:', highlight);
              }
            });

            console.log(`[TiptapEditor setOptions Decor Func] Calculated: ${allDecos.length} total decorations`);
            return DecorationSet.create(doc, allDecos);
          }
        }
      });
    }
  }, [editor, allHighlights, activeHighlightPosition, hoveredHighlightPosition]); // Re-run when highlight props change

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Memoize handleSummarize and handleRewrite with only necessary dependencies
  const handleSummarize = useCallback(async (editorInstance: Editor) => {
    if (!caseId || !documentId || isSummarizing || !editable || !editorInstance || editorInstance.isDestroyed) return;
    const { from, to, empty } = editorInstance.state.selection;
    if (empty) return;

    const selectedText = editorInstance.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    console.log('Starting summarization for:', selectedText);
    setIsSummarizing(true);
    setSummaryResult(null);
    setShowSummaryDialog(false);

    try {
      // Define a dummy onChunk callback to satisfy the function signature
      const dummyOnChunk = (/*chunk: string*/) => { 
        // console.log("Summarize chunk (ignored):", chunk);
      }; 

      // Call the agent service with the correct arguments
      const result = await handleSummarizeStream(
        selectedText,
        dummyOnChunk, // Pass the dummy callback
        caseId, // caseId should be guaranteed by the initial check
        documentId // documentId should be guaranteed by the initial check
        // Optional args like surroundingContext, instructions, taskId etc. can be added if needed
      );

      console.log("Full summary received:", result.answer);

      // Use result.answer and check for success
      if (result.success && result.answer && result.answer.trim()) {
        setSummaryResult(result.answer);
        setShowSummaryDialog(true); // Open the dialog with the result
      } else {
        const errorMsg = result.error?.message || "Summarization failed to produce a result or returned empty.";
        toast.error(errorMsg);
        setSummaryResult(null);
      }

    } catch (error) {
      console.error('Error during summarization stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Summarization failed: ${message}`);
      setSummaryResult(null); // Clear result on error
      setShowSummaryDialog(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [caseId, documentId, isSummarizing, editable]);

  const handleRewrite = useCallback(async (mode: RewriteMode, editorInstance: Editor, customInstructions?: string) => {
    if (!caseId || !documentId || isRewriting || !editable || !editorInstance || editorInstance.isDestroyed) return;
    const { from, to, empty } = editorInstance.state.selection;
    if (empty) return;

    const selectedText = editorInstance.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    console.log(`Starting rewrite (mode: ${mode}) for:`, selectedText);
    setIsRewriting(true);

    const selectionRange = { from, to };

    try {
      // Define a dummy onChunk callback with explicit type
      const dummyOnChunk: (chunk: string) => void = (/*chunk: string*/) => { 
        // console.log("Rewrite chunk (ignored):", chunk); 
      };

      // Call the agent service with the correct arguments based on ACTUAL signature
      const result = await handleRewriteStream(
        selectedText,        // Arg 1
        dummyOnChunk,        // Arg 2
        caseId,              // Arg 3
        documentId,          // Arg 4
        undefined,           // Arg 5: surroundingContext (pass undefined for now)
        customInstructions   // Arg 6: instructions (pass customInstructions here if desired, or mode-specific if needed)
      );

      console.log(`Full rewrite (mode: ${mode}) received:`, result.answer);

       // Use result.answer and check for success
      if (result.success && result.answer && result.answer.trim()) {
         // Insert the full response, replacing the original selection
        editorInstance.chain()
            .focus() // Ensure editor has focus before inserting
            .insertContentAt(selectionRange, result.answer) // Replace content at original selection
            .run();
      } else {
         const errorMsg = result.error?.message || `Rewrite (mode: ${mode}) failed to produce a result or returned empty.`;
         toast.error(errorMsg);
      }

    } catch (error) {
      console.error(`Error during rewrite stream (mode: ${mode}):`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Rewrite (mode: ${mode}) failed: ${message}`);
    } finally {
      setIsRewriting(false);
    }
  }, [caseId, documentId, isRewriting, editable]);

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

  // Copy summary to clipboard
  const copySummaryToClipboard = useCallback(async () => {
    if (!summaryResult) return;
    try {
      await navigator.clipboard.writeText(summaryResult);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500); // Reset after 1.5s
    } catch (err) {
      console.error('Failed to copy summary: ', err);
      toast.error("Failed to copy summary to clipboard.");
    }
  }, [summaryResult]);

  if (!editor) {
    return <div className={cn("flex items-center justify-center min-h-[150px] border rounded-md", className)}><Spinner /></div>;
  }

  // Define AI Menu Items
  const aiMenuItems = [
    { label: 'Improve', mode: 'improve', icon: Sparkles },
    { label: 'Shorten', mode: 'shorten', icon: Type },
    { label: 'Expand', mode: 'expand', icon: BookOpen },
    { label: 'Professional', mode: 'professional', icon: Type },
    { label: 'Formal', mode: 'formal', icon: Type },
    { label: 'Simple', mode: 'simple', icon: Type },
    { label: 'Summarize', action: () => handleSummarize(editor), icon: FileText, isAction: true },
    // Add 'custom' later if needed
  ];

  return (
    <div className={cn("flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden bg-white dark:bg-neutral-950 shadow-sm h-full", className)}>
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
                {aiMenuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    className="hover:bg-muted focus:bg-muted cursor-pointer"
                    onSelect={() => item.isAction ? item.action() : handleRewrite(item.mode as RewriteMode, editor)}
                    disabled={isRewriting || isSummarizing}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
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
                {aiMenuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    className="hover:bg-muted focus:bg-muted cursor-pointer"
                    onSelect={() => item.isAction ? item.action() : handleRewrite(item.mode as RewriteMode, editor)}
                    disabled={isRewriting || isSummarizing}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarProvider>
        </BubbleMenu>
      </TooltipProvider>
      
      <ScrollArea className="flex-1">
        <EditorContent editor={editor} className="p-4 min-h-[200px] focus:outline-none prose dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2" />
      </ScrollArea>

      {/* --- Summary Dialog --- */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-neutral-900 dark:text-neutral-100">Summary</DialogTitle>
            <DialogDescription className="text-neutral-600 dark:text-neutral-400">
              AI-generated summary of the selected text.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] my-4 pr-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryResult || ''}
              </ReactMarkdown>
            </div>
          </ScrollArea>
          <DialogFooter className="sm:justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={copySummaryToClipboard}
              disabled={!summaryResult}
              className="text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {copySuccess ? <Check className="h-4 w-4 mr-1 text-green-500" /> : <ClipboardCopy className="h-4 w-4 mr-1" />}
              {copySuccess ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" onClick={() => setShowSummaryDialog(false)} className="bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- End Summary Dialog --- */}
    </div>
  );
});

export default TiptapEditor;