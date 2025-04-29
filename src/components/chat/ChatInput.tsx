import React, { useState, KeyboardEvent, useRef, useEffect, DragEvent } from 'react';
import { useAtom } from 'jotai';
import { editorTextToQueryAtom } from '@/atoms/appAtoms';
import { Document } from '../../types/document';
import { getUserDocuments } from '../../services/documentService';
import { DocumentAnalysisResult, getDocumentAnalyses } from '../../services/documentAnalysisService';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, BarChart2, Globe, FileText, HelpCircle, Send } from 'lucide-react';
import { parseCommand, Task } from '../../lib/commandParser';

interface ChatInputProps {
  onSendMessage: (message: string, documentContexts?: string[], analysisContext?: DocumentAnalysisResult) => void;
  onFileUpload?: (files: File[]) => void;
  disabled?: boolean;
  isNewChat?: boolean;
  messagesCount?: number;
  initialValue?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onFileUpload, 
  disabled = false, 
  isNewChat = false,
  messagesCount = 0,
  initialValue
}) => {
  const [message, setMessage] = useState(initialValue || '');

  const [activeDocuments, setActiveDocuments] = useState<Document[]>([]);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [availableAnalyses, setAvailableAnalyses] = useState<DocumentAnalysisResult[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const documentPickerRef = useRef<HTMLDivElement>(null);
  const analysisPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandDropdownRef = useRef<HTMLDivElement>(null);

  const [textToQuery, setTextToQuery] = useAtom(editorTextToQueryAtom);

  const commandActions = [
    {
      id: 'agent-live-search',
      label: '/agent perplexity [query]',
      icon: <Globe className="h-4 w-4 text-cyan-400" />,
      description: 'Ask AI Live Search any question for powerful, up-to-date answers with sources.',
      example: '/agent perplexity What are the latest SEC regulations on crypto?',
      highlight: true,
    },
    {
      id: 'research',
      label: '/research [query]',
      icon: <Search className="h-4 w-4 text-blue-500" />,
      description: 'Legal research using CourtListener',
      example: '/research Miranda rights',
    },
    {
      id: 'agent-compare',
      label: '/agent compare [docA_id] [docB_id]',
      icon: <BarChart2 className="h-4 w-4 text-pink-400" />,
      description: 'Compare two documents by ID and highlight differences, additions, and deletions.',
      example: '/agent compare 1234abcd 5678efgh',
    },
    {
      id: 'agent-draft',
      label: '/agent draft [instructions]',
      icon: <FileText className="h-4 w-4 text-orange-500" />,
      description: 'Draft a legal document or email',
      example: '/agent draft draft a cease and desist letter',
    },
    {
      id: 'agent-generate-timeline',
      label: '/agent generate_timeline from [doc_id]',
      icon: <BarChart2 className="h-4 w-4 text-purple-500" />,
      description: 'Generate a timeline of key dates and events from a document',
      example: '/agent generate_timeline from 1234abcd',
    },
    {
      id: 'agent-explain-term',
      label: '/agent explain_term "[legal term or acronym]"',
      icon: <Globe className="h-4 w-4 text-yellow-500" />,
      description: 'Explain a legal term or acronym',
      example: '/agent explain_term "estoppel"',
    },
    {
      id: 'agent-find-clause',
      label: '/agent find_clause "[clause description]" in [doc_id]',
      icon: <FileText className="h-4 w-4 text-pink-500" />,
      description: 'Find a clause in a document',
      example: '/agent find_clause "termination clause" in 1234abcd',
    },
    {
      id: 'agent-help',
      label: '/agent help',
      icon: <HelpCircle className="h-4 w-4 text-green-500" />,
      description: 'Show available agent commands',
      example: '/agent help',
    },
    {
      id: 'agent-flag-privileged-terms',
      label: '/agent flag_privileged_terms in [doc_id]',
      icon: <FileText className="h-4 w-4 text-red-400" />,
      description: 'Scan a document for keywords/phrases associated with attorney-client privilege or work product.',
      example: '/agent flag_privileged_terms in 1234abcd',
    },
    {
      id: 'agent-risk-analysis',
      label: '/agent risk_analysis in [doc_id]',
      icon: <BarChart2 className="h-4 w-4 text-red-500" />,
      description: 'Analyze a document for legal risks and categorize them as High, Medium, or Low.',
      example: '/agent risk_analysis in 1234abcd',
    },
    {
      id: 'agent-key-clauses',
      label: '/agent key_clauses in [doc_id]',
      icon: <FileText className="h-4 w-4 text-blue-400" />,
      description: 'Extracts and analyzes key clauses from a legal document, highlighting important text and providing analysis.',
      example: '/agent key_clauses in 1234abcd',
    },
    {
      id: 'agent-summarize',
      label: '/agent summarize in [doc_id]',
      icon: <FileText className="h-4 w-4 text-green-400" />,
      description: 'Summarizes a legal document thoroughly from a legal perspective in a well-structured, easy-to-read format.',
      example: '/agent summarize in 1234abcd',
    },
  ];

  const [showCommandHint, setShowCommandHint] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(commandActions);

  const getRequiredDocsForAgent = (task: Task | null): number => {
    if (!task || task.type !== 'agent') return 0;
    if (task.agent === 'compare') return 2;
    if (['find_clause', 'flag_privileged_terms', 'generate_timeline', 'risk_analysis', 'key_clauses', 'summarize'].includes(task.agent)) return 1;
    return 0;
  };

  const isDocumentAgent = (task: Task | null): boolean => {
    return getRequiredDocsForAgent(task) > 0;
  };

  useEffect(() => {
    if (textToQuery) {
      console.log("Received text to query:", textToQuery);
      const preparedMessage = `Regarding this text: "${textToQuery}"\n\nPlease explain or analyze the following:`;
      setMessage(preparedMessage);
      setTextToQuery(null);

      textareaRef.current?.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = preparedMessage.length;
        }
      }, 0);
    }
  }, [textToQuery, setTextToQuery]);

  useEffect(() => {
    if (initialValue) {
      setMessage(initialValue);
      textareaRef.current?.focus();
      setTimeout(() => {
         if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = initialValue.length;
         }
      }, 0);
    }
  }, [initialValue]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    const task = parseCommand(trimmedMessage);
    const requiredDocs = getRequiredDocsForAgent(task);

    if (task?.type === 'agent') {
        if (task.agent === 'compare') {
            if (activeDocuments.length < 2) {
                console.warn('Compare agent requires 2 documents.');
                setShowDocumentPicker(true);
                return;
            }
        } else if (requiredDocs > 0 && activeDocuments.length < requiredDocs) {
            console.warn(`Agent ${task.agent} requires ${requiredDocs} document(s).`);
            setShowDocumentPicker(true);
            return;
        }
    }

    let finalMessage = trimmedMessage;
    if (task?.type === 'agent') {
      if (task.agent === 'compare' && activeDocuments.length >= 2) {
        finalMessage = `/agent compare ${activeDocuments[0].id} ${activeDocuments[1].id}`;
      } else if (task.agent === 'find_clause' && activeDocuments.length >= 1) {
        const clause = (task as { clause?: string }).clause || '';
        if (/from\s+/.test(message)) {
          finalMessage = `/agent find_clause "${clause}" from ${activeDocuments[0].id}`;
        } else {
          finalMessage = `/agent find_clause "${clause}" in ${activeDocuments[0].id}`;
        }
      } else if ((
          task.agent === 'flag_privileged_terms' ||
          task.agent === 'generate_timeline' ||
          task.agent === 'risk_analysis' ||
          task.agent === 'key_clauses' ||
          task.agent === 'summarize'
         ) && activeDocuments.length >= 1) {
        if (/from\s+/.test(message)) {
          finalMessage = `/agent ${task.agent} from ${activeDocuments[0].id}`;
        } else {
          finalMessage = `/agent ${task.agent} in ${activeDocuments[0].id}`;
        }
      }
    }

    onSendMessage(
      finalMessage,
      activeDocuments.map(doc => doc.id),
      selectedAnalysis || undefined
    );
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandHint && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        const listRef = commandDropdownRef.current;
        if (!listRef) return;

        let currentSelectedIndex = filteredCommands.findIndex(cmd => cmd.label === message);
        if (currentSelectedIndex === -1) currentSelectedIndex = 0;

        if (e.key === 'ArrowUp') {
            const prevIndex = (currentSelectedIndex + filteredCommands.length - 1) % filteredCommands.length;
            setMessage(filteredCommands[prevIndex].label);
        } else if (e.key === 'ArrowDown') {
            const nextIndex = (currentSelectedIndex + 1) % filteredCommands.length;
            setMessage(filteredCommands[nextIndex].label);
        } else if (e.key === 'Enter') {
            setMessage(filteredCommands[currentSelectedIndex].label);
            setShowCommandHint(false);
            handleSubmit();
        } else if (e.key === 'Escape') {
            setShowCommandHint(false);
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };
  
  const handleFiles = (files: File[]) => {
    if (files.length > 3) {
      console.warn('You can upload up to 3 documents at once. Only the first 3 will be uploaded.');
      files = files.slice(0, 3);
    }
    if (activeDocuments.length >= 3) {
      console.warn('You already have 3 documents selected. Remove one to upload another.');
      return;
    }
    if (activeDocuments.length + files.length > 3) {
      console.warn('You can have up to 3 documents at once. Only the first files to reach the limit will be uploaded.');
      files = files.slice(0, 3 - activeDocuments.length);
    }
    if (files.length === 0) return;
    setActiveDocuments([]);
    setSelectedAnalysis(null);
    setAvailableAnalyses([]);
    if (onFileUpload) {
      onFileUpload(files);
    }
  };
  
  const toggleDocumentPicker = () => {
    if (!showDocumentPicker) {
      fetchUserDocuments();
    }
    setShowDocumentPicker(!showDocumentPicker);
    if (showAnalysisPicker) setShowAnalysisPicker(false);
  };
  
  const fetchUserDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const { data, error } = await getUserDocuments();
      if (error) throw error;
      setUserDocuments(data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const toggleAnalysisPicker = () => {
    if (!activeDocuments.length) return;
    setShowAnalysisPicker(!showAnalysisPicker);
    if (showDocumentPicker) setShowDocumentPicker(false);
    if (!showAnalysisPicker && activeDocuments.length) {
      loadDocumentAnalyses(activeDocuments[0].id);
    }
  };

  const clearAnalysis = () => {
    setSelectedAnalysis(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        documentPickerRef.current && !documentPickerRef.current.contains(event.target as Node) &&
        analysisPickerRef.current && !analysisPickerRef.current.contains(event.target as Node)
      ) {
        setShowDocumentPicker(false);
        setShowAnalysisPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDocumentAgent]);

  const selectDocumentForContext = async (doc: Document) => {
    try {
      setLoadingDocuments(true);
      let fullDoc = doc;
      if (!doc.extractedText) {
        try {
          const { getDocumentById } = await import('../../services/documentService');
          const { data: fetchedDoc, error } = await getDocumentById(doc.id);
          if (!error && fetchedDoc && fetchedDoc.extractedText) {
            fullDoc = { ...doc, ...fetchedDoc };
          }
        } catch (fetchErr) {
          console.error('Error fetching full document:', fetchErr);
        }
      }
      if (activeDocuments.some(d => d.id === fullDoc.id)) {
        setShowDocumentPicker(false);
        return;
      }
      if (activeDocuments.length >= 3) {
        console.warn('You can select up to 3 documents at once.');
        setShowDocumentPicker(false);
        return;
      }
      setActiveDocuments(prev => [...prev, fullDoc]);
      setShowDocumentPicker(false);
    } catch (err) {
      console.error('Error setting document context:', err);
    } finally {
      setLoadingDocuments(false);
      setSelectedAnalysis(null);
    }
  };
  
  const loadDocumentAnalyses = async (documentId: string) => {
    try {
      setLoadingAnalyses(true);
      const { data, error } = await getDocumentAnalyses(documentId);
      if (error) throw error;
      setAvailableAnalyses(data || []);
    } catch (err) {
      console.error('Error loading document analyses:', err);
      setAvailableAnalyses([]);
    } finally {
      setLoadingAnalyses(false);
    }
  };
  
  const selectAnalysisForContext = (analysis: DocumentAnalysisResult) => {
    setSelectedAnalysis(analysis);
    setShowAnalysisPicker(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);
  
  useEffect(() => {
    const storedDocumentJson = localStorage.getItem('activeDocumentForChat');
    if (storedDocumentJson) {
      try {
        const storedDocData = JSON.parse(storedDocumentJson);
        const docTimestamp = new Date(storedDocData.timestamp).getTime();
        const now = new Date().getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        
        if (now - docTimestamp < tenMinutesMs) {
          const document: Document = {
            id: storedDocData.id,
            filename: storedDocData.filename,
            contentType: 'application/pdf',
            size: 0, 
            uploadedAt: storedDocData.timestamp,
            processingStatus: 'completed',
            storagePath: `/documents/${storedDocData.id}`,
            extractedText: storedDocData.extractedText
          };
          setActiveDocuments([document]);
          localStorage.removeItem('activeDocumentForChat');
          if (document.id && document.extractedText) {
            loadDocumentAnalyses(document.id);
          }
        } else {
          localStorage.removeItem('activeDocumentForChat');
        }
      } catch (error) {
        console.error('Error loading document from localStorage:', error);
        localStorage.removeItem('activeDocumentForChat');
      }
    }
  }, []);

  const isCentered = isNewChat || messagesCount === 0;
  const containerVariants = {
    centered: { 
      maxWidth: '800px',
      width: '100%',
      margin: '0 auto',
      marginBottom: '0px',
    },
    bottom: { 
      maxWidth: '100%',
      width: '100%',
      margin: '0',
      marginBottom: '0px',
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const currentVal = e.target.value;
    setMessage(currentVal);

    if (currentVal.startsWith('/') && !currentVal.includes(' ')) {
        const query = currentVal.substring(1).toLowerCase();
        setFilteredCommands(
            commandActions.filter(cmd =>
                cmd.label.substring(1).toLowerCase().includes(query)
            )
        );
        setShowCommandHint(true);
    } else {
        setShowCommandHint(false);
    }
  };

  useEffect(() => {
    if (!showCommandHint) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        commandDropdownRef.current &&
        !commandDropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowCommandHint(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCommandHint]);

  const removeActiveDocument = (docId: string) => {
    setActiveDocuments(prev => prev.filter(d => d.id !== docId));
  };

  useEffect(() => {
    const task = parseCommand(message.trim());
    if (!isDocumentAgent(task)) return;
    let newMessage = message;
    if (task && task.type === 'agent') {
      if (task.agent === 'compare') {
        if (activeDocuments.length >= 2) {
          newMessage = `/agent compare ${activeDocuments[0].id} ${activeDocuments[1].id}`;
        } else {
          newMessage = '/agent compare [docA_id] [docB_id]';
        }
      } else if (task.agent === 'find_clause') {
        const clause = (task as { agent: 'find_clause'; clause: string }).clause || '';
        if (activeDocuments.length >= 1) {
          newMessage = `/agent find_clause "${clause}" in ${activeDocuments[0].id}`;
          if (/from\s+/.test(message)) {
            newMessage = `/agent find_clause "${clause}" from ${activeDocuments[0].id}`;
          }
        } else {
          newMessage = `/agent find_clause "${clause}" in [doc_id]`;
          if (/from\s+/.test(message)) {
            newMessage = `/agent find_clause "${clause}" from [doc_id]`;
          }
        }
      } else if (task.agent === 'flag_privileged_terms' || task.agent === 'generate_timeline') {
        if (activeDocuments.length >= 1) {
          newMessage = `/agent ${task.agent} in ${activeDocuments[0].id}`;
          if (/from\s+/.test(message)) {
            newMessage = `/agent ${task.agent} from ${activeDocuments[0].id}`;
          }
        } else {
          newMessage = `/agent ${task.agent} in [doc_id]`;
          if (/from\s+/.test(message)) {
            newMessage = `/agent ${task.agent} from [doc_id]`;
          }
        }
      }
    }
    if (newMessage !== message) {
      setMessage(newMessage);
    }
  }, [activeDocuments, message]);

  return (
    <div className="relative w-full">
      <motion.div 
        className={`border-t border-gray-800 p-4 relative w-full ${isCentered ? 'flex flex-col items-center justify-center min-h-[240px]' : ''}`}
        initial={isCentered ? 'centered' : 'bottom'}
        animate={isCentered ? 'centered' : 'bottom'}
        variants={containerVariants}
        transition={{ duration: 0.5, ease: [0.19, 1.0, 0.22, 1.0] }}
      >
        <AnimatePresence>
          {showCommandHint && filteredCommands.length > 0 && (
            <motion.div
              ref={commandDropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-[50px] left-0 right-0 mb-1 z-10 max-h-60 overflow-y-auto rounded-md bg-gray-700 dark:bg-gray-800 shadow-lg border border-gray-600 dark:border-gray-700"
            >
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    setMessage(cmd.label + ' ');
                    setShowCommandHint(false);
                    textareaRef.current?.focus();
                  }}
                  className={`flex items-center w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-600 dark:hover:bg-gray-700`}
                >
                  <div className="mr-3 text-gray-400">{cmd.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium text-white dark:text-gray-100">{cmd.label}</p>
                    <p className="text-xs text-gray-300 dark:text-gray-400">{cmd.description}</p>
                  </div>
                </button>
              ))}
              {filteredCommands.length > 4 && (
                <div className="px-3 py-1.5 text-center text-xs text-gray-400 italic bg-gray-700 dark:bg-gray-800 border-t border-gray-600 dark:border-gray-700 sticky bottom-0">
                  Scroll for more commands
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {activeDocuments.map((doc) => (
            <motion.div
              key={doc.id}
              className="rounded-md bg-gray-800 mb-3 p-2 w-full flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-sm text-text-primary truncate max-w-[220px]">
                    <span className="text-gray-400">Using document:</span> {doc.filename}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeActiveDocument(doc.id)}
                className="text-gray-500 hover:text-gray-300 ml-2 transition-colors duration-200"
                aria-label="Remove document context"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {selectedAnalysis && (
            <motion.div 
              className="rounded-md bg-gray-800 mb-3 p-2 w-full flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-text-primary truncate max-w-[220px]">
                  <span className="text-gray-400">Using analysis:</span> {selectedAnalysis.analysisType} analysis
                </span>
              </div>
              <button
                onClick={clearAnalysis}
                className="text-gray-500 hover:text-gray-300 ml-2 transition-colors duration-200"
                aria-label="Remove analysis context"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showDocumentPicker && (
            <motion.div 
              ref={documentPickerRef}
              className="absolute bottom-24 left-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-10 w-80"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center text-sm text-gray-400 mb-2 p-2">
                <span>Select a document for context</span>
                {loadingDocuments && (
                  <motion.div 
                    className="h-4 w-4 border-2 border-gray-400 border-t-primary rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  />
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {userDocuments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {loadingDocuments 
                      ? 'Loading documents...' 
                      : 'No documents found. Upload a document first.'}
                  </div>
                ) : (
                  userDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2 hover:bg-gray-700 rounded cursor-pointer"
                      onClick={() => selectDocumentForContext(doc)}
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <div className="text-white truncate">{doc.filename}</div>
                          <div className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <button
                        className="ml-2 px-2 py-1 text-xs bg-primary text-white rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMessage(`/agent find_clause "" in ${doc.id}`);
                          setShowDocumentPicker(false);
                          setTimeout(() => textareaRef.current?.focus(), 0);
                        }}
                        title="Find a clause in this document"
                      >
                        Find Clause
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className={`bg-gray-900 rounded-lg relative overflow-hidden transition-all duration-300 mt-2 w-full ${isDraggingFile ? 'border-primary border-2' : ''}`}
          whileHover={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={"Type anything, / for agent..."}
            rows={1}
            className={`w-full bg-transparent text-text-primary px-3 py-3 pr-12 pb-14 resize-none focus:outline-none rounded-lg transition-all duration-200 ${showCommandHint ? 'ring-2 ring-primary' : ''}`}
            disabled={disabled}
            style={{ minHeight: '50px' }}
          />
          
          <div className="absolute bottom-2 left-2 flex items-center p-1 bg-gray-800 rounded-lg space-x-2">
            <button className="p-2 rounded-md bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600 transition-colors" onClick={handleFileButtonClick} type="button" disabled={disabled} aria-label="Upload document" title="Upload document" >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /> </svg>
            </button>
            <button className="p-2 rounded-md bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600 transition-colors" onClick={toggleDocumentPicker} type="button" disabled={disabled} aria-label="Select document" title="Select existing document" >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /> </svg>
            </button>
            <button className={`p-2 rounded-md ${activeDocuments.length ? 'bg-gray-700 text-gray-300 hover:text-primary hover:bg-gray-600' : 'bg-gray-800 text-gray-600 cursor-not-allowed'} transition-colors`} onClick={toggleAnalysisPicker} type="button" disabled={disabled || !activeDocuments.length} aria-label="Add analysis context" title={activeDocuments.length ? "Include document analysis" : "Select a document first"} >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /> <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /> </svg>
            </button>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.docx,.txt,.doc,.rtf" multiple />

          <motion.button className={` absolute right-3 bottom-3 bg-primary hover:bg-primary-dark rounded-full p-2 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 shadow-md `} onClick={handleSubmit} disabled={disabled || !message.trim()} type="button" aria-label="Send message" title="Send message" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} >
            <Send size={18} />
          </motion.button>
        </motion.div>
          
        <AnimatePresence>
          {showAnalysisPicker && (
            <motion.div 
              ref={analysisPickerRef} 
              className="absolute left-20 bottom-14 w-64 max-h-80 overflow-y-auto bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-700 z-10"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-text-primary mb-2">Select Analysis</h3>
              {loadingAnalyses ? (
                <div className="flex justify-center p-3"> <motion.div className="rounded-full h-5 w-5 border-b-2 border-primary" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} ></motion.div> </div>
              ) : availableAnalyses.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No analyses available for this document.</p>
              ) : (
                <div className="space-y-1">
                  {availableAnalyses.map((analysis, index) => (
                    <motion.button key={`${analysis.id}-${analysis.analysisType}`} className="text-sm w-full text-left px-3 py-2 rounded hover:bg-gray-700 flex items-center justify-between transition-colors duration-200" onClick={() => selectAnalysisForContext(analysis)} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ backgroundColor: 'rgba(107, 114, 128, 0.5)' }} >
                      <span className="text-text-primary">{analysis.analysisType}</span>
                      <span className="text-xs text-gray-400">{new Date(analysis.createdAt).toLocaleDateString()}</span>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          
        {!isNewChat && messagesCount > 0 && (
          <div className="mt-2 flex justify-center">
            <motion.div className="text-xs text-gray-400 px-2 py-1 rounded-md bg-gray-800/50" initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.2 }} >
              Type your message or ask a question about your legal documents
            </motion.div>
          </div>
        )}

        {isDocumentAgent(parseCommand(message)) && activeDocuments.length > 0 && (
          <div className="text-xs text-primary mt-1">
            {`Selected document${activeDocuments.length > 1 ? 's' : ''} will be used for this agent.`}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ChatInput;