import React, { useState, KeyboardEvent, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BarChart2, Globe, FileText, HelpCircle, Send, Upload as UploadIcon, X, DraftingCompass, Microscope, Clock, Lightbulb, Puzzle, ChevronsUpDown, Check, SearchCheck, Paperclip, ListChecks, SendHorizontal, Mic, Loader2, StopCircle, Wand2, PlusSquare } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { Icons } from "@/components/ui/Icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/Badge";
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    activeCaseIdAtom,
    currentCaseDocumentsAtom,
    editorTextToQueryAtom,
    chatPreloadContextAtom,
    chatDocumentContextIdsAtom,
    uploadModalOpenAtom,
    activeEditorItemAtom,
    initialFilesForUploadAtom,
    newAIDocumentDraftModalOpenAtom,
    newAITemplateDraftModalOpenAtom,
    selectTemplateModalOpenAtom,
    templateImportModalOpenAtom,
    deepResearchModeAtom
} from '@/atoms/appAtoms';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/Tooltip";
import { Textarea } from "@/components/ui/Textarea";
import TextareaAutosize from 'react-textarea-autosize';
import { Spinner } from "@/components/ui/Spinner";
import { SourceInfo } from '@/types/sources';
import { ChatAgent } from '@/types/agent';
import DocumentContextDisplay from './DocumentContextDisplay';
import { useChat } from '@/hooks/useChat';

interface SendMessagePayload {
  content: string;
  documentContext: string[];
  agent: string;
  context?: {
    documentText: string;
    analysisItem: any;
    analysisType: string;
  } | null;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  stop?: () => void;
  isDisabled?: boolean;
  placeholder?: string;
  onFileUpload?: (files: File[]) => void;
  selectedDocumentIds: string[];
  maxContextDocuments: number;
  onDocumentPickerOpen?: () => void;
}

interface CommandAction {
    id: string;
    label: string;
    value: string;
    icon: React.ReactElement;
    description: string;
}

const availableModels = [
  { id: 'openai-gpt-4o', name: 'OpenAI GPT-4o', provider: 'OpenAI', supportsWebSearch: true },
  { id: 'perplexity-online', name: 'Perplexity Online', provider: 'Perplexity', supportsWebSearch: true },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', supportsWebSearch: false },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', supportsWebSearch: false },
  { id: 'default-chat', name: 'Default Assistant', provider: 'System', supportsWebSearch: false }
];

const commandActions: CommandAction[] = [
    {
      id: 'agent-live-search',
      label: '/agent perplexity',
      value: '/agent perplexity',
      icon: <Globe className="h-4 w-4 mr-2 text-primary" />,
      description: 'Ask AI Live Search any question.',
    },
    {
      id: 'research',
      label: '/research',
      value: '/research',
      icon: <Search className="h-4 w-4 mr-2 text-primary" />,
      description: 'Legal research using CourtListener.',
    },
    {
        id: 'agent-analyze',
        label: '/agent analyze',
        value: '/agent analyze',
        icon: <Microscope className="h-4 w-4 mr-2 text-primary" />,
        description: 'Analyze a legal document for risks/clauses.',
    },
    {
      id: 'agent-compare',
      label: '/agent compare',
      value: '/agent compare',
      icon: <BarChart2 className="h-4 w-4 mr-2 text-primary" />,
      description: 'Compare two documents.',
    },
    {
      id: 'agent-draft',
      label: '/agent draft',
      value: '/agent draft',
      icon: <DraftingCompass className="h-4 w-4 mr-2 text-primary" />,
      description: 'Draft a legal document or email.',
    },
    {
        id: 'agent-summarize',
        label: '/agent summarize',
        value: '/agent summarize',
        icon: <FileText className="h-4 w-4 mr-2 text-primary" />,
        description: 'Summarize a legal document.',
    },
    {
        id: 'agent-find-clause',
        label: '/agent find-clause',
        value: '/agent find-clause',
        icon: <Puzzle className="h-4 w-4 mr-2 text-primary" />,
        description: 'Find a specific clause in a document.',
    },
    {
        id: 'agent-explain',
        label: '/agent explain',
        value: '/agent explain',
        icon: <Lightbulb className="h-4 w-4 mr-2 text-primary" />,
        description: 'Explain a legal term or concept.',
    },
    {
        id: 'agent-timeline',
        label: '/agent timeline',
        value: '/agent timeline',
        icon: <Clock className="h-4 w-4 mr-2 text-primary" />,
        description: 'Generate a timeline from document events.',
    },
    {
        id: 'agent-template-ai',
        label: '/agent template-ai',
        value: '/agent template-ai',
        icon: <FileText className="h-4 w-4 mr-2 text-primary" />,
        description: 'Generate a template based on a description.',
    },
    {
      id: 'agent-help',
      label: '/agent help',
      value: '/agent help',
      icon: <HelpCircle className="h-4 w-4 mr-2 text-primary" />,
      description: 'Show available agent commands.',
    },
];

