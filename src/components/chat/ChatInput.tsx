import React, { useState, KeyboardEvent, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BarChart2, Globe, FileText, HelpCircle, Send, Upload as UploadIcon, X, DraftingCompass, Microscope, Clock, Lightbulb, Puzzle, ChevronsUpDown, Check, SearchCheck, Paperclip, ListChecks } from 'lucide-react';
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
} from '@/atoms/appAtoms';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import TextareaAutosize from 'react-textarea-autosize';
import { Spinner } from "@/components/ui/Spinner";
import { SourceInfo } from '@/types/sources';
import { ChatAgent } from '@/types/agent';
import DocumentContextPicker from './DocumentContextPicker';

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
  onSendMessage: (payload: SendMessagePayload) => void;
  disabled?: boolean;
  initialValue?: string;
  isLoading: boolean;
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
        icon: <Icons.FileText className="h-4 w-4 mr-2 text-lime-500" />,
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
  onSendMessage, 
  disabled = false,
  initialValue,
  isLoading,
}) => {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string>(availableModels.find(m => m.id === 'default-chat')?.id || availableModels[0].id);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState<boolean>(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const documents = useAtomValue(currentCaseDocumentsAtom);
  const [editorTextToQuery, setEditorTextToQuery] = useAtom(editorTextToQueryAtom);
  const [chatPreloadContext, setChatPreloadContext] = useAtom(chatPreloadContextAtom);
  const selectedContextIds = useAtomValue(chatDocumentContextIdsAtom);
  const setIsUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const activeEditorItem = useAtomValue(activeEditorItemAtom);

  const [messageContext, setMessageContext] = useState<MessageContext | null>(null);

  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setInputValue(initialValue);
      textareaRef.current?.focus();
      setTimeout(() => {
         if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = initialValue.length;
         }
      }, 0);
    }
  }, [initialValue]);

  useEffect(() => {
    if (chatPreloadContext) {
      const { analysisItem, analysisType, documentText } = chatPreloadContext;

      let itemIdentifier = 'this item';
      if (typeof analysisItem === 'string') {
        itemIdentifier = 'this summary';
      } else if (analysisItem.text) {
        itemIdentifier = `"${analysisItem.text}"`;
      } else if (analysisItem.title) {
        itemIdentifier = `the "${analysisItem.title}" clause/risk`;
      } else if (analysisItem.event && analysisItem.date) {
        itemIdentifier = `the event on ${new Date(analysisItem.date).toLocaleDateString()}`;
      } else if (analysisItem.summary) {
        itemIdentifier = 'this summary/analysis';
      }
      
      const promptHint = `Regarding ${itemIdentifier} from the document: `;

      setInputValue(promptHint);
      setMessageContext({ documentText, analysisItem, analysisType });
      setChatPreloadContext(null);

      textareaRef.current?.focus();
    }
  }, [chatPreloadContext, setChatPreloadContext]);

  useEffect(() => {
    if (editorTextToQuery) {
      const queryPrefix = `Regarding the selected text "${editorTextToQuery.substring(0, 50)}...": `;
      setInputValue(prev => queryPrefix + prev);
      setMessageContext(null);
      setEditorTextToQuery(null);
      textareaRef.current?.focus();
    }
  }, [editorTextToQuery, setEditorTextToQuery]);

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || disabled || isLoading) return;

    const payload: SendMessagePayload = {
      content: trimmedValue,
      documentContext: selectedContextIds,
      agent: selectedModelId,
      context: messageContext || null
    };

    console.log('ChatInput handleSubmit payload:', payload);
    onSendMessage(payload);
    setInputValue('');
    setMessageContext(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showCommandPalette) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === '/' && inputValue === '') {
      setShowCommandPalette(true);
    } else if (e.key === 'Escape') {
      if (showCommandPalette) setShowCommandPalette(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value.startsWith('/') && value.length > 0) {
        setShowCommandPalette(true);
    } else {
        setShowCommandPalette(false);
    }
  };

  const handleFileButtonClick = () => {
    if (!activeCaseId) {
       console.warn("Upload requires an active case.");
       alert("Please select or create a case before uploading documents.");
       return;
    }
    setIsUploadModalOpen(true);
  };

  const handleContextPickerOpen = () => {
      if (!activeCaseId) {
          console.warn("Context selection requires an active case.");
          alert("Please select or create a case first.");
          return;
      }
      setIsContextPickerOpen(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      if (chatInputContainerRef.current && !chatInputContainerRef.current.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    }, 50);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!activeCaseId) {
       console.warn("Upload via drop requires an active case.");
       alert("Please select or create a case before uploading documents.");
       return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        console.log('Files dropped:', files.map(f => f.name));
        setIsUploadModalOpen(true);
    } 
  };

  const handleCommandSelect = (command: CommandAction) => {
    setInputValue(command.value + ' ');
    setShowCommandPalette(false);
    textareaRef.current?.focus();
  };
  
  const closeCommandPalette = () => {
    setShowCommandPalette(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(event.target as Node)) {
        closeCommandPalette();
      }
    };
    if (showCommandPalette) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCommandPalette]);

  const selectedModel = useMemo(() => availableModels.find(m => m.id === selectedModelId), [selectedModelId]);

  useEffect(() => {
    if (selectedModel && !selectedModel.supportsWebSearch) {
      setIsWebSearchEnabled(false);
    }
  }, [selectedModel]);

  return (
    <div 
      ref={chatInputContainerRef}
      className={cn(
        "relative w-full bg-background border-t",
        isDragging && "outline-dashed outline-2 outline-offset-4 outline-primary"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
       {isDragging && (
          <div className="absolute inset-0 bg-primary/10 flex flex-col items-center justify-center pointer-events-none z-10">
              <UploadIcon className="h-16 w-16 text-primary opacity-80 mb-4" />
              <p className="text-lg font-semibold text-primary">Drop files here to upload</p>
          </div>
       )}
       {showCommandPalette && (
          <motion.div
              ref={commandPaletteRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full left-0 right-0 mb-2 z-20 mx-4 shadow-lg rounded-lg border bg-popover"
          >
              <Command className="rounded-lg">
                  <CommandInput placeholder="Type a command or search..." />
                  <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup heading="Agent Commands">
                          {commandActions.map((command) => (
                              <CommandItem
                                  key={command.id}
                                  value={command.value}
                                  onSelect={() => handleCommandSelect(command)}
                                  className="flex items-center cursor-pointer"
                              >
                                  {command.icon}
                                  <span className="flex-grow ml-1">{command.label}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">{command.description}</span>
                              </CommandItem>
                          ))}
                      </CommandGroup>
                  </CommandList>
              </Command>
          </motion.div>
       )}

      <div className="flex items-end p-3 space-x-2">
        <div className="flex-grow relative">
          <TextareaAutosize
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Assistant is thinking..." : "Type message or / for commands..."}
            className="w-full resize-none border rounded-md py-2 pr-10 pl-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-h-[40px] max-h-[200px] scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent"
            disabled={disabled || isLoading}
            rows={1}
          />
          {isLoading && (
             <div className="absolute right-3 top-1/2 -translate-y-1/2">
                 <Spinner size="sm" />
             </div>
          )}
        </div>

        <Button 
            variant="default"
            size="icon" 
            className="flex-shrink-0"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || disabled || isLoading}
            aria-label="Send message"
        >
            <Send className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center space-x-1 px-3 pb-2 pt-1 border-t">
          <Tooltip>
              <TooltipTrigger asChild>
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className="flex-shrink-0 text-muted-foreground hover:text-primary h-8 w-8"
                      onClick={handleFileButtonClick}
                      disabled={isLoading || disabled}
                   >
                      <Paperclip className="h-4 w-4" />
                   </Button>
              </TooltipTrigger>
              <TooltipContent>
                  <p>Upload Document</p>
              </TooltipContent>
          </Tooltip>
  
          <Tooltip>
              <TooltipTrigger asChild>
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                          "flex-shrink-0 text-muted-foreground hover:text-primary h-8 w-8",
                          selectedContextIds.length > 0 && "text-primary ring-1 ring-primary/50"
                      )}
                      onClick={handleContextPickerOpen}
                      disabled={isLoading || disabled || !activeCaseId}
                   >
                      <ListChecks className="h-4 w-4" />
                      {selectedContextIds.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                              {selectedContextIds.length}
                          </span>
                      )}
                   </Button>
              </TooltipTrigger>
              <TooltipContent>
                  {selectedContextIds.length > 0 
                      ? <p>Edit Context ({selectedContextIds.length} selected)</p> 
                      : <p>Select Document Context</p>}
                  {!activeCaseId && <p className='text-destructive'>(Select a case first)</p>}
              </TooltipContent>
          </Tooltip>

          <div className="flex-grow"></div>

          {selectedModel?.supportsWebSearch && (
              <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1.5 mr-2">
                      <Switch
                        id="web-search-switch-footer"
                        checked={isWebSearchEnabled}
                        onCheckedChange={setIsWebSearchEnabled}
                        disabled={!selectedModel?.supportsWebSearch}
                        className="scale-75"
                      />
                      <Label htmlFor="web-search-switch-footer" className="text-xs text-muted-foreground cursor-pointer">
                        Web Search
                      </Label>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>Enable web search for up-to-date info.</p>
                </TooltipContent>
              </Tooltip>
          )}
      </div>

      <DocumentContextPicker 
         isOpen={isContextPickerOpen}
         onOpenChange={setIsContextPickerOpen}
      />

    </div>
  );
};

export default ChatInput;