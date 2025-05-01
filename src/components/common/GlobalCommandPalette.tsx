import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { useSetAtom } from 'jotai'; // Import useSetAtom
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { uploadModalOpenAtom } from '@/atoms/appAtoms'; // Import atom
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'; 
import { Search, FileText, Folder, Settings, Mail, Square, File, Sparkles, Upload, LogOut, Globe } from 'lucide-react'; // Example & actual icons
import { Icons } from '@/components/ui/Icons'; // Use our Icons component
import useDebounce from '@/hooks/useDebounce'; // Import the hook
import * as caseService from '@/services/caseService';
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { Case } from '@/types/case';
import { DocumentMetadata } from '@/types/document';
import { DocumentTemplate } from '@/types/template';
import { Spinner } from '@/components/ui/Spinner'; // Import Spinner

// Define structure for search results
interface SearchResults {
    commands: CommandAction[];
    cases: Case[];
    documents: DocumentMetadata[];
    templates: DocumentTemplate[];
}

// Define structure for command actions (similar to ChatInput)
interface CommandAction {
    id: string;
    label: string;
    icon: React.ReactElement;
    action: () => void;
    group: 'General' | 'Agent' | 'Navigation';
}

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ open, onOpenChange }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const debouncedSearch = useDebounce(search, 300); // Debounce search input
  const navigate = useNavigate(); // Hook for navigation
  const setIsUploadModalOpen = useSetAtom(uploadModalOpenAtom); // Hook to set upload modal state
  const { signOut } = useAuth(); // Hook for auth actions

  // --- Helper function to run command and close palette ---
  const runCommand = useCallback((commandAction: () => void) => {
    onOpenChange(false); // Close palette first
    // Use setTimeout to ensure palette is closed visually before action/navigation
    setTimeout(commandAction, 50); 
  }, [onOpenChange]);

  // --- Predefined Commands --- (Expand this list)
  const predefinedCommands: CommandAction[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <Icons.Square className="h-4 w-4" />, action: () => runCommand(() => navigate('/dashboard')), group: 'Navigation' },
    { id: 'nav-cases', label: 'Manage Cases', icon: <Icons.Folder className="h-4 w-4" />, action: () => runCommand(() => navigate('/cases')), group: 'Navigation' },
    { id: 'nav-file-manager', label: 'File Manager', icon: <Icons.File className="h-4 w-4" />, action: () => runCommand(() => navigate('/files')), group: 'Navigation' }, // Navigate to unified File Manager

    // Agent Commands (Navigate to chat and pre-fill)
    { 
      id: 'cmd-draft', 
      label: 'AI Document Draft...', 
      icon: <Icons.Sparkles className="h-4 w-4" />, 
      action: () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/agent draft ' } })), 
      group: 'Agent' 
    },
     { 
      id: 'cmd-perplexity', 
      label: 'AI Live Search...', 
      icon: <Icons.Globe className="h-4 w-4" />, 
      action: () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/agent perplexity ' } })), 
      group: 'Agent' 
    },
     { 
      id: 'cmd-research', 
      label: 'Legal Research...', 
      icon: <Icons.Search className="h-4 w-4" />, 
      action: () => runCommand(() => navigate('/dashboard', { state: { initialChatInput: '/research ' } })), 
      group: 'Agent' 
    },
    // General
    { id: 'cmd-upload', label: 'Upload Document', icon: <Icons.Upload className="h-4 w-4" />, action: () => runCommand(() => setIsUploadModalOpen(true)), group: 'General' },
    { id: 'cmd-settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, action: () => runCommand(() => navigate('/settings')), group: 'General' }, // Assuming /settings route exists
    { id: 'cmd-logout', label: 'Logout', icon: <LogOut className="h-4 w-4" />, action: () => runCommand(signOut), group: 'General' },
  ];

  useEffect(() => {
    if (!open) {
      setSearch(''); // Clear search when closed
      setResults(null);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      if (!debouncedSearch.trim()) {
        // Show predefined commands if search is empty
        setResults({ 
          commands: predefinedCommands, 
          cases: [], 
          documents: [], 
          templates: [] 
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const query = debouncedSearch.trim().toLowerCase();
        
        // Filter predefined commands
        const filteredCommands = predefinedCommands.filter(cmd => 
          cmd.label.toLowerCase().includes(query)
        );

        // Perform actual searches in parallel
        const [caseResults, docResults, templateResults] = await Promise.all([
          caseService.searchCasesByName(query, 5), 
          documentService.searchDocumentsByName(query, null, 5), // Pass null for caseId to search all user docs
          templateService.searchTemplatesByName(query, 5) 
        ]);

        // Check for errors in results (optional, could show partial results)
        if (caseResults.error) console.error("Case search error:", caseResults.error);
        if (docResults.error) console.error("Document search error:", docResults.error);
        if (templateResults.error) console.error("Template search error:", templateResults.error);

        setResults({
          commands: filteredCommands,
          cases: caseResults.data || [], 
          documents: docResults.data || [],
          templates: templateResults.data || []
        });

      } catch (error) {
        console.error("Error fetching command palette results:", error);
        setResults({ commands: [], cases: [], documents: [], templates: [] }); // Clear results on error
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearch, open, runCommand, navigate, setIsUploadModalOpen, signOut]); // Update dependencies

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={search}
        onValueChange={setSearch} 
      />
      <CommandList>
        {loading && (
          <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
             <Spinner size="sm" className="mr-2"/> Searching...
           </div>
        )}
        {!loading && !results?.commands.length && !results?.cases.length && !results?.documents.length && !results?.templates.length && debouncedSearch && 
          <CommandEmpty>No results found for "{debouncedSearch}".</CommandEmpty>}
        {!loading && !results && !debouncedSearch && <CommandEmpty>Type to search commands, cases, docs...</CommandEmpty>}

        {!loading && results && (
          <>
            {/* Render Commands */} 
            {results.commands.length > 0 && (
              <CommandGroup heading="Commands">
                {results.commands.map((cmd) => (
                  <CommandItem key={cmd.id} onSelect={cmd.action} value={cmd.label}>
                    {cmd.icon}
                    <span className='ml-2'>{cmd.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
             
             {/* Render Cases */} 
             {results.cases.length > 0 && <CommandSeparator />} 
             {results.cases.length > 0 && (
                 <CommandGroup heading="Cases">
                    {results.cases.map((c) => (
                       <CommandItem 
                         key={c.id} 
                         onSelect={() => runCommand(() => navigate(`/cases/${c.id}`))}
                         value={`Case: ${c.name}`}
                       >
                         <Folder className="mr-2 h-4 w-4" />
                         <span>{c.name}</span>
                         {c.case_number && <span className="ml-auto text-xs text-muted-foreground">#{c.case_number}</span>}
                       </CommandItem>
                     ))}
                 </CommandGroup>
             )}

            {/* Render Documents */} 
             {results.documents.length > 0 && <CommandSeparator />} 
             {results.documents.length > 0 && (
               <CommandGroup heading="Documents">
                 {results.documents.map((doc) => (
                   <CommandItem 
                     key={doc.id} 
                     onSelect={() => runCommand(() => navigate(`/view/document/${doc.id}`))}
                     value={`Document: ${doc.filename}`}
                   >
                     <FileText className="mr-2 h-4 w-4" />
                     <span>{doc.filename}</span>
                     {/* Maybe add case name or date? Needs fetching case details or adding to search result */}
                   </CommandItem>
                 ))}
               </CommandGroup>
             )}
             
             {/* Render Templates */} 
             {results.templates.length > 0 && <CommandSeparator />} 
             {results.templates.length > 0 && (
                 <CommandGroup heading="Templates">
                    {results.templates.map((tmpl) => (
                       <CommandItem 
                         key={tmpl.id} 
                         onSelect={() => runCommand(() => navigate(`/edit/template/${tmpl.id}`))}
                         value={`Template: ${tmpl.name}`}
                       >
                         <Icons.FileText className="mr-2 h-4 w-4" />
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