interface MessageContext {
  documentText: string;
  analysisItem: any;
  analysisType: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  stop,
  isDisabled = false,
  placeholder = "Ask anything...",
  onFileUpload,
  maxContextDocuments,
  onDocumentPickerOpen,
  selectedDocumentIds: selectedDocumentIdsFromProp
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalInputValue, setInternalInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const [selectedDocumentIds] = useAtom(chatDocumentContextIdsAtom);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAIAgentPopoverOpen, setIsAIAgentPopoverOpen] = useState(false);
  const [showContextBadge, setShowContextBadge] = useState(false);
  const isDeepResearchModeActive = useAtomValue(deepResearchModeAtom);
  const [preloadedContext, setPreloadedContext] = useAtom(chatPreloadContextAtom);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      if (scrollHeight < 200) {
          textareaRef.current.style.height = `${scrollHeight}px`;
      } else {
          textareaRef.current.style.height = `200px`;
      }
    }
  }, [internalInputValue]);

  useEffect(() => {
    setShowContextBadge(selectedDocumentIds.length > 0);
  }, [selectedDocumentIds]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDisabled && !isLoading && internalInputValue.trim()) {
        onSendMessage(internalInputValue.trim());
        setInternalInputValue('');
      }
    }
    if (e.key === '/' && !internalInputValue.endsWith('/')) {
    } else if (e.key === 'Escape' && isPopoverOpen) {
      setIsPopoverOpen(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalInputValue(e.target.value);
    const value = e.target.value;
    if (value.endsWith('/')) {
      setIsPopoverOpen(true);
      setCommandSearch('');
    } else if (isPopoverOpen && !value.includes('/')) {
      setIsPopoverOpen(false);
    } else if (isPopoverOpen && value.includes('/')) {
      const parts = value.split('/');
      setCommandSearch(parts[parts.length - 1]);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleCommandSelect = (command: string) => {
    const currentValue = internalInputValue;
    const lastSlashIndex = currentValue.lastIndexOf('/');
    const newValue = currentValue.substring(0, lastSlashIndex + 1) + command + ' ';
    const syntheticEvent = {
      target: { value: newValue },
      currentTarget: { value: newValue },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    setInternalInputValue(newValue);
    setIsPopoverOpen(false);
    textareaRef.current?.focus();
  };

  const isSending = isLoading;
  const isEffectivelyDisabled = isDisabled || isSending;

  const commands = [
    { command: 'summarize', description: 'Summarize the context or document' },
    { command: 'identify_risks', description: 'Find potential risks' },
    { command: 'extract_entities', description: 'List key people, orgs, dates' },
    { command: 'draft_email', description: 'Draft an email about... (add topic)' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.command.toLowerCase().includes(commandSearch.toLowerCase()) ||
    cmd.description.toLowerCase().includes(commandSearch.toLowerCase())
  );

  const handleUploadClick = () => {
    if (!activeCaseId) return;
    setUploadModalOpen(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeCaseId) return;
    console.log("Drop event detected (implement file handling)");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isDisabled && !isLoading && internalInputValue.trim()) {
      onSendMessage(internalInputValue.trim());
      setInternalInputValue('');
    }
  };

  useEffect(() => {
    if (preloadedContext && internalInputValue === '' && !isLoading) {
      // If input is cleared while preloaded context exists, assume user wants to abandon it.
      // However, ClaudeChatInterface clears it on send. This local clear might be too aggressive.
      // For now, let's rely on ClaudeChatInterface to clear it upon successful message send.
      // If user wants to clear it *before* send, they use the dismiss button.
    }
  }, [internalInputValue, preloadedContext, isLoading]);

  return (
    <TooltipProvider>
      <form
        onSubmit={onFormSubmit}
        className={cn(
          "relative w-full",
          // Glassy, 3D effect - using card styles for the base glass
          "backdrop-blur-md bg-card/70 dark:bg-dark-card/60 border-t border-card-border dark:border-dark-card-border shadow-xl rounded-xl",
          "transition-all duration-200",
          "ring-1 ring-black/5 dark:ring-white/5", // Softer ring
          "before:absolute before:inset-0 before:rounded-xl before:shadow-[0_4px_32px_0_rgba(0,0,0,0.08)] dark:before:shadow-[0_4px_32px_0_rgba(0,0,0,0.2)] before:pointer-events-none"
        )}
      >
        <DocumentContextDisplay
           selectedDocumentIds={selectedDocumentIds}
           onDocumentPickerOpen={onDocumentPickerOpen}
        />
        <div
          className={cn(
            "flex items-end gap-1.5 p-2 rounded-xl border border-transparent",
            // Inner background slightly more transparent or different if needed, using card as a base
            "bg-card/50 dark:bg-dark-card/50",
            isDragOver && "ring-2 ring-primary dark:ring-primary" // Use theme primary for ring
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragOver(false)}
        >
          {/* Left-side action buttons */}
          <div className="flex items-center gap-0.5">
            {/* Document Context Picker Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={showContextBadge ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onDocumentPickerOpen}
                  className={cn(
                    "text-muted-foreground dark:text-dark-muted-foreground hover:text-primary dark:hover:text-primary relative",
                    showContextBadge && "bg-primary/20 border-primary"
                  )}
                  aria-label="Select document context"
                >
                  <FileText className="h-5 w-5" />
                  {showContextBadge && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-primary border-2 border-background dark:border-dark-background" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select documents for context</TooltipContent>
            </Tooltip>
            {/* Upload/Attach Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="icon" onClick={handleUploadClick} className="text-muted-foreground dark:text-dark-muted-foreground hover:text-primary dark:hover:text-primary">
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach files</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach files (max 2MB each)</TooltipContent>
            </Tooltip>
            {/* AI Agent Popover (Magic Icon) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground dark:text-dark-muted-foreground opacity-50 cursor-not-allowed" 
                    title="AI Agent Actions (Coming soon)" 
                    disabled
                    tabIndex={-1}
                  >
                    <Wand2 className="h-5 w-5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </div>
          <TextareaAutosize
            ref={textareaRef}
            value={internalInputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={isDisabled ? "Loading..." : placeholder}
            className="flex-1 resize-none overflow-y-auto bg-transparent p-2.5 text-sm text-foreground dark:text-dark-foreground placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground focus:outline-none disabled:opacity-70 scrollbar-thin scrollbar-thumb-border dark:scrollbar-thumb-dark-border scrollbar-track-transparent"
            disabled={isDisabled || isLoading}
            rows={1}
            maxRows={8}
          />
          <div className="flex items-center gap-0.5">
            {isLoading && stop && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" onClick={stop} className="text-muted-foreground dark:text-dark-muted-foreground hover:text-destructive dark:hover:text-destructive">
                            <StopCircle className="h-5 w-5" />
                            <span className="sr-only">Stop generation</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop generation</TooltipContent>
                </Tooltip>
            )}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button type="submit" variant="ghost" size="icon" disabled={isDisabled || isLoading || !internalInputValue.trim()} className="text-muted-foreground dark:text-dark-muted-foreground enabled:hover:text-primary enabled:dark:hover:text-primary disabled:opacity-50">
                        <SendHorizontal className="h-5 w-5" />
                        <span className="sr-only">Send message</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Send message</TooltipContent>
            </Tooltip>
           </div>
        </div>
      </form>
      {preloadedContext && (
        <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-background dark:bg-dark-background border border-border dark:border-dark-border rounded-md shadow-sm flex items-center justify-between text-xs">
          <div className="flex items-center overflow-hidden">
            <span className="font-semibold mr-1.5 shrink-0">Context:</span>
            <span className="text-muted-foreground dark:text-dark-muted-foreground mr-1 shrink-0">
              {preloadedContext.analysisType} -
            </span>
            <span className="italic truncate text-foreground dark:text-dark-foreground">
              "{preloadedContext.analysisItem.substring(0, 100)}{preloadedContext.analysisItem.length > 100 ? '...' : ''}"
            </span>
          </div>
          <Button 
            variant="ghost"
            size="xs-icon" 
            className="h-5 w-5 p-0.5 text-muted-foreground dark:text-dark-muted-foreground hover:text-destructive dark:hover:text-dark-destructive shrink-0 ml-2"
            onClick={() => setPreloadedContext(null)}
            title="Clear context snippet"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </TooltipProvider>
  );
};

export default ChatInput;