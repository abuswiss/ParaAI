import React, { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BarChart2, Globe, FileText, HelpCircle, Send, Upload as UploadIcon, X, DraftingCompass, Microscope, Clock, Lightbulb, Puzzle, Mic } from 'lucide-react';
import { Textarea } from "@/components/ui/Textarea";
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
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import DocumentContextPicker from './DocumentContextPicker';
import { Badge } from "@/components/ui/Badge";
import { useAtomValue, useSetAtom } from 'jotai';
import {
    activeCaseIdAtom,
    currentCaseDocumentsAtom,
    editorTextToQueryAtom,
} from '@/atoms/appAtoms';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

interface ChatInputProps {
  onSendMessage: (message: string, agentOverride?: string | null) => void;
  onFileUpload?: (files: File[]) => void;
  disabled?: boolean;
  initialValue?: string;
  currentContextId: string | null;
  onContextChange: (contextId: string | null) => void;
  isLoading: boolean;
}

interface CommandAction {
    id: string;
    label: string;
    value: string;
    icon: React.ReactElement;
    description: string;
}

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

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onFileUpload, 
  disabled = false, 
  initialValue,
  currentContextId,
  onContextChange,
  isLoading,
}) => {
  const [message, setMessage] = useState(initialValue || '');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [selectedContextName, setSelectedContextName] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const documents = useAtomValue(currentCaseDocumentsAtom);
  const setEditorTextToQuery = useSetAtom(editorTextToQueryAtom);

  useEffect(() => {
    if (initialValue) {
      setMessage(initialValue);
      textareaRef.current?.focus();
      setTimeout(() => {
         if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = initialValue.length;
            handleAutoResize();
         }
      }, 0);
    }
  }, [initialValue]);

  useEffect(() => {
    if (currentContextId && documents) {
      const doc = documents.find(d => d.id === currentContextId);
      setSelectedContextName(doc ? doc.filename : 'Unknown Document');
    } else {
      setSelectedContextName(null);
    }
  }, [currentContextId, documents]);

  const handleAutoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    handleAutoResize();
  }, [message, handleAutoResize]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowCommandPalette(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [commandPaletteRef]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    let agentOverride: string | null = null;
    if (trimmedMessage.toLowerCase().startsWith('/agent draft')) {
      agentOverride = 'agent-draft';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent perplexity')) {
      agentOverride = 'perplexity-agent';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent analyze')) {
        agentOverride = 'analyze-document';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent compare')) {
        agentOverride = 'compare-documents';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent find-clause')) {
        agentOverride = 'find-clause';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent explain')) {
        agentOverride = 'explain-term';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent timeline')) {
        agentOverride = 'generate-timeline';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent case-search')) {
        agentOverride = 'case-search';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent template-ai')) {
        agentOverride = 'create-template-from-ai';
    } else if (trimmedMessage.toLowerCase().startsWith('/agent summarize')) {
        agentOverride = 'summarize-text';
    } else if (trimmedMessage.toLowerCase().startsWith('/research')) {
        agentOverride = 'courtlistener-rag';
    }

    onSendMessage(trimmedMessage, agentOverride);
    setMessage('');
    setShowCommandPalette(false);
    
    setTimeout(handleAutoResize, 0); 
    setEditorTextToQuery(null);
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
    setMessage(value);

    if (value.startsWith('/') || value.endsWith(' /')) {
      setShowCommandPalette(true);
    } else {
      setShowCommandPalette(false);
    }
    handleAutoResize();
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

  const handleSelectContext = (contextId: string | null) => {
      onContextChange(contextId);
      setShowContextPicker(false);
  };

  const handleClearContext = () => {
      onContextChange(null);
  };

  const handleCommandSelect = (selectedValue: string) => {
      setMessage(selectedValue + ' ');
      setShowCommandPalette(false);
      textareaRef.current?.focus();
  };

  const handleVoiceInput = () => {
    setIsListening(!isListening);
    if (!isListening) {
      console.log("Starting voice input (Not Implemented)");
      setTimeout(() => {
          setMessage(prev => prev + " (voice input text - placeholder)");
          setIsListening(false); 
          console.log("Stopping voice input (Mock)");
      }, 3000);
    } else {
      console.log("Stopping voice input (Not Implemented)");
    }
  };

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

  return (
    <div 
      ref={chatInputContainerRef}
      className={cn(
        "relative flex flex-col gap-2 border-t p-4 bg-background transition-colors duration-300",
        isDragging ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
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
                     <CommandInput placeholder="Type a command or search..." value={message.startsWith('/') ? message.substring(1) : message} />
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
        
        <div className={cn(
            "relative flex items-end space-x-2 p-2 border rounded-md",
            "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-200",
             disabled ? "bg-muted/50 cursor-not-allowed" : "bg-background"
         )}>
             <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                    "flex-shrink-0 text-muted-foreground hover:text-foreground",
                    currentContextId && "text-primary hover:text-primary/80"
                )}
                onClick={handleDocumentPickerClick}
                aria-label="Attach Document Context"
                disabled={disabled || !activeCaseId}
                title={!activeCaseId ? "Select a case first" : currentContextId ? `Using context: ${selectedContextName}` : "Select Document Context"}
             >
                 <Icons.FileText className="h-5 w-5" />
             </Button>

             <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleFileButtonClick}
                aria-label="Upload Files"
                disabled={disabled || !onFileUpload}
             >
                 <UploadIcon className="h-5 w-5" />
             </Button>
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                className="hidden"
                disabled={disabled || !onFileUpload}
             />
             
             <Textarea
                 ref={textareaRef}
                 value={message}
                 onChange={handleInputChange}
                 onKeyDown={handleKeyDown}
                 placeholder="Type your message or / for commands..."
                 className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm py-2 px-1 min-h-[24px] max-h-[200px] overflow-y-auto"
                 rows={1}
                 disabled={disabled}
                 aria-label="Chat message input"
             />
             
             <div className="flex items-center gap-1">
                 <Tooltip>
                     <TooltipTrigger asChild>
                         <Button 
                             variant="ghost" 
                             size="icon" 
                             className={`h-9 w-9 ${isListening ? 'text-red-500' : 'text-muted-foreground'}`} 
                             onClick={handleVoiceInput}
                             aria-label={isListening ? "Stop listening" : "Start voice input"}
                         >
                             <Mic size={18} />
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                         <p>{isListening ? "Stop listening" : "Voice input (Placeholder)"}</p>
                     </TooltipContent>
                 </Tooltip>
                 <Tooltip>
                     <TooltipTrigger asChild>
                         <Button 
                             size="icon" 
                             className="h-9 w-9" 
                             onClick={handleSubmit} 
                             disabled={isLoading || !message.trim()}
                             aria-label="Send message"
                         >
                             <Send size={18} />
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                         <p>Send Message</p>
                     </TooltipContent>
                 </Tooltip>
             </div>
        </div>
        
        {currentContextId && selectedContextName && (
            <div className="absolute bottom-1 left-4 right-4 flex justify-start">
                 <Badge variant="secondary" className="flex items-center gap-1.5 max-w-full pl-2 pr-1 py-0.5">
                     <Icons.FileText className="h-3 w-3 flex-shrink-0" /> 
                     <span className="text-xs truncate font-normal">Context: {selectedContextName}</span>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                        onClick={handleClearContext}
                        aria-label="Clear document context"
                    >
                        <X className="h-3 w-3" />
                     </Button>
                 </Badge>
             </div>
        )}

        {showContextPicker && activeCaseId && (
            <DocumentContextPicker
                isOpen={showContextPicker}
                onOpenChange={setShowContextPicker}
                activeCaseId={activeCaseId}
                currentContextId={currentContextId}
                onSelectContext={handleSelectContext}
            />
        )}
    </div>
  );
};

export default ChatInput;