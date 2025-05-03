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
    templateImportModalOpenAtom
} from '@/atoms/appAtoms';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/Tooltip";
import { Textarea } from "@/components/ui/Textarea";
import TextareaAutosize from 'react-textarea-autosize';
import { Spinner } from "@/components/ui/Spinner";
import { SourceInfo } from '@/types/sources';
import { ChatAgent } from '@/types/agent';
import DocumentContextPicker from './DocumentContextPicker';
import DocumentContextDisplay from './DocumentContextDisplay';
import { useChat } from '@/hooks/useChat';
import { Dialog, DialogContent } from "@/components/ui/Dialog";

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
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>, chatRequestOptions?: { data?: Record<string, string> }) => void;
  isLoading: boolean;
  stop?: () => void;
  isDisabled?: boolean;
  placeholder?: string;
  onFileUpload?: (files: File[]) => void;
  selectedDocumentIds: string[];
  handleDocumentSelection: (docIds: string[]) => void;
  maxContextDocuments: number;
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
      icon: <Globe className="h-4 w-4 mr-2 text-cyan-400" />,
      description: 'Ask AI Live Search any question.',
    },
    {
      id: 'research',
      label: '/research',
      value: '/research',
      icon: <Search className="h-4 w-4 mr-2 text-blue-500" />,
      description: 'Legal research using CourtListener.',
    },
    {
        id: 'agent-analyze',
        label: '/agent analyze',
        value: '/agent analyze',
        icon: <Microscope className="h-4 w-4 mr-2 text-purple-400" />,
        description: 'Analyze a legal document for risks/clauses.',
    },
    {
      id: 'agent-compare',
      label: '/agent compare',
      value: '/agent compare',
      icon: <BarChart2 className="h-4 w-4 mr-2 text-pink-400" />,
      description: 'Compare two documents.',
    },
    {
      id: 'agent-draft',
      label: '/agent draft',
      value: '/agent draft',
      icon: <DraftingCompass className="h-4 w-4 mr-2 text-orange-500" />,
      description: 'Draft a legal document or email.',
    },
    {
        id: 'agent-summarize',
        label: '/agent summarize',
        value: '/agent summarize',
        icon: <FileText className="h-4 w-4 mr-2 text-lime-500" />,
        description: 'Summarize a legal document.',
    },
    {
        id: 'agent-find-clause',
        label: '/agent find-clause',
        value: '/agent find-clause',
        icon: <Puzzle className="h-4 w-4 mr-2 text-indigo-400" />,
        description: 'Find a specific clause in a document.',
    },
    {
        id: 'agent-explain',
        label: '/agent explain',
        value: '/agent explain',
        icon: <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />,
        description: 'Explain a legal term or concept.',
    },
    {
        id: 'agent-timeline',
        label: '/agent timeline',
        value: '/agent timeline',
        icon: <Clock className="h-4 w-4 mr-2 text-teal-400" />,
        description: 'Generate a timeline from document events.',
    },
    {
        id: 'agent-template-ai',
        label: '/agent template-ai',
        value: '/agent template-ai',
        icon: <FileText className="h-4 w-4 mr-2 text-rose-400" />,
        description: 'Generate a template based on a description.',
    },
    {
      id: 'agent-help',
      label: '/agent help',
      value: '/agent help',
      icon: <HelpCircle className="h-4 w-4 mr-2 text-green-500" />,
      description: 'Show available agent commands.',
    },
];

interface MessageContext {
  documentText: string;
  analysisItem: any;
  analysisType: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  isDisabled = false,
  placeholder = "Ask anything...",
  onFileUpload,
  handleDocumentSelection,
  maxContextDocuments
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const setUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const selectedDocumentIds = useAtomValue(chatDocumentContextIdsAtom);

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
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDisabled && !isLoading && input.trim()) {
        handleSubmit(e as any, { data: { caseId: activeCaseId || '' } });
      }
    }
    if (e.key === '/' && !input.endsWith('/')) {
    } else if (e.key === 'Escape' && isPopoverOpen) {
      setIsPopoverOpen(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
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
    const currentValue = input;
    const lastSlashIndex = currentValue.lastIndexOf('/');
    const newValue = currentValue.substring(0, lastSlashIndex + 1) + command + ' ';
    const syntheticEvent = {
      target: { value: newValue },
      currentTarget: { value: newValue },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(syntheticEvent);
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

  const handlePickerClose = () => {
    setIsDocPickerOpen(false);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-2 p-4 w-full">
        <div className="relative flex items-end w-full border rounded-md bg-background focus-within:ring-1 focus-within:ring-ring">
          <TextareaAutosize
            ref={textareaRef}
            minRows={1}
            maxRows={8}
            placeholder={isEffectivelyDisabled ? (isDisabled ? placeholder : "AI is responding...") : placeholder}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={isEffectivelyDisabled}
            className={cn(
              "flex-grow resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent py-2 pl-3 pr-10",
              "w-full"
            )}
          />

          <div className="absolute right-1 bottom-1 flex items-center">
            {isLoading ? (
              <Button type="button" variant="ghost" size="icon" onClick={stop} className="h-8 w-8">
                <StopCircle className="h-4 w-4 animate-pulse" />
                <span className="sr-only">Stop generating</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isEffectivelyDisabled || !input.trim()}
                className="h-8 w-8"
                onClick={(e) => {
                  handleSubmit(e as any, { data: { caseId: activeCaseId || '' } });
                }}
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-between" onDrop={handleDrop} onDragOver={handleDragOver}>
          <div className="flex-grow min-w-0">
            {selectedDocumentIds.length > 0 && (
              <DocumentContextDisplay selectedDocumentIds={selectedDocumentIds} />
            )}
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground relative"
                  disabled={isDisabled || !activeCaseId}
                  onClick={() => setIsDocPickerOpen(true)}
                >
                  <Paperclip className="h-5 w-5" />
                  {selectedDocumentIds.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs rounded-full"
                    >
                      {selectedDocumentIds.length}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Select Context Documents{selectedDocumentIds.length > 0 ? ` (${selectedDocumentIds.length})` : ''}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleUploadClick}
                  disabled={isDisabled || !activeCaseId}
                >
                  <PlusSquare className="h-4 w-4 mr-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload Documents (or drag & drop anywhere)</p>
              </TooltipContent>
            </Tooltip>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                multiple
                style={{ display: 'none' }}
                accept=".pdf,.docx,.txt,.md"
            />
          </div>
        </div>
      </div>

      <Dialog open={isDocPickerOpen} onOpenChange={setIsDocPickerOpen}>
        <DialogContent className="sm:max-w-[600px] p-0">
          {isDocPickerOpen && activeCaseId && (
            <DocumentContextPicker 
              onClose={handlePickerClose}
            />
          )}
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
};

export default ChatInput;