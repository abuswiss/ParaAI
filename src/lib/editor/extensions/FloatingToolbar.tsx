"use client"

import React, { useEffect, useState, useCallback, useContext } from "react"
import { BubbleMenu, Editor, Extension } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useMediaQuery } from "@/hooks/use-media-query"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { ToolbarProvider } from "@/components/editor/toolbars/toolbar-provider"
import { Spinner } from "@/components/ui/Spinner"
import { Button } from "@/components/ui/Button"
import { AlertCircle, Check, ChevronDown, PilcrowSquare, StickyNote } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/DropdownMenu"

import { BoldToolbar } from "@/components/editor/toolbars/bold"
import { ItalicToolbar } from "@/components/editor/toolbars/italic"
import { UnderlineToolbar } from "@/components/editor/toolbars/underline"
import { LinkToolbar } from "./link"
import { ColorHighlightToolbar } from "./color-and-highlight"
import { HeadingsToolbar } from "@/components/editor/toolbars/headings"
import { BulletListToolbar } from "@/components/editor/toolbars/bullet-list"
import { OrderedListToolbar } from "@/components/editor/toolbars/ordered-list"
import { AlignmentTooolbar } from "./alignment"
import { BlockquoteToolbar } from "@/components/editor/toolbars/blockquote"
import { SummarizeButton } from '@/components/editor/toolbars/summarize-button'
import { VariableToolbarButton } from "@/components/editor/toolbars/variable-button"

type AIFunction = (text: string) => Promise<string>

interface FloatingToolbarProps {
  editor: Editor | null
}

interface AIState {
  isLoading: boolean;
  result: string | null;
  error: string | null;
  originalText: string | null;
  originalRange: { from: number; to: number } | null;
}

export interface FloatingToolbarOptions {
  onSummarize?: (editor: Editor) => Promise<void> | void;
  onRewrite?: (editor: Editor, mode?: RewriteMode) => Promise<void> | void;
  isSummarizing?: boolean;
  isRewriting?: boolean;
  isSuggestionActive?: boolean;
}

type RewriteMode = 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple';

const FloatingToolbarComponent: React.FC<{ editor: Editor, options: FloatingToolbarOptions }> = ({ 
    editor, 
    options 
}) => {
  const { onSummarize, onRewrite, isSummarizing, isRewriting } = options;
  const isMobile = useMediaQuery("(max-width: 640px)")

  const handleSummarizeClick = useCallback(() => {
      console.log('Summarize button clicked!', { editor, onSummarize });
      if (editor && onSummarize) {
          console.log('Calling onSummarize handler');
          onSummarize(editor);
      } else {
          console.log('Cannot call onSummarize - editor or handler missing', { editorExists: !!editor, handlerExists: !!onSummarize });
      }
  }, [editor, onSummarize]);

  const handleRewriteClick = useCallback((mode: RewriteMode) => {
      console.log('Rewrite button clicked!', { editor, onRewrite, mode });
      if (editor && onRewrite) {
          console.log('Calling onRewrite handler with mode:', mode);
          onRewrite(editor, mode);
      } else {
          console.log('Cannot call onRewrite - editor or handler missing', { editorExists: !!editor, handlerExists: !!onRewrite });
      }
  }, [editor, onRewrite]);

  const handleMarkAsVariable = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText || selectedText.trim().length === 0) return;

    // Format the selected text into a variable name
    // Example: "Client Name" -> "client_name"
    const variableName = selectedText
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[^a-z0-9_]/g, ''); // Remove non-alphanumeric characters except underscore

    if (!variableName) {
        console.warn("Could not create a valid variable name from selection:", selectedText);
        return;
    }

    // Apply the VariableMark, move cursor after, and unset the mark at the cursor
    editor.chain()
      .focus()
      .setVariable({ variableName })
      .setTextSelection(to) // Move cursor to the end of the original selection
      .unsetMark('variable')   // Explicitly remove the variable mark at the cursor
      .run();

  }, [editor]);

  useEffect(() => {
    if (!editor?.options.element || !isMobile) return

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }

    const el = editor.options.element
    el.addEventListener("contextmenu", handleContextMenu)

    return () => el.removeEventListener("contextmenu", handleContextMenu)
  }, [editor, isMobile])

  const shouldShowToolbar = useCallback(() => {
    if (!editor || !editor.isEditable) return false;
    const { from, to } = editor.state.selection;
    const showForSelection = from !== to;
    return showForSelection;
  }, [editor]);

  if (!editor) return null

  const ToolbarContent = (
    <ToolbarProvider editor={editor}>
        <BoldToolbar />
        <ItalicToolbar />
        <UnderlineToolbar />
        <VariableToolbarButton onClick={handleMarkAsVariable} />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <HeadingsToolbar />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <BulletListToolbar />
        <OrderedListToolbar />
        <BlockquoteToolbar />
        <Separator orientation="vertical" className="h-6 mx-1" /> 
        <SummarizeButton onClick={handleSummarizeClick} disabled={!onSummarize || isSummarizing || isRewriting} />
        <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-1.5" 
                        disabled={!onRewrite || isSummarizing || isRewriting}
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
                 <DropdownMenuItem onSelect={() => handleRewriteClick('expand')} disabled={isSummarizing || isRewriting}>Make Longer</DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onSelect={() => handleRewriteClick('professional')} disabled={isSummarizing || isRewriting}>Professional Tone</DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleRewriteClick('formal')} disabled={isSummarizing || isRewriting}>Formal Tone</DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleRewriteClick('simple')} disabled={isSummarizing || isRewriting}>Simplify Language</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </ToolbarProvider>
  );

  return (
    <TooltipProvider>
      <BubbleMenu
        tippyOptions={{
          duration: 100,
          placement: isMobile ? "bottom" : "top",
          offset: [0, 8],
        }}
        editor={editor}
        shouldShow={shouldShowToolbar}
        className="flex h-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
      >
        {isMobile ? (
          <ScrollArea className="whitespace-nowrap">
            <div className="flex items-center gap-1 p-1">
              {ToolbarContent}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="flex items-center gap-1">
            {ToolbarContent}
          </div>
        )}
      </BubbleMenu>
    </TooltipProvider>
  )
}

export const FloatingToolbar = Extension.create<FloatingToolbarOptions>({
  name: 'floatingToolbar',

  addOptions(): FloatingToolbarOptions {
    return {
      onSummarize: undefined,
      onRewrite: undefined,
      isSummarizing: false,
      isRewriting: false,
      isSuggestionActive: false,
    };
  },

  addProseMirrorPlugins() {
    return [];
  },

  // This function is needed to render the component with React
  onCreate() {
    // The extension is now created and can be used
    console.log('FloatingToolbar extension created with options:', this.options);
  },

  // Add an onUpdate hook to detect option changes
  onUpdate() {
    console.log('FloatingToolbar extension options updated:', this.options);
  }
});

export { FloatingToolbarComponent };
