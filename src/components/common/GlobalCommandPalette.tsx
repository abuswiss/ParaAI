import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import { useAuth } from '@/hooks/useAuth';
import { 
    uploadModalOpenAtom, 
    activeCaseIdAtom, 
    newAITemplateDraftModalOpenAtom,
    newAIDocumentDraftModalOpenAtom
} from '@/atoms/appAtoms';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  FileText,
  Folder,
  Settings,
  Mail,
  Square,
  File,
  Sparkles,
  Upload,
  LogOut,
  Globe,
  PlusCircle,
  FilePlus,
  BrainCircuit,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import {
  FolderIcon,
  DocumentIcon,
  FileTextIcon
} from '@/components/ui/Icons';
import useDebounce from '@/hooks/useDebounce';
import * as caseService from '@/services/caseService';
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { Case } from '@/types/case';
import { DocumentMetadata } from '@/types/document';
import { DocumentTemplate } from '@/types/template';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

import { SemanticSearchResultItem } from '@/services/documentService';

interface SearchResults {
    commands: CommandAction[];
    cases: Case[];
    documents: DocumentMetadata[];
    templates: DocumentTemplate[];
    semanticHits: SemanticSearchResultItem[];
}

interface CommandAction {
    id: string;
    label: string;
    icon: React.ReactElement;
    action: (() => void) | null;
    group: 'General' | 'Agent' | 'Navigation' | 'Create' | 'Suggested';
    disabled?: boolean;
    disabledTooltip?: string;
}

