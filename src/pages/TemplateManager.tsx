import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import TemplateList from '@/components/templates/TemplateList';
import { 
    PlusIcon, 
} from '@/components/ui/Icons';
import { Upload, Sparkles, List, LayoutGrid, ArrowUpDown, Search, Plus, FileText, Play, Edit } from 'lucide-react';
import { getAvailableTemplates, getTemplateById, DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import TemplateImportModal from '@/components/templates/TemplateImportModal';
import UseTemplateModal from '@/components/templates/UseTemplateModal';
import { Input } from '@/components/ui/Input';
import TemplateGrid from '@/components/templates/TemplateGrid';
import { fillTemplateModalTriggerAtom, newAITemplateDraftModalOpenAtom } from '@/atoms/appAtoms';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle } from 'lucide-react';

// Define types for sorting and view mode
type TemplateSortKey = 'name' | 'category' | 'createdAt' | 'updatedAt'; // Example keys
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const TemplateManager: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerFillTemplateModal = useSetAtom(fillTemplateModalTriggerAtom);
  const setIsNewAITemplateModalOpen = useSetAtom(newAITemplateDraftModalOpenAtom);
  const [isFetchingContent, setIsFetchingContent] = useState<string | null>(null);

  // State for import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // State for Use Template modal
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [templateToUseId, setTemplateToUseId] = useState<string | null>(null);

  // Add state for filtering, sorting, and view mode for templates
  const [viewModeTemplates, setViewModeTemplates] = useState<ViewMode>('list');
  const [filterQueryTemplates, setFilterQueryTemplates] = useState('');
  const [sortKeyTemplates, setSortKeyTemplates] = useState<TemplateSortKey>('name');
  const [sortOrderTemplates, setSortOrderTemplates] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getAvailableTemplates();
      if (fetchError) throw fetchError;
      setTemplates(data || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for selecting a template from the list (navigate to viewer)
  const handleSelectTemplate = (templateId: string | null) => {
    if (templateId) {
      navigate(`/view/template/${templateId}`); // Navigate to viewer
    } else {
      // Handle case where selection is cleared if necessary, though clicking should always have an ID
    }
  };

  // Handler for clicking the "Create New Template" button (navigates to editor)
  const handleCreateNewTemplate = () => {
      navigate('/edit/template'); // Navigate to the new editor page
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
  };

  // --- Filtering and Sorting Logic (Remains the same) --- 
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

  // --- Handler for clicking the "Use" (Play) button --- 
  const handleUseTemplateClick = async (templateId: string) => {
      if (isFetchingContent === templateId) return; 
      
      console.log('[TemplateManager] Use button clicked for:', templateId);
      setIsFetchingContent(templateId);
      try {
          // Fetch the specific template using getTemplateById
          const { data: template, error } = await getTemplateById(templateId);
          if (error) throw error;
          if (!template || !template.content) {
              throw new Error('Selected template content not found.');
          }
          // Set the trigger atom to open the Fill modal
          triggerFillTemplateModal({ id: template.id, name: template.name, content: template.content }); 
      } catch (err) {
          console.error("Error fetching template content for use:", err);
          alert("Error loading template details to use it."); 
      } finally {
          setIsFetchingContent(null); 
      }
  };
  // --------

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* --- Header Section --- */}
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          Template Management
        </h1>
        <div className="flex items-center gap-2">
          {/* Buttons remain the same */}
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Template
          </Button>
          <Button onClick={() => setIsNewAITemplateModalOpen(true)} variant="outline" size="sm">
               <Sparkles className="h-4 w-4 mr-2" />
               Create AI Template Draft
          </Button>
          <Button onClick={handleCreateNewTemplate} size="sm">
               <PlusIcon className="h-4 w-4 mr-2" />
               Create New Template (Manual)
          </Button>
        </div>
      </div>
      
      {/* --- Two-Column Layout Adjusted to Single Column --- */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Template List/Grid - Now spans full width */}
        <div className="md:col-span-3 bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col overflow-hidden">
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
                  {/* Sort Button */}
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
                  isLoading={isLoading}
                  error={error}
                  activeTemplateId={null}
                  onSelectTemplate={handleSelectTemplate} // Selection now only controls preview highlight
                  onUseTemplate={handleUseTemplate}
                />
             ) : (
                 <TemplateGrid 
                    templates={processedTemplates} 
                    isLoading={isLoading}
                    error={error}
                    activeTemplateId={null}
                    onSelectTemplate={handleSelectTemplate} // Selection now only controls preview highlight
                    onUseTemplate={handleUseTemplate}
                 />
             )}
           </div>
        </div>
      </div>
      
      {/* --- Modals --- */}
      <TemplateImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImportSuccess={() => { 
          setIsImportModalOpen(false);
          fetchTemplates();
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