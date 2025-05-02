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
import { AlertCircle, Check, ChevronDown } from "lucide-react"
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
import { PilcrowSquare } from 'lucide-react'

import { useInlineSuggestions } from "@/context/InlineSuggestionContext"

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
}

type RewriteMode = 'improve' | 'shorten' | 'expand' | 'professional' | 'formal' | 'simple';

const FloatingToolbarComponent: React.FC<{ editor: Editor, options: FloatingToolbarOptions }> = ({ 
    editor, 
    options 
}) => {
  const { onSummarize, onRewrite, isSummarizing, isRewriting } = options;
  const { triggerSuggestion, suggestionState } = useInlineSuggestions();
  const isMobile = useMediaQuery("(max-width: 640px)")

  const handleSummarizeClick = useCallback(() => {
      if (editor && onSummarize) {
          onSummarize(editor);
      }
  }, [editor, onSummarize]);

  const handleRewriteClick = useCallback((mode: RewriteMode) => {
      if (editor && onRewrite) {
          onRewrite(editor, mode);
      }
  }, [editor, onRewrite]);

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
    return showForSelection && !suggestionState.isActive;
  }, [editor, suggestionState.isActive]);

  if (!editor) return null

  const ToolbarContent = (
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
                 <DropdownMenuItem onSelect={() => handleRewriteClick('expand')} disabled={isSummarizing || isRewriting}>Expand</DropdownMenuItem>
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
    };
  },

  addProseMirrorPlugins() {
    return [];
  },

  // This function is needed to render the component with React
  onCreate() {
    // The extension is now created and can be used
    console.log('FloatingToolbar extension created');
  }
});

export { FloatingToolbarComponent };
