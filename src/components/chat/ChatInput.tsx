import React, { useState, KeyboardEvent, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BarChart2, Globe, FileText, HelpCircle, Send, Upload as UploadIcon, X, DraftingCompass, Microscope, Clock, Lightbulb, Puzzle, Mic, ChevronsUpDown, Check, SearchCheck } from 'lucide-react';
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
    activeDocumentContextIdAtom,
} from '@/atoms/appAtoms';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import TextareaAutosize from 'react-textarea-autosize';
import { Spinner } from "@/components/ui/Spinner";
import { SourceInfo } from '@/types/sources';
import { ChatAgent } from '@/types/agent';

interface SendMessagePayload {
  content: string;
  documentId: string | null;
  agent: string;
  context?: {
    documentText: string;
    analysisItem: any;
    analysisType: string;
  } | null;
}

interface ChatInputProps {
  onSendMessage: (payload: SendMessagePayload) => void;
  onFileUpload?: (files: File[]) => void;
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
  onFileUpload, 
  disabled = false,
  initialValue,
  isLoading,
}) => {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string>(availableModels.find(m => m.id === 'default-chat')?.id || availableModels[0].id);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState<boolean>(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const documents = useAtomValue(currentCaseDocumentsAtom);
  const [editorTextToQuery, setEditorTextToQuery] = useAtom(editorTextToQueryAtom);
  const [chatPreloadContext, setChatPreloadContext] = useAtom(chatPreloadContextAtom);
  const activeDocumentId = useAtomValue(activeDocumentContextIdAtom);
  const [messageContext, setMessageContext] = useState<MessageContext | null>(null);

  const selectedContextName = useMemo(() => {
    if (activeDocumentId && documents) {
      const doc = documents.find(d => d.id === activeDocumentId);
      return doc ? doc.filename : 'Unknown Document';
    } 
    return null;
  }, [activeDocumentId, documents]);

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
      documentId: activeDocumentId,
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
    }
    if (showCommandPalette && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
       return; 
    }
    if (e.key === 'Escape' && showCommandPalette) {
        setShowCommandPalette(false);
        e.preventDefault();
        e.stopPropagation();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.startsWith('/') && value.length > 0 && !value.includes(' ')) {
        setShowCommandPalette(true);
    } else {
        setShowCommandPalette(false);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(files));
    }
    event.target.value = ''; 
  };
  
  const handleDocumentPickerClick = () => {
      if (!activeCaseId) {
          console.warn("Cannot open document picker without an active case.");
          return;
      }
      setShowContextPicker(true);
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (chatInputContainerRef.current && !chatInputContainerRef.current.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFileUpload) {
      const files = Array.from(e.dataTransfer.files);
      console.log('Files dropped on chat input:', files);
      onFileUpload(files);
      e.dataTransfer.clearData();
    }
  };

  const currentSelectedModel = availableModels.find(m => m.id === selectedModelId) || availableModels.find(m => m.id === 'default-chat') || availableModels[0];
  const webSearchPossible = currentSelectedModel.supportsWebSearch;

  return (
    <div 
      ref={chatInputContainerRef}
      className={cn(
        "relative flex flex-col gap-2 border-t bg-background transition-colors duration-300",
        isDragging ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background rounded-md" : "border-border"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-20 flex items-center justify-center pointer-events-none"
            >
               <div className="text-center text-primary font-medium">
                 <UploadIcon className="h-8 w-8 mx-auto mb-2" />
                 Drop files to upload
               </div>
            </motion.div>
        )}
      </AnimatePresence>
        
        <AnimatePresence>
        {showCommandPalette && (
            <motion.div
                ref={commandPaletteRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full left-0 right-0 mb-2 z-10 max-w-full"
                style={{ width: chatInputContainerRef.current?.offsetWidth }}
            >
                <Command className="rounded-lg border shadow-md bg-popover text-popover-foreground">
                     <CommandInput placeholder="Type a command or search..." value={inputValue.startsWith('/') ? inputValue.substring(1) : inputValue} />
                     <ScrollArea className="h-[250px]">
                         <CommandList>
                             <CommandEmpty>No results found.</CommandEmpty>
                             <CommandGroup heading="Commands">
                                 {commandActions.map((action) => (
                                     <CommandItem
                                         key={action.id}
                                         value={action.value}
                                         onSelect={() => handleCommandSelect(action.value)}
                                         className="flex items-center justify-between"
                                     >
                                         <div className="flex items-center">
                                             {action.icon}
                                             <span>{action.label}</span>
                                         </div>
                                         <span className="text-xs text-muted-foreground">{action.description}</span>
                                     </CommandItem>
                                 ))}
                             </CommandGroup>
                         </CommandList>
                     </ScrollArea>
                </Command>
            </motion.div>
        )}
        </AnimatePresence>
        
        {/* Context Badge Area - Reads directly from atom */} 
        {activeDocumentId && selectedContextName && (
            <div className="px-3 pt-1 pb-1 flex justify-end"> 
                 <Badge variant="secondary" className="flex items-center gap-1 max-w-[250px] pl-1.5 pr-1 py-0.5 text-xs font-normal border border-border/80 shadow-sm">
                    <span className="text-muted-foreground mr-1">Context:</span>
                    <Icons.FileText className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate font-medium">{selectedContextName}</span>
                 </Badge>
             </div>
        )}

        {/* Textarea and Send Button Area */}
        <div className="flex items-end space-x-2 px-3 pt-0 pb-3"> {/* Adjusted padding */}
            <div className="flex-grow relative border rounded-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-200 bg-background">
                <TextareaAutosize
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type here"
                    className="w-full resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm py-2.5 px-3 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 max-h-[200px] min-h-[44px]"
                    disabled={disabled || isLoading}
                    rows={1}
                    maxRows={8}
                    aria-label="Chat message input"
                />
            </div>
            
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        size="icon"
                        className="h-11 w-11 flex-shrink-0"
                        onClick={handleSubmit}
                        disabled={disabled || isLoading || inputValue.trim().length === 0}
                        aria-label="Send message"
                    >
                        {isLoading ? <Spinner size="small" /> : <Send size={18} />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Send Message</p></TooltipContent>
            </Tooltip>
        </div>
        
        <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 text-muted-foreground hover:text-foreground",
                                activeDocumentId && "text-primary hover:text-primary/80"
                            )}
                            onClick={handleDocumentPickerClick}
                            aria-label="Set Document Context"
                            disabled={disabled || !activeCaseId}
                            title={!activeCaseId ? "Select a case first" : activeDocumentId ? `Using context: ${selectedContextName}` : "Select Document Context"}
                        >
                            <Icons.FileText className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{activeDocumentId ? `Change Context (${selectedContextName})` : "Select Document Context"}</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={handleFileButtonClick}
                            aria-label="Upload Files"
                            disabled={disabled || !onFileUpload}
                            title="Upload Files"
                        >
                            <UploadIcon className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Upload Files</p></TooltipContent>
                </Tooltip>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                    disabled={disabled || !onFileUpload}
                />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8 text-muted-foreground", isListening ? 'text-red-500' : 'hover:text-foreground')}
                            onClick={handleVoiceInput}
                            aria-label={isListening ? "Stop listening" : "Start voice input"}
                        >
                            <Mic size={16} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isListening ? "Stop listening" : "Voice input (Placeholder)"}</p></TooltipContent>
                </Tooltip>
            </div>

            <div className="flex items-center gap-2">
                <Popover open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={modelSelectorOpen}
                            className="w-[180px] justify-between text-xs h-8"
                            size="sm"
                        >
                            {currentSelectedModel.name}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                        <Command>
                            <CommandInput placeholder="Search models..." className="h-9" />
                            <CommandList>
                                <CommandEmpty>No model found.</CommandEmpty>
                                <CommandGroup>
                                    {availableModels.map((model) => (
                                        <CommandItem
                                            key={model.id}
                                            value={model.name}
                                            onSelect={() => {
                                                setSelectedModelId(model.id);
                                                setModelSelectorOpen(false);
                                            }}
                                        >
                                            {model.name}
                                            <Check
                                                className={cn(
                                                    "ml-auto h-4 w-4",
                                                    selectedModelId === model.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                {webSearchPossible && (
                    <div className="flex items-center space-x-1">
                        <Switch
                            id="web-search-toggle"
                            checked={isWebSearchEnabled}
                            onCheckedChange={setIsWebSearchEnabled}
                            disabled={!webSearchPossible || isLoading}
                            className="scale-75"
                        />
                        <Label htmlFor="web-search-toggle" className="text-xs text-muted-foreground flex items-center gap-1">
                            <SearchCheck className="h-3.5 w-3.5" /> Web
                        </Label>
                    </div>
                )}
            </div>
        </div>
        
        {showContextPicker && activeCaseId && (
            <DocumentContextPicker
                isOpen={showContextPicker}
                onOpenChange={setShowContextPicker}
                activeCaseId={activeCaseId}
            />
        )}
    </div>
  );
};

export default ChatInput;