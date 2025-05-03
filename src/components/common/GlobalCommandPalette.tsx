import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { useSetAtom, useAtomValue } from 'jotai'; // Import useSetAtom and useAtomValue
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { uploadModalOpenAtom, activeCaseIdAtom } from '@/atoms/appAtoms'; // Import atom and activeCaseIdAtom
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
  BrainCircuit, // Icon for semantic search
  AlertTriangle // Icon for the warning
} from 'lucide-react';
import {
  FolderIcon,
  DocumentIcon,
  FileTextIcon
} from '@/components/ui/Icons';
import useDebounce from '@/hooks/useDebounce';
import * as caseService from '@/services/caseService';
import * as documentService from '@/services/documentService'; // Import the whole service
import * as templateService from '@/services/templateService';
import { Case } from '@/types/case';
import { DocumentMetadata } from '@/types/document';
import { DocumentTemplate } from '@/types/template';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

// Import the new type for semantic search results
import { SemanticSearchResultItem } from '@/services/documentService';

// Define structure for search results
interface SearchResults {
    commands: CommandAction[];
    cases: Case[];
    documents: DocumentMetadata[];
    templates: DocumentTemplate[];
    semanticHits: SemanticSearchResultItem[]; // Add state for semantic results
}

// Define structure for command actions
interface CommandAction {
    id: string;
    label: string;
    icon: React.ReactElement;
    action: (() => void) | null; // Action can be null if disabled
    group: 'General' | 'Agent' | 'Navigation' | 'Create';
    disabled?: boolean; // Explicit disabled flag
    disabledTooltip?: string; // Tooltip explaining why it's disabled
}

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ open, onOpenChange }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();
  const setIsUploadModalOpen = useSetAtom(uploadModalOpenAtom);
  const { signOut } = useAuth();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const setActiveCaseId = useSetAtom(activeCaseIdAtom);
  const isCaseActive = !!activeCaseId;

  const runCommand = useCallback((commandAction: () => void) => {
    onOpenChange(false);
    setTimeout(commandAction, 50);
  }, [onOpenChange]);

  const predefinedCommands = useMemo((): CommandAction[] => {
    const caseRequiredTooltip = "Requires an active case to be selected.";
    return [
      // Navigation
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <Square className="h-4 w-4" />, action: () => runCommand(() => navigate('/dashboard')), group: 'Navigation' },
      { id: 'nav-cases', label: 'Manage Cases', icon: <FolderIcon className="h-4 w-4" />, action: () => runCommand(() => navigate('/cases')), group: 'Navigation' },
      { id: 'nav-file-manager', label: 'File Manager', icon: <DocumentIcon className="h-4 w-4" />, action: () => runCommand(() => navigate('/files')), group: 'Navigation' },

      // Create
      { id: 'create-case', label: 'Create New Case', icon: <PlusCircle className="h-4 w-4" />, action: () => runCommand(() => navigate('/cases/new')), group: 'Create' },
      {
        id: 'create-doc',
        label: 'Create Blank Document',
        icon: <FilePlus className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => navigate('/edit/document/new')) : null,
        group: 'Create',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },

      // Agent Commands
      {
        id: 'cmd-draft',
        label: 'AI Document Draft...',
        icon: <Sparkles className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/agent draft ' } })) : null,
        group: 'Agent',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      {
        id: 'cmd-perplexity',
        label: 'AI Live Search...',
        icon: <Globe className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/agent perplexity ' } })) : null,
        group: 'Agent',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      {
        id: 'cmd-research',
        label: 'Legal Research...',
        icon: <Search className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/research ' } })) : null,
        group: 'Agent',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      // General
      {
        id: 'cmd-upload',
        label: 'Upload Document',
        icon: <Upload className="h-4 w-4" />,
        action: isCaseActive ? () => runCommand(() => setIsUploadModalOpen(true)) : null,
        group: 'General',
        disabled: !isCaseActive,
        disabledTooltip: caseRequiredTooltip
      },
      { id: 'cmd-settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, action: () => runCommand(() => navigate('/settings')), group: 'General' },
      { id: 'cmd-logout', label: 'Logout', icon: <LogOut className="h-4 w-4" />, action: () => runCommand(signOut), group: 'General' },
    ];
  }, [isCaseActive, navigate, runCommand, setIsUploadModalOpen, signOut]); // Dependencies for useMemo

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults(null);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      if (!debouncedSearch.trim()) {
        setResults({ // Show only predefined (filtered by activeCaseId) commands when search is empty
          commands: predefinedCommands, // Use the memoized list
          cases: [],
          documents: [],
          templates: [],
          semanticHits: [], // Ensure semanticHits is initialized
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const query = debouncedSearch.trim().toLowerCase();

        // Filter the memoized predefined commands further by the search query
        const filteredCommands = predefinedCommands.filter(cmd =>
          cmd.label.toLowerCase().includes(query)
        );

        // Perform all searches in parallel
        const [caseResults, docResults, templateResults, semanticResults] = await Promise.all([
          caseService.searchCasesByName(query, 5),
          documentService.searchDocumentsByName(query, null, 5),
          templateService.searchTemplatesByName(query, 5),
          documentService.semanticSearchDocuments(query, 5) // Call semantic search
        ]);

        // Log errors but allow partial results
        if (caseResults.error) console.error("Case search error:", caseResults.error);
        if (docResults.error) console.error("Document search error:", docResults.error);
        if (templateResults.error) console.error("Template search error:", templateResults.error);
        if (semanticResults.error) console.error("Semantic search error:", semanticResults.error); // Log semantic search errors

        setResults({
          commands: filteredCommands, // Use commands filtered by both caseId and search query
          cases: caseResults.data || [],
          documents: docResults.data || [],
          templates: templateResults.data || [],
          semanticHits: semanticResults.data || [] // Store semantic results
        });

      } catch (error) {
        console.error("Error fetching command palette results:", error);
        // Ensure results object structure is maintained on error
        setResults({ commands: [], cases: [], documents: [], templates: [], semanticHits: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  // Include navigate, setIsUploadModalOpen, signOut if they were dependencies for actions
  // runCommand is memoized and depends on onOpenChange
  }, [debouncedSearch, open, runCommand, navigate, setIsUploadModalOpen, signOut, predefinedCommands]); // Add predefinedCommands to dependencies

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
        placeholder="Type a command or search cases, docs, content..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {loading && (
          <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
             <Spinner size="sm" className="mr-2"/> Searching...
           </div>
        )}
        {!loading && !hasAnyResults && debouncedSearch &&
          <CommandEmpty>No results found for "{debouncedSearch}".</CommandEmpty>}
        {!loading && !debouncedSearch && 
           <CommandEmpty>Type to search commands, cases, docs, content...</CommandEmpty>
        }

        {!loading && results && (
          <>
            {/* Display warning message if no case is active - THIS IS THE ONE TO KEEP */}
            {!isCaseActive && (
              <div className="p-2 text-sm text-muted-foreground border-b flex items-center bg-orange-50 dark:bg-orange-900/20">
                <AlertTriangle className="mr-2 h-4 w-4 flex-shrink-0 text-orange-500" />
                Select a Case to enable case-specific commands.
              </div>
            )}

            {/* Commands */} 
            {results.commands.length > 0 && (
              <CommandGroup heading="Commands">
                {results.commands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={cmd.disabled ? undefined : cmd.action} // Only call action if not disabled
                    value={cmd.label}
                    disabled={cmd.disabled} // Pass disabled prop to CommandItem
                    className={cn(cmd.disabled && "text-muted-foreground cursor-not-allowed")}
                    // Optional: Add tooltip on hover for disabled items
                    title={cmd.disabled ? cmd.disabledTooltip : undefined}
                  >
                    {cmd.icon}
                    <span className='ml-2'>{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

             {/* Cases */} 
             {results.cases.length > 0 && <CommandSeparator />} 
             {results.cases.length > 0 && (
                 <CommandGroup heading="Cases">
                    {results.cases.map((c) => (
                       <CommandItem
                         key={c.id}
                         onSelect={() => runCommand(() => navigate(`/cases/${c.id}`))}
                         value={`Case: ${c.name}`}
                       >
                         <FolderIcon className="mr-2 h-4 w-4" />
                         <span>{c.name}</span>
                         {c.case_number && <span className="ml-auto text-xs text-muted-foreground">#{c.case_number}</span>}
                       </CommandItem>
                     ))}
                 </CommandGroup>
             )}

            {/* Documents (by name) */} 
             {results.documents.length > 0 && <CommandSeparator />} 
             {results.documents.length > 0 && (
               <CommandGroup heading="Documents">
                 {results.documents.map((doc) => (
                   <CommandItem
                     key={doc.id}
                     onSelect={() => {
                       if (!activeCaseId && doc.caseId) {
                         setActiveCaseId(doc.caseId);
                       }
                       runCommand(() => navigate(`/view/document/${doc.id}`));
                     }}
                     value={`Document: ${doc.filename}`}
                   >
                     <FileTextIcon className="mr-2 h-4 w-4" />
                     <span>{doc.filename}</span>
                   </CommandItem>
                 ))}
               </CommandGroup>
             )}

             {/* Document Content (Semantic Search) */} 
             {results.semanticHits.length > 0 && <CommandSeparator />} 
             {results.semanticHits.length > 0 && (
               <CommandGroup heading="Document Content">
                 {results.semanticHits.map((hit) => (
                   <CommandItem
                     key={hit.documentId}
                     onSelect={() => {
                       if (!activeCaseId && hit.caseId) {
                         setActiveCaseId(hit.caseId);
                       }
                       runCommand(() => navigate(`/view/document/${hit.documentId}`));
                     }}
                     value={`Content: ${hit.filename}: ${hit.matches[0]?.chunkText}`}
                   >
                     <BrainCircuit className="mr-2 h-4 w-4 text-purple-500" />
                     <div className="flex flex-col overflow-hidden">
                        <span className="truncate font-medium">{hit.filename}</span>
                        {hit.matches[0]?.chunkText && (
                           <span className="text-xs text-muted-foreground truncate">
                             ...{hit.matches[0].chunkText}...
                           </span>
                        )}
                     </div>
                   </CommandItem>
                 ))}
               </CommandGroup>
             )}

             {/* Templates */} 
             {results.templates.length > 0 && <CommandSeparator />} 
             {results.templates.length > 0 && (
                 <CommandGroup heading="Templates">
                    {results.templates.map((tmpl) => (
                       <CommandItem
                         key={tmpl.id}
                         onSelect={() => runCommand(() => navigate(`/edit/template/${tmpl.id}`))}
                         value={`Template: ${tmpl.name}`}
                       >
                         <FileTextIcon className="mr-2 h-4 w-4" />
                         <span>{tmpl.name}</span>
                         <span className="ml-auto text-xs text-muted-foreground capitalize">{tmpl.category}</span>
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