import React, { useState, useEffect, useMemo } from 'react';
import TemplateList from '@/components/templates/TemplateList';
import TemplateEditor from '@/components/templates/TemplateEditor';
import { 
    PlusIcon, 
} from '@/components/ui/Icons';
import { Upload, Sparkles, List, LayoutGrid, ArrowUpDown, Search } from 'lucide-react';
import { getAvailableTemplates, DocumentTemplate, importTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import TemplateImportModal from '@/components/templates/TemplateImportModal';
import NewAITemplateDraftModal from '@/components/templates/NewAITemplateDraftModal';
import UseTemplateModal from '@/components/templates/UseTemplateModal';
import TemplatePreviewPlaceholder from '@/components/templates/TemplatePreviewPlaceholder'; 
import TemplatePreview from '@/components/templates/TemplatePreview';
import { Input } from '@/components/ui/Input';
import TemplateGrid from '@/components/templates/TemplateGrid';

// Define types for sorting and view mode
type TemplateSortKey = 'name' | 'category' | 'createdAt' | 'updatedAt'; // Example keys
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const TemplateManager: React.FC = () => {
  // State for selected template (for preview or edit)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null | undefined>(undefined);
  // State to track if editor should be shown vs preview
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);

  // State for import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // State for AI draft modal
  const [isAIDraftModalOpen, setIsAIDraftModalOpen] = useState(false);
  // State for Use Template modal
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [templateToUseId, setTemplateToUseId] = useState<string | null>(null);

  // State for template data
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [errorTemplates, setErrorTemplates] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for re-fetching

  // Add state for filtering, sorting, and view mode for templates
  const [viewModeTemplates, setViewModeTemplates] = useState<ViewMode>('list');
  const [filterQueryTemplates, setFilterQueryTemplates] = useState('');
  const [sortKeyTemplates, setSortKeyTemplates] = useState<TemplateSortKey>('name');
  const [sortOrderTemplates, setSortOrderTemplates] = useState<SortOrder>('asc');

  // Fetch templates when component mounts or refreshTrigger changes
  useEffect(() => {
    setIsLoadingTemplates(true);
    setErrorTemplates(null);
    getAvailableTemplates()
      .then(({ data, error }) => {
        if (error) throw error;
        setTemplates(data || []);
      })
      .catch(err => {
        console.error("Error fetching templates:", err);
        setErrorTemplates("Failed to load templates.");
      })
      .finally(() => setIsLoadingTemplates(false));
  }, [refreshTrigger]);

  // Handler for selecting a template from the list (shows preview)
  const handleSelectTemplate = (templateId: string | null) => {
    setSelectedTemplateId(templateId); // Set the selected ID
    setIsEditingTemplate(false);     // Show preview, not editor
  };

  // Handler for clicking the "Create New Template" button (shows editor)
  const handleCreateNewTemplate = () => {
      setSelectedTemplateId(null); // Indicate new template
      setIsEditingTemplate(true);  // Open editor directly
  };
  
  // Handler for clicking the "Edit" button in the preview (shows editor)
  const handleEditTemplate = (templateId: string) => {
      // ID should already be selected, just switch to edit mode
      setSelectedTemplateId(templateId); // Ensure ID is set (might be redundant but safe)
      setIsEditingTemplate(true);
  };

  // Handler for returning from editor (Save/Cancel)
  const handleBackToList = (needsRefresh = false) => {
    // Keep selectedTemplateId to show preview of just saved/edited item
    // Or set to undefined if cancelling a *new* template creation
    if (selectedTemplateId === null) {
        setSelectedTemplateId(undefined);
    }
    setIsEditingTemplate(false); // Switch back to preview/placeholder view
    if (needsRefresh) {
        setRefreshTrigger(prev => prev + 1); // Trigger refresh if save was successful
    }
  };
  
  // Handler to open the Use Template modal
  const handleUseTemplate = (templateId: string) => {
    setTemplateToUseId(templateId);
    setIsUseModalOpen(true);
  };
  
  // Handler to close the Use Template modal
  const handleCloseUseModal = () => {
      setIsUseModalOpen(false);
      setTemplateToUseId(null);
      // Optionally trigger refresh if a draft was created?
      // setRefreshTrigger(prev => prev + 1);
  };

  // --- Filtering and Sorting Logic (Add this) ---
  const processedTemplates = useMemo(() => {
    let processed = [...templates];
    // Filter
    if (filterQueryTemplates) {
      const query = filterQueryTemplates.toLowerCase();
      processed = processed.filter(tmpl => 
        tmpl.name?.toLowerCase().includes(query) ||
        tmpl.description?.toLowerCase().includes(query) ||
        tmpl.category?.toLowerCase().includes(query) ||
        tmpl.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    // Sort
    processed.sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      switch (sortKeyTemplates) {
          case 'name':
              valA = a.name?.toLowerCase() || '';
              valB = b.name?.toLowerCase() || '';
              break;
          case 'category':
              valA = a.category?.toLowerCase() || '';
              valB = b.category?.toLowerCase() || '';
              break;
          case 'createdAt':
              valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              break;
          case 'updatedAt':
              valA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              valB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              break;
      }
      
      let comparison = 0;
      if (valA !== null && valB !== null) {
        if (valA < valB) comparison = -1;
        if (valA > valB) comparison = 1;
      } else if (valA !== null) {
        comparison = -1; 
      } else if (valB !== null) {
        comparison = 1;
      }

      return sortOrderTemplates === 'asc' ? comparison : comparison * -1;
    });
    return processed;
  }, [templates, filterQueryTemplates, sortKeyTemplates, sortOrderTemplates]);

  // Handler for sorting (simplified example - clicking toggles order)
  const handleSort = (key: TemplateSortKey) => {
      if (key === sortKeyTemplates) {
          setSortOrderTemplates(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKeyTemplates(key);
          setSortOrderTemplates('asc');
      }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* --- Header Section --- */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          Template Management
        </h1>
        <div className="flex items-center gap-2">
          {/* Buttons always visible now, editor is shown in right panel */}
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Template
          </Button>
          <Button onClick={() => setIsAIDraftModalOpen(true)} variant="outline" size="sm">
               <Sparkles className="h-4 w-4 mr-2" />
               Create AI Template Draft
          </Button>
          <Button onClick={handleCreateNewTemplate} size="sm">
               <PlusIcon className="h-4 w-4 mr-2" />
               Create New Template (Manual)
          </Button>
        </div>
      </div>
      
      {/* --- Two-Column Layout --- */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Left Column (Template List/Grid) */}
        <div className="md:col-span-1 bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col overflow-hidden">
           {/* --- Left Column Header with Controls --- */}
           <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-3">Templates</h2>
              <div className="flex items-center gap-2">
                  {/* Filter Input */}
                  <div className="relative flex-grow">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                          type="text"
                          placeholder="Filter templates..."
                          value={filterQueryTemplates}
                          onChange={(e) => setFilterQueryTemplates(e.target.value)}
                          className="pl-8 pr-2 py-1.5 text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                  </div>
                  {/* View Mode Toggle */}
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
                    <Button 
                      variant={viewModeTemplates === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewModeTemplates('list')}
                      className="p-1.5 rounded-r-none border-r border-gray-300 dark:border-gray-600"
                      title="List View"
                    >
                       <List className="h-4 w-4" />
                    </Button>
                     <Button 
                      variant={viewModeTemplates === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewModeTemplates('grid')}
                      className="p-1.5 rounded-l-none"
                      title="Grid View"
                    >
                       <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Add Sort Button/Dropdown Here if needed */}
                  {/* Example Sort Toggle Button */}
                   <Button 
                     variant="outline"
                     size="sm"
                     onClick={() => handleSort('name')} // Example: sort by name
                     title={`Sort by Name (${sortKeyTemplates === 'name' ? sortOrderTemplates : ' '})`}
                   >
                      <ArrowUpDown className="h-4 w-4" />
                   </Button>
              </div>
           </div>
           {/* --- Template List/Grid Area --- */}
           <div className="flex-grow overflow-y-auto p-2">
             {viewModeTemplates === 'list' ? (
                <TemplateList 
                  templates={processedTemplates} 
                  isLoading={isLoadingTemplates}
                  error={errorTemplates}
                  activeTemplateId={selectedTemplateId}
                  onSelectTemplate={handleSelectTemplate}
                  onUseTemplate={handleUseTemplate}
                />
             ) : (
                 // Render TemplateGrid when viewMode is 'grid'
                 <TemplateGrid 
                    templates={processedTemplates} 
                    isLoading={isLoadingTemplates}
                    error={errorTemplates}
                    activeTemplateId={selectedTemplateId}
                    onSelectTemplate={handleSelectTemplate} // Select still shows preview
                    onUseTemplate={handleUseTemplate}
                 />
             )}
           </div>
        </div>

        {/* Right Column (Preview, Editor, or Placeholder) */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col overflow-hidden">
          {selectedTemplateId !== undefined ? ( // If a template is selected (or null for new)
            isEditingTemplate ? (
              // Show Editor when editing or creating new
              <div className="flex-grow p-4 md:p-6 overflow-y-auto">
                <TemplateEditor
                  templateId={selectedTemplateId} // Pass null for new
                  onSaveSuccess={() => handleBackToList(true)}
                  onCancel={() => handleBackToList(false)}
                />
              </div>
            ) : (
              // Show Preview when a template is selected but not editing
              <TemplatePreview 
                  templateId={selectedTemplateId!} // Assert non-null because isEditing is false
                  onEdit={handleEditTemplate} 
              />
            )
          ) : (
            // Show Placeholder when no template is selected
            <TemplatePreviewPlaceholder /> 
          )}
        </div>
      </div>
      
      {/* --- Modals --- */}
      <TemplateImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImportSuccess={() => { 
          setIsImportModalOpen(false);
          setRefreshTrigger(prev => prev + 1);
        }}
      />
      <NewAITemplateDraftModal
        isOpen={isAIDraftModalOpen}
        onClose={() => {
            setIsAIDraftModalOpen(false);
            // Optionally trigger refresh if needed
            // setRefreshTrigger(prev => prev + 1);
        }}
      />
      
      {/* Render UseTemplateModal conditionally */}
      {isUseModalOpen && templateToUseId && (
        <UseTemplateModal 
          templateId={templateToUseId}
          isOpen={isUseModalOpen}
          onClose={handleCloseUseModal}
        />
      )}
    </div>
  );
};

export default TemplateManager;