interface IntentResponse {
    intent: string;
    params?: Record<string, any>;
    message?: string;
}

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ open, onOpenChange }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [suggestedAction, setSuggestedAction] = useState<IntentResponse | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const debouncedIntentSearch = useDebounce(search, 500);

  const navigate = useNavigate();
  const { signOut } = useAuth();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const setActiveCaseId = useSetAtom(activeCaseIdAtom);
  
  const setIsUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const setIsNewAITemplateModalOpen = useSetAtom(newAITemplateDraftModalOpenAtom);
  const setIsNewAIDocumentDraftModalOpen = useSetAtom(newAIDocumentDraftModalOpenAtom);

  const isCaseActive = !!activeCaseId;

  const runCommand = useCallback((commandAction: () => void) => {
    onOpenChange(false);
    setTimeout(commandAction, 50);
  }, [onOpenChange]);

  const handleIntentAction = useCallback((intent: IntentResponse) => {
    if (!intent || !intent.intent) return;
    console.log('Handling intent:', intent);

    const { intent: type, params, message } = intent;

    switch (type) {
        case 'navigate':
            if (params?.path) {
                if (params.path === '/compare' && !activeCaseId) {
                    toast.info('Please select an active matter to compare documents.');
                    return;
                }
                const targetPath = params.path === '/compare' && activeCaseId ? `/cases/${activeCaseId}/compare` : params.path;
                runCommand(() => navigate(targetPath));
            }
            break;
        case 'open_modal':
            if (params?.modal) {
                const needsActiveMatter = ['NewAIDocumentDraftModal', 'UploadModal'];
                if (needsActiveMatter.includes(params.modal) && !activeCaseId) {
                    toast.info(`Please select an active matter to use ${params.modal.replace('Modal','')}.`);
                    return;
                }

                if (params.modal === 'NewAITemplateDraftModal') runCommand(() => setIsNewAITemplateModalOpen(true));
                else if (params.modal === 'NewAIDocumentDraftModal') runCommand(() => setIsNewAIDocumentDraftModalOpen(true));
                else if (params.modal === 'UploadModal') runCommand(() => setIsUploadModalOpen(true));
            }
            break;
        case 'navigate_and_focus_search':
            if (params?.path && params?.search_area) {
                runCommand(() => navigate(params.path, { state: { focusSearch: params.search_area } }));
            }
            break;
        case 'general_search':
            toast.info(message || `Searching broadly for: ${params?.original_query}`);
            break;
        default:
            console.warn('Unknown intent type:', type);
            toast.error('Sorry, I could not understand that command.');
    }
  }, [activeCaseId, runCommand, navigate, setIsUploadModalOpen, setIsNewAITemplateModalOpen, setIsNewAIDocumentDraftModalOpen]);

  const predefinedCommands = useMemo((): CommandAction[] => {
    const caseRequiredTooltip = "Requires an active matter to be selected.";
    return [
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <Square className="h-4 w-4" />, action: () => runCommand(() => navigate('/dashboard')), group: 'Navigation' },
      { id: 'nav-files', label: 'File Manager (Matters & Docs)', icon: <DocumentIcon className="h-4 w-4" />, action: () => runCommand(() => navigate('/files')), group: 'Navigation' },
      {
        id: 'create-doc',
        label: 'Create Blank Document',
        icon: <FilePlus className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => navigate(`/edit/document/new?caseId=${activeCaseId}`)) : null,
        group: 'Create',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      {
        id: 'cmd-upload',
        label: 'Upload Document',
        icon: <Upload className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => setIsUploadModalOpen(true)) : null,
        group: 'General',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      { id: 'nav-templates', label: 'Manage Templates', icon: <FileText className="h-4 w-4" />, action: () => runCommand(() => navigate('/files', { state: { view: 'templates' }})), group: 'Navigation'},
      { id: 'create-template', label: 'Create Blank Template', icon: <FilePlus className="h-4 w-4" />, action: () => runCommand(() => navigate('/edit/template/new')), group: 'Create' }, 
      { id: 'cmd-settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, action: () => runCommand(() => navigate('/settings')), group: 'General' },
      { id: 'cmd-logout', label: 'Logout', icon: <LogOut className="h-4 w-4" />, action: () => runCommand(signOut), group: 'General' },
    ];
  }, [isCaseActive, activeCaseId, runCommand, setIsUploadModalOpen, signOut, navigate]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults(null);
      setSuggestedAction(null);
      setLoading(false);
      setIntentLoading(false);
      return;
    }
    if (debouncedIntentSearch.trim()) {
        setIntentLoading(true);
        supabase.functions.invoke('interpret-search-intent', {
            body: { query: debouncedIntentSearch.trim() }
        }).then(({ data, error }) => {
            if (error) {
                console.error("Intent error:", error);
                toast.error("Could not interpret command intent.");
                setSuggestedAction(null);
            } else {
                setSuggestedAction(data as IntentResponse);
            }
        }).finally(() => setIntentLoading(false));
    } else {
        setSuggestedAction(null);
    }

    const fetchResults = async () => {
      if (!debouncedSearch.trim()) {
        setResults({
          commands: predefinedCommands,
          cases: [],
          documents: [],
          templates: [],
          semanticHits: [],
        });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const query = debouncedSearch.trim().toLowerCase();
        const filteredCommands = predefinedCommands.filter(cmd =>
          cmd.label.toLowerCase().includes(query)
        );
        const [caseResults, docResults, templateResults, semanticResults] = await Promise.all([
          caseService.searchCasesByName(query, 5),
          documentService.searchDocumentsByName(query, activeCaseId, 5),
          templateService.searchTemplatesByName(query, 5),
          documentService.semanticSearchDocuments(query, 5, activeCaseId)
        ]);

        if (caseResults.error) console.error("Case search error:", caseResults.error);
        if (docResults.error) console.error("Document search error:", docResults.error);
        if (templateResults.error) console.error("Template search error:", templateResults.error);
        if (semanticResults.error) console.error("Semantic search error:", semanticResults.error);

        setResults({
          commands: filteredCommands,
          cases: caseResults.data || [],
          documents: docResults.data || [],
          templates: templateResults.data || [],
          semanticHits: semanticResults.data || []
        });
      } catch (error) {
        console.error("Error fetching command palette results:", error);
        setResults({ commands: [], cases: [], documents: [], templates: [], semanticHits: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [debouncedSearch, debouncedIntentSearch, open, predefinedCommands, activeCaseId]);

  const hasAnyResults = results && (
    results.commands.length > 0 ||
    results.cases.length > 0 ||
    results.documents.length > 0 ||
    results.templates.length > 0 ||
    results.semanticHits.length > 0
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <VisuallyHidden.Root>
        <DialogTitle>Command Palette</DialogTitle>
      </VisuallyHidden.Root>
      <CommandInput
        placeholder="Ask, or search commands, matters, docs, content..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {(loading || intentLoading) && (
          <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
             <Spinner size="sm" className="mr-2"/> {(intentLoading && !loading) ? 'Interpreting command...' : 'Searching...'}
           </div>
        )}

        {suggestedAction && suggestedAction.intent !== 'general_search' && !intentLoading && (
            <CommandGroup heading="Suggested Action">
                <CommandItem
                    key={`intent-${suggestedAction.intent}`}
                    onSelect={() => handleIntentAction(suggestedAction)}
                    className="cursor-pointer"
                >
                    <Lightbulb className="mr-2 h-4 w-4 text-yellow-500" />
                    <span>
                        {suggestedAction.message || 
                         `${suggestedAction.intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                         ${suggestedAction.params?.path ? ` (${suggestedAction.params.path})` : ''}
                         ${suggestedAction.params?.modal ? ` (Open ${suggestedAction.params.modal.replace('Modal','')})` : ''}`
                        }
                    </span>
                </CommandItem>
                <CommandSeparator />
            </CommandGroup>
        )}

        {!loading && !intentLoading && !hasAnyResults && debouncedSearch && suggestedAction?.intent === 'general_search' &&
          <CommandEmpty>No specific action or results found for "{debouncedSearch}".</CommandEmpty>}
        {!loading && !intentLoading && !debouncedSearch && 
           <CommandEmpty>Type to search commands, matters, docs, content...</CommandEmpty>}

        {results && !loading && (
          <>
            {results.cases.length > 0 && (
              <CommandGroup heading="Matters">
                {results.cases.map((c) => (
                  <CommandItem 
                    key={`case-${c.id}`} 
                    onSelect={() => runCommand(() => { setActiveCaseId(c.id); navigate('/files?caseId=' + c.id); })}
                    className="cursor-pointer"
                  >
                    <FolderIcon className="mr-2 h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground" />
                    {c.name || 'Untitled Matter'}
                    {c.case_number && <span className='ml-2 text-xs text-muted-foreground'>{c.case_number}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.documents.length > 0 && (
              <CommandGroup heading="Documents (Current Matter)">
                {results.documents.map((doc) => (
                  <CommandItem 
                    key={`doc-${doc.id}`} 
                    onSelect={() => runCommand(() => navigate(`/view/document/${doc.id}`))}
                    className="cursor-pointer"
                  >
                    <FileTextIcon className="mr-2 h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground" />
                    {doc.filename || 'Untitled Document'}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
             {results.semanticHits.length > 0 && (
              <CommandGroup heading="Relevant Content Matches (Current Matter)">
                {results.semanticHits.map((hit) => (
                  <CommandItem
                    key={`semantic-${hit.document_id}-${hit.chunk_id}`}
                    onSelect={() => runCommand(() => navigate(`/review/document/${hit.document_id}?scrollToChunk=${hit.chunk_id}`))}
                    className="cursor-pointer flex flex-col items-start"
                  >
                    <div className="flex items-center w-full">
                        <BrainCircuit className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground dark:text-dark-muted-foreground" />
                        <span className="truncate font-medium">{hit.filename || 'Document'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-normal">
                        {hit.text_chunk}
                    </p>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.templates.length > 0 && (
              <CommandGroup heading="Templates">
                {results.templates.map((template) => (
                  <CommandItem 
                    key={`template-${template.id}`} 
                    onSelect={() => runCommand(() => navigate(`/ai/templates/${template.id}/fill`))}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground dark:text-dark-muted-foreground" />
                    {template.name || 'Untitled Template'}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.commands.length > 0 && (
              <CommandGroup heading="Commands">
                {results.commands.map((cmd) => (
                  <CommandItem 
                    key={cmd.id} 
                    onSelect={cmd.action ? () => cmd.action!() : undefined}
                    disabled={cmd.disabled}
                    className={cn("cursor-pointer", cmd.disabled && "opacity-50 cursor-not-allowed")}
                    title={cmd.disabled ? cmd.disabledTooltip : undefined}
                  >
                    {cmd.icon}
                    <span>{cmd.label}</span>
                    {cmd.disabled && <AlertTriangle className="ml-auto h-4 w-4 text-amber-500" title={cmd.disabledTooltip} />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalCommandPalette; 