import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
import { Decoration, DecorationSet } from '@tiptap/pm/view'; 
import { Node } from '@tiptap/pm/model'; 
import { EditorState } from '@tiptap/pm/state';
import { getEditorExtensions, EditorExtensionsOptions } from '@/lib/editor/extensions';
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
import { FloatingToolbarComponent } from '@/lib/editor/extensions/FloatingToolbar';
import { createPortal } from 'react-dom';

type RewriteMode = 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple' | 'custom';

const PLACEHOLDER_REGEX = /\{\{([^}]+?)\}\}/g;

const SUGGESTION_PORTAL_ID = 'suggestion-banner-portal-root';

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
  // --- Define Callbacks FIRST ---
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- SUGGESTION STATE (Updated) ---
  const [suggestion, setSuggestion] = useState<{
    from: number;         // Original start position
    to: number;           // Original end position (less critical now, but good for context)
    newTo: number;        // End position *after* temporary insertion
    suggestionText: string; // The AI's suggestion
    originalText: string;   // The original selected text
  } | null>(null);

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
      const dummyOnChunk = (/*chunk: string*/) => { /* NOOP */ };
      const result = await handleSummarizeStream(
        selectedText,
        dummyOnChunk,
        caseId,
        documentId
      );
      console.log("Full summary received:", result.answer);
      if (result.success && result.answer && result.answer.trim()) {
        setSummaryResult(result.answer);
        setShowSummaryDialog(true);
      } else {
        const errorMsg = result.error?.message || "Summarization failed to produce a result or returned empty.";
        toast.error(errorMsg);
        setSummaryResult(null);
      }
    } catch (error) {
      console.error('Error during summarization stream:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Summarization failed: ${message}`);
      setSummaryResult(null);
      setShowSummaryDialog(false);
    } finally {
      setIsSummarizing(false);
    }
  }, [caseId, documentId, isSummarizing, editable]);

  // --- HANDLE REWRITE (Updated for temporary replacement) ---
  const handleRewrite = useCallback(async (mode: RewriteMode, editorInstance: Editor, customInstructions?: string) => {
    if (!caseId || !documentId || isRewriting || !editable || !editorInstance || editorInstance.isDestroyed || suggestion) {
      if (suggestion) {
        toast.info("Please accept or decline the current suggestion first.");
      }
      return;
    }
    const { state } = editorInstance;
    const { from, to, empty } = state.selection;
    if (empty) return;

    // Store original text *before* any changes
    const originalText = state.doc.textBetween(from, to, '\n\n'); // Use double newline as block separator
    if (!originalText.trim()) return;

    setIsRewriting(true);
    try {
      const dummyOnChunk: (chunk: string) => void = () => {};
      const result = await handleRewriteStream(
        originalText, // Send the original text for rewrite
        dummyOnChunk,
        caseId,
        documentId,
        undefined,
        customInstructions || `Rewrite the text to be ${mode}`
      );

      if (result.success && result.answer && result.answer.trim() && !editorInstance.isDestroyed) {
        const suggestionText = result.answer.trim();

        // Perform the temporary replacement
        let newEndPos = to; // Default if insertion fails or is empty
        if (suggestionText) {
          // Insert and get the transaction to find the new end position
          // Use insertContentAt to handle potential formatting in suggestionText (parsed by editor)
          editorInstance.chain().focus().insertContentAt({ from, to }, suggestionText).run();
          // The new end position needs careful calculation based on the change
          // Easiest way: 'from' + length of the *plaintext* version of inserted content
          // Or, rely on the selection potentially being updated after insertContentAt
          newEndPos = editorInstance.state.selection.to; // Tiptap often selects the inserted content
          // Fallback if selection didn't move as expected:
          if (newEndPos <= from) { 
             newEndPos = from + suggestionText.length; // Estimate based on raw text length
          }

        } else {
          toast.info("AI suggestion was empty.");
          setIsRewriting(false);
          return;
        }

        // Set the state with all necessary info AFTER the temporary insertion
        setSuggestion({
          from: from,           // Original start
          to: to,             // Original end
          newTo: newEndPos,     // NEW end position
          suggestionText: suggestionText,
          originalText: originalText, // Stored original text
        });

      } else {
        const errorMsg = result.error?.message || `Rewrite (mode: ${mode}) failed to produce a result or returned empty.`;
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Rewrite (mode: ${mode}) failed: ${message}`);
    } finally {
      setIsRewriting(false);
    }
  }, [caseId, documentId, isRewriting, editable, suggestion]);

  // --- Now Define Editor Options using the callbacks ---
  const editorOptions = {
    placeholder,
    editable,
    floatingToolbar: {
      onSummarize: handleSummarize,
      onRewrite: handleRewrite,
      isSummarizing,
      isRewriting,
    },
    onSummarize: handleSummarize,
    onRewrite: handleRewrite,
  } as EditorExtensionsOptions;

  // Get all extensions FIRST (Before editor initialization)
  const allEditorExtensions = getEditorExtensions(editorOptions) as AnyExtension[];

  // --- Editor Initialization (Uses allEditorExtensions) ---
  const editor = useEditor({
    extensions: allEditorExtensions,
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
  });

  // --- Accept/Decline Handlers (Updated) ---
  const handleAcceptSuggestion = useCallback(() => {
    if (!editor || !suggestion) return;
    // Text is already updated, just clear the suggestion state
    setSuggestion(null);
    // Optional: Move cursor to end of accepted text
    editor.chain().focus().setTextSelection(suggestion.newTo).run();
  }, [editor, suggestion]);

  const handleDeclineSuggestion = useCallback(() => {
    if (!editor || !suggestion) return;
    // Revert to original text using the stored info
    editor.chain().focus()
          .insertContentAt({ from: suggestion.from, to: suggestion.newTo }, suggestion.originalText)
          .setTextSelection(suggestion.from + suggestion.originalText.length)
          .run();
    setSuggestion(null);
  }, [editor, suggestion]);

  // --- Add suggestion highlight to decorations ---
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setOptions({
      editorProps: {
        decorations(state: EditorState): DecorationSet | undefined {
          if (!state || !state.doc) return DecorationSet.empty;
          const { doc } = state;
          let decorations: Decoration[] = [];

          // Suggestion highlight (Uses newTo)
          if (suggestion) {
            // Ensure the range is valid before creating decoration
            if (suggestion.from < suggestion.newTo && suggestion.newTo <= doc.content.size) {
               decorations.push(
                 Decoration.inline(suggestion.from, suggestion.newTo, { // Use from and newTo
                   class: 'ai-suggestion-highlight',
                 })
               );
            } else {
                console.warn("Invalid range for suggestion decoration:", suggestion);
            }
          }

          // Placeholder highlights
          const placeholderDecosSet = createPlaceholderDecorations(doc);
          decorations = decorations.concat(placeholderDecosSet.find());

          // Custom highlight decorations
          if (Array.isArray(allHighlights)) {
            allHighlights.forEach(highlight => {
              if (
                highlight &&
                typeof highlight.start === 'number' &&
                typeof highlight.end === 'number' &&
                highlight.start < highlight.end &&
                highlight.start >= 0 &&
                highlight.end <= doc.content.size
              ) {
                let highlightClass = `highlight highlight-${highlight.type || 'default'}`;
                if (activeHighlightPosition?.start === highlight.start &&
                    activeHighlightPosition?.end === highlight.end) {
                  highlightClass += ' highlight-active';
                }
                if (hoveredHighlightPosition?.start === highlight.start &&
                    hoveredHighlightPosition?.end === highlight.end) {
                  highlightClass += ' highlight-hovered';
                }
                decorations.push(
                  Decoration.inline(highlight.start, highlight.end, {
                    class: highlightClass,
                    nodeName: 'span',
                  })
                );
              }
            });
          }

          return DecorationSet.create(doc, decorations);
        }
      }
    });
  }, [editor, suggestion, allHighlights, activeHighlightPosition, hoveredHighlightPosition]);

  // Effect to scroll to the active highlight position
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (activeHighlightPosition && editor.view && editor.state) {
      const { start, end } = activeHighlightPosition;
      try {
        if (typeof start === 'number' && typeof end === 'number' && start < end && start >= 0 && end <= editor.state.doc.content.size) {
          setTimeout(() => {
            if (editor && !editor.isDestroyed) {
              editor.commands.scrollIntoView();
            }
          }, 50);
        }
      } catch (err) {
        console.error('Error in highlight scrolling:', err);
      }
    }
  }, [editor, activeHighlightPosition]);

  // Effect to update editor editable state
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Effect to destroy editor on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Effect to update extensions when suggestion changes
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      extensions: getEditorExtensions(
        {
          placeholder,
          floatingToolbar: {
            onSummarize: handleSummarize,
            onRewrite: handleRewrite,
            isSummarizing,
            isRewriting,
            isSuggestionActive: !!suggestion,
          },
          onSummarize: handleSummarize,
          onRewrite: handleRewrite,
        },
        editor
      ),
    });
  }, [editor, suggestion]);

  // --- Portal Container Setup ---
  useEffect(() => {
    // Check if portal root already exists (e.g., due to fast refresh)
    let portalRoot = document.getElementById(SUGGESTION_PORTAL_ID);
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = SUGGESTION_PORTAL_ID;
      // Style the portal root to position it correctly (e.g., above the editor)
      // This might need adjustment based on your overall layout
      portalRoot.style.position = 'fixed'; // Or absolute relative to a container
      portalRoot.style.top = '80px'; // Example: Adjust as needed
      portalRoot.style.left = '0';
      portalRoot.style.right = '0';
      portalRoot.style.zIndex = '1050'; // High z-index
      portalRoot.style.pointerEvents = 'none'; // Allow clicks through by default

      document.body.appendChild(portalRoot);
    }

    // Cleanup function
    return () => {
      const existingPortalRoot = document.getElementById(SUGGESTION_PORTAL_ID);
      if (existingPortalRoot && existingPortalRoot.parentNode === document.body) {
        document.body.removeChild(existingPortalRoot);
      }
    };
  }, []); // Run only once on mount

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

  // Add a dummy state for forcing re-renders when plugin state changes
  const [, forceUpdate] = useState({});

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

  // --- SUGGESTION CONTROLS (Now uses Portal) ---
  const SuggestionControls = () => {
    const portalContainer = document.getElementById(SUGGESTION_PORTAL_ID);

    // Only render if suggestion exists AND the portal root is available
    if (!suggestion || !portalContainer) {
      return null;
    }

    // Render the banner content into the portal
    return createPortal(
      <div
        className="ai-suggestion-banner"
        // Removed position/z-index styles as they are on the portal root now
        style={{
          width: '100%',
          maxWidth: 'calc(100% - 40px)', // Example: Prevent full width bleed
          margin: '0 auto', // Center the banner
          background: '#fffbe6',
          border: '1.5px solid #ffe066',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '10px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          fontSize: '1rem',
          fontWeight: 500,
          animation: 'fadeIn 0.2s',
          pointerEvents: 'auto', // Enable pointer events for the banner itself
        }}
      >
        <span className="text-neutral-800">AI suggestion ready. Accept or decline?</span>
        <Button size="sm" variant="default" onClick={handleAcceptSuggestion}>Accept</Button>
        <Button size="sm" variant="destructive" onClick={handleDeclineSuggestion}>Decline</Button>
      </div>,
      portalContainer // Target the portal root div
    );
  };

  return (
    <div className={cn("flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden bg-white dark:bg-neutral-950 shadow-sm h-full", className)} style={{ position: 'relative' }}>
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
                        disabled={!caseId || !documentId || !editable || isSummarizing || isRewriting}
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
                      disabled={!caseId || !documentId || !editable || isSummarizing || isRewriting}
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
                    disabled={!editable || isSummarizing || isRewriting}
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
                        disabled={!editable || isSummarizing || isRewriting}
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
                        disabled={!editable || isSummarizing || isRewriting}
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
      {/* Render the FloatingToolbarComponent for inline actions */}
      {editor && (
        <FloatingToolbarComponent
          editor={editor}
          options={{
            onSummarize: handleSummarize,
            onRewrite: handleRewrite,
            isSummarizing,
            isRewriting,
            isSuggestionActive: !!suggestion,
          }}
        />
      )}
      
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
              disabled={!summaryResult || isSummarizing || isRewriting}
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
      <SuggestionControls />
    </div>
  );
});

export default TiptapEditor;