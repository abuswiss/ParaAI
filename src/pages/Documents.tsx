import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DocumentUpload from '../components/documents/DocumentUpload';
import DocumentList from '../components/documents/DocumentList';
import DocumentGrid from '../components/documents/DocumentGrid';
import TemplateList from '../components/templates/TemplateList';
import TemplateGrid from '../components/templates/TemplateGrid';
import { Document } from '../types/document';
import DraftManagement from '../components/documents/drafting/DraftManagement';
import { DocumentTemplate, getAvailableTemplates, duplicateTemplate as duplicateTemplateService } from '@/services/templateService';
import AIDraftModal from '../components/ai/AIDraftModal';
import * as documentService from '@/services/documentService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';

type SortKey = 'filename' | 'uploadedAt' | 'templateName' | 'templateCategory'; 
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

const Documents: React.FC = () => {
  const { caseId } = useParams<{ caseId?: string }>();
  const navigate = useNavigate();

  // View/UI State
  const [activeTab, setActiveTab] = useState<'documents' | 'templates'>('documents');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftContext, setAIDraftContext] = useState<'template' | 'document'>('template');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [viewModeTemplates, setViewModeTemplates] = useState<ViewMode>('list');
  
  // Data State (Documents)
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  
  // Data State (Templates)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [errorTemplates, setErrorTemplates] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Filtering/Sorting State (Documents)
  const [filterQuery, setFilterQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('filename');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Filtering/Sorting State (Templates)
  const [filterQueryTemplates, setFilterQueryTemplates] = useState('');
  const [sortKeyTemplates, setSortKeyTemplates] = useState<SortKey>('templateName');
  const [sortOrderTemplates, setSortOrderTemplates] = useState<SortOrder>('asc');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refresh trigger specifically for templates
  const [refreshTemplatesTrigger, setRefreshTemplatesTrigger] = useState(0);

  // Fetch documents 
  useEffect(() => {
    if (!caseId) {
      setDocuments([]);
      setError(null);
      setIsLoading(false);
      setSelectedDocumentId(null);
      return;
    }
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedDocumentId(null);
      try {
        const { data: fetchedDocuments, error: fetchError } = await documentService.getUserDocuments(caseId);
        if (fetchError) throw fetchError;
        setDocuments(fetchedDocuments || []);
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocuments();
  }, [caseId, refreshTrigger]);

  // Fetch templates
  useEffect(() => {
    if (activeTab === 'templates') {
      const fetchTemplates = async () => {
        setIsLoadingTemplates(true);
        setErrorTemplates(null);
        // Don't clear selectedTemplateId here, keep it selected after refresh
        try {
          const { data: fetchedTemplates, error: fetchError } = await getAvailableTemplates(); 
          if (fetchError) throw fetchError;
          setTemplates(fetchedTemplates || []);
        } catch (err) {
          console.error("Error fetching templates:", err);
          setErrorTemplates("Failed to load templates.");
        } finally {
          setIsLoadingTemplates(false);
        }
      };
      fetchTemplates();
    } 
  }, [activeTab, refreshTemplatesTrigger]);

  // Memoized processed documents
  const processedDocuments = useMemo(() => {
    let processed = [...documents];
    if (filterQuery) {
      processed = processed.filter(doc => 
        doc.filename?.toLowerCase().includes(filterQuery.toLowerCase())
      );
    }
    processed.sort((a, b) => {
      let valA: string | Date | number | null = null;
      let valB: string | Date | number | null = null;
      if (sortKey === 'filename') {
        valA = a.filename?.toLowerCase() || '';
        valB = b.filename?.toLowerCase() || '';
      } else if (sortKey === 'uploadedAt') {
        valA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : null;
        valB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : null;
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
      return sortOrder === 'asc' ? comparison : comparison * -1;
    });
    return processed;
  }, [documents, filterQuery, sortKey, sortOrder]);

  // Memoized processedTemplates
  const processedTemplates = useMemo(() => {
    let processed = [...templates];
    if (filterQueryTemplates) {
      processed = processed.filter(tmpl => 
        tmpl.name?.toLowerCase().includes(filterQueryTemplates.toLowerCase()) ||
        tmpl.description?.toLowerCase().includes(filterQueryTemplates.toLowerCase()) ||
        tmpl.category?.toLowerCase().includes(filterQueryTemplates.toLowerCase())
      );
    }
    processed.sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;
      if (sortKeyTemplates === 'templateName') {
        valA = a.name?.toLowerCase() || '';
        valB = b.name?.toLowerCase() || '';
      } else if (sortKeyTemplates === 'templateCategory') {
        valA = a.category?.toLowerCase() || '';
        valB = b.category?.toLowerCase() || '';
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

  // Handlers
  const handleUploadComplete = (success: boolean) => {
    if (success) {
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => { setShowUploadModal(false); }, 1500);
    }
  };

  const handleDocumentSelected = useCallback((docId: string) => {
    setSelectedDocumentId(docId);
  }, []);

  const handleSelectTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleDocumentDeleted = () => {
    setSelectedDocumentId(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocumentId) return;
    const documentToDelete = documents.find(doc => doc.id === selectedDocumentId);
    if (!documentToDelete) return;
    if (window.confirm(`Are you sure you want to delete "${documentToDelete.filename}"?`)) {
      setIsLoading(true);
      try {
        const { error: deleteError } = await documentService.deleteDocument(selectedDocumentId);
        if (deleteError) throw deleteError;
        console.log(`Document deleted`);
        handleDocumentDeleted();
      } catch (err) {
        console.error("Error deleting document:", err);
        alert(`Failed to delete document.`);
        setError("Failed to delete document.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDownloadDocument = async () => {
    if (!selectedDocumentId) return;
    console.log('Download functionality TBD');
  };

  // New handler for deleting templates
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    
    const templateToDelete = templates.find(tmpl => tmpl.id === selectedTemplateId);
    if (!templateToDelete) return;

    if (window.confirm(`Are you sure you want to delete template "${templateToDelete.name}"? This action cannot be undone.`)) {
      setIsLoadingTemplates(true); // Use template loading state
      try {
        // --- This service function needs to be created --- 
        const { deleteTemplate } = await import('@/services/templateService'); 
        const { error: deleteError } = await deleteTemplate(selectedTemplateId);
        // -------------------------------------------------
        
        if (deleteError) throw deleteError;

        console.log(`Template "${templateToDelete.name}" deleted successfully.`);
        setSelectedTemplateId(null); // Clear selection
        // Refresh the list by filtering out the deleted one manually
        // Or trigger a re-fetch if preferred (less immediate)
        // setTemplates(prev => prev.filter(tmpl => tmpl.id !== selectedTemplateId)); 
        setRefreshTemplatesTrigger(prev => prev + 1); // Use specific trigger

      } catch (err) {
        console.error("Error deleting template:", err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to delete template: ${message}`);
        setErrorTemplates("Failed to delete template."); // Use template error state
      } finally {
        setIsLoadingTemplates(false);
      }
    }
  };

  // Handler for duplicating templates
  const handleDuplicateTemplate = async () => {
    if (!selectedTemplateId) return;

    const templateToDuplicate = templates.find(tmpl => tmpl.id === selectedTemplateId);
    if (!templateToDuplicate) return;

    if (window.confirm(`Are you sure you want to duplicate template "${templateToDuplicate.name}"?`)) {
      setIsLoadingTemplates(true);
      try {
        const { data: newTemplate, error: duplicateError } = await duplicateTemplateService(selectedTemplateId);
        
        if (duplicateError) throw duplicateError;

        console.log(`Template "${templateToDuplicate.name}" duplicated successfully as "${newTemplate?.name}".`);
        setRefreshTemplatesTrigger(prev => prev + 1); // Refresh list
        // Optionally select the new template after refresh
        // setSelectedTemplateId(newTemplate?.id || null); 

      } catch (err) {
        console.error("Error duplicating template:", err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to duplicate template: ${message}`);
        setErrorTemplates("Failed to duplicate template.");
      } finally {
        setIsLoadingTemplates(false);
      }
    }
  };

  // Sort toggle for Documents
  const handleSortToggle = useCallback(() => {
    setSortOrder(prevOrder => {
      if (prevOrder === 'desc') {
        setSortKey(prevKey => prevKey === 'filename' ? 'uploadedAt' : 'filename');
        return 'asc'; 
      } else {
        return 'desc';
      }
    });
  }, []);

  // Sort toggle for Templates
  const handleSortToggleTemplates = useCallback(() => {
    setSortOrderTemplates(prevOrder => {
      if (prevOrder === 'desc') {
        setSortKeyTemplates(prevKey => prevKey === 'templateName' ? 'templateCategory' : 'templateName');
        return 'asc'; 
      } else {
        return 'desc';
      }
    });
  }, []);
  
  // Derived state for selected objects
  const selectedDocument = useMemo(() => {
      return documents.find(doc => doc.id === selectedDocumentId) || null;
  }, [documents, selectedDocumentId]);

  const selectedTemplateObject = useMemo(() => {
      return templates.find(tmpl => tmpl.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Derived state for button titles
  const sortButtonTitle = useMemo(() => {
      const keyText = sortKey === 'filename' ? 'Name' : 'Date';
      const orderText = sortOrder === 'asc' ? 'Asc' : 'Desc';
      return `Sort by ${keyText} (${orderText})`;
  }, [sortKey, sortOrder]);

  const sortButtonTitleTemplates = useMemo(() => {
      const keyText = sortKeyTemplates === 'templateName' ? 'Name' : 'Category';
      const orderText = sortOrderTemplates === 'asc' ? 'Asc' : 'Desc';
      return `Sort by ${keyText} (${orderText})`;
  }, [sortKeyTemplates, sortOrderTemplates]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold text-text-primary">
          {activeTab === 'documents' ? 'Documents' : 'Templates'}
          {caseId && activeTab === 'documents' && 
             <span className='text-sm font-normal text-text-secondary ml-2'>(Case ID: {caseId})</span>
           }
        </h1>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start gap-4 flex-shrink-0">
        <div className="flex border-b border-gray-700">
          <button
            className={`px-4 pb-2 pt-1 font-medium ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button
            className={`px-4 pb-2 pt-1 font-medium ${activeTab === 'templates' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
        </div>
        <div className="flex gap-2 mt-1 sm:mt-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setAIDraftContext(activeTab === 'documents' ? 'document' : 'template');
              setShowAIDraftModal(true);
            }}
           >
             <Icons.Sparkles className="h-4 w-4 mr-2" />
             AI Draft
           </Button>
           {activeTab === 'documents' && (
             <Button
               variant="secondary"
               size="sm"
               onClick={() => setShowUploadModal(true)}
             >
               <Icons.Upload className="h-4 w-4 mr-2" />
               Upload
             </Button>
           )}
        </div>
      </div>

      {activeTab === 'documents' ? (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
          <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0 overflow-hidden flex flex-col border border-gray-700 rounded-lg bg-surface">
            <div className="flex items-center gap-2 p-2 border-b border-gray-700 flex-shrink-0">
              <Input
                type="text" placeholder="Filter Documents..." value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)} className="flex-grow text-xs h-8"
              />
              <div className="flex items-center border border-neutral-600 rounded-md flex-shrink-0">
                 <Button
                   variant="ghost" size="sm" onClick={handleSortToggle} 
                   className="px-2 py-1 h-8 text-xs rounded-r-none border-r border-neutral-600"
                   title={sortButtonTitle}
                 >
                   {sortOrder === 'asc' ? <Icons.ChevronUp className="h-4 w-4" /> : <Icons.ChevronDown className="h-4 w-4" />}
                 </Button>
                 <Button
                   variant={viewMode === 'list' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('list')} 
                   className="px-2 py-1 h-8 text-xs rounded-none border-r border-neutral-600" title="List View"
                 >
                   <Icons.List className="h-4 w-4" />
                 </Button>
                 <Button
                   variant={viewMode === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('grid')} 
                   className="px-2 py-1 h-8 text-xs rounded-l-none" title="Grid View"
                 >
                   <Icons.File className="h-4 w-4" />
                 </Button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {viewMode === 'list' ? (
                <DocumentList 
                  documents={processedDocuments} 
                  isLoading={isLoading} 
                  error={error} 
                  activeDocumentId={selectedDocumentId} 
                  onSelectDocument={handleDocumentSelected}
                />
              ) : (
                <DocumentGrid 
                  documents={processedDocuments} 
                  isLoading={isLoading} 
                  error={error} 
                  activeDocumentId={selectedDocumentId} 
                  onSelectDocument={handleDocumentSelected}
                />
              )}
            </div>
          </div>

          <div className="w-full md:w-3/5 lg:w-2/3 flex-grow overflow-auto bg-surface rounded-lg border border-gray-700">
             <div className="h-full flex flex-col">
               {selectedDocument ? (
                 <>
                   <div className="p-3 border-b border-gray-700 flex justify-between items-start flex-shrink-0">
                     <div>
                       <h2 className="text-base font-medium text-text-primary truncate" title={selectedDocument.filename}>
                         {selectedDocument.filename}
                       </h2>
                       <p className="text-xs text-text-secondary mt-1">
                         Uploaded: {selectedDocument.uploadedAt ? new Date(selectedDocument.uploadedAt).toLocaleDateString() : 'N/A'}
                       </p>
                     </div>
                     <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                       <Button variant="ghost" size="sm" onClick={handleDownloadDocument} title="Download" className="p-1 h-auto">
                         <Icons.ChevronDown className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="sm" onClick={handleDeleteDocument} title="Delete" 
                         className="p-1 h-auto text-red-500 hover:bg-red-500/10 hover:text-red-400" disabled={isLoading} >
                         <Icons.Trash className="h-4 w-4" />
                       </Button>
                     </div>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                     {selectedDocument.extractedText ? (
                       <div className="whitespace-pre-wrap text-text-primary text-sm">
                         {selectedDocument.extractedText}
                       </div>
                     ) : (
                       <div className="h-full flex items-center justify-center">
                         <div className="text-center">
                            <p className="text-text-secondary mb-2">
                              {isLoading ? <Spinner size="sm" /> : 
                               selectedDocument.processingStatus === 'pending' || selectedDocument.processingStatus === 'processing' ? 'Processing...' :
                               selectedDocument.processingStatus === 'failed' ? 'Extraction failed.' : 'No text extracted.'}
                           </p>
                         </div>
                       </div>
                     )}
                   </div>
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gradient-to-br from-surface to-surface-hover rounded-lg">
                   <Icons.FileText className="h-16 w-16 text-gray-600 mb-4 opacity-50" />
                   <h3 className="text-lg font-medium text-text-secondary">No Document Selected</h3>
                   <p className="text-text-tertiary mt-2 max-w-xs">
                     Select a document from the list on the left to view its details and available actions.
                   </p>
                 </div>
               )}
             </div>
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
          <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0 overflow-hidden flex flex-col border border-gray-700 rounded-lg bg-surface">
            <div className="flex items-center gap-2 p-2 border-b border-gray-700 flex-shrink-0">
              <Input
                type="text" placeholder="Filter Templates..." value={filterQueryTemplates}
                onChange={(e) => setFilterQueryTemplates(e.target.value)} className="flex-grow text-xs h-8"
              />
              <div className="flex items-center border border-neutral-600 rounded-md flex-shrink-0">
                <Button
                  variant="ghost" size="sm" onClick={handleSortToggleTemplates}
                  className="px-2 py-1 h-8 text-xs rounded-r-none border-r border-neutral-600"
                  title={sortButtonTitleTemplates}
                >
                  {sortOrderTemplates === 'asc' ? <Icons.ChevronUp className="h-4 w-4" /> : <Icons.ChevronDown className="h-4 w-4" />}
                </Button>
                <Button
                  variant={viewModeTemplates === 'list' ? "secondary" : "ghost"} size="sm" onClick={() => setViewModeTemplates('list')}
                  className="px-2 py-1 h-8 text-xs rounded-none border-r border-neutral-600" title="List View"
                >
                  <Icons.List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewModeTemplates === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setViewModeTemplates('grid')}
                  className="px-2 py-1 h-8 text-xs rounded-l-none" title="Grid View"
                >
                  <Icons.File className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {viewModeTemplates === 'list' ? (
                <TemplateList 
                  templates={processedTemplates} 
                  isLoading={isLoadingTemplates} 
                  error={errorTemplates}
                  activeTemplateId={selectedTemplateId} 
                  onSelectTemplate={handleSelectTemplate}
                />
              ) : (
                <TemplateGrid 
                  templates={processedTemplates} 
                  isLoading={isLoadingTemplates} 
                  error={errorTemplates}
                  activeTemplateId={selectedTemplateId} 
                  onSelectTemplate={handleSelectTemplate}
                />
              )}
            </div>
          </div>

          <div className="w-full md:w-3/5 lg:w-2/3 flex-grow overflow-auto bg-surface rounded-lg border border-gray-700">
             <div className="h-full flex flex-col">
                {selectedTemplateObject ? (
                  <>
                    <div className="p-3 border-b border-gray-700 flex justify-between items-start flex-shrink-0">
                       <div>
                         <h2 className="text-base font-medium text-text-primary truncate" title={selectedTemplateObject.name}>
                           {selectedTemplateObject.name}
                         </h2>
                         <p className="text-xs text-text-secondary mt-1 capitalize">
                           Category: {selectedTemplateObject.category || 'N/A'}
                         </p>
                       </div>
                       <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                         <Button 
                           variant="ghost" size="sm" 
                           onClick={() => navigate(`/templates/edit/${selectedTemplateObject.id}`)}
                           title="Edit Template"
                           className="p-1.5 h-auto"
                         >
                           <Icons.Edit className="h-4 w-4" />
                         </Button>
                         <Button 
                           variant="ghost" size="sm" 
                           onClick={handleDuplicateTemplate}
                           title="Duplicate Template"
                           className="p-1.5 h-auto"
                           disabled={isLoadingTemplates}
                         >
                           <Icons.Copy className="h-4 w-4" />
                         </Button>
                         <Button 
                           variant="ghost" size="sm" 
                           onClick={handleDeleteTemplate}
                           title="Delete Template"
                           className="p-1.5 h-auto text-red-500 hover:bg-red-500/10 hover:text-red-400"
                           disabled={isLoadingTemplates}
                         >
                           <Icons.Trash className="h-4 w-4" />
                         </Button>
                         <Button variant="primary" size="sm" 
                           onClick={() => { setShowDraftEditor(true); }} 
                           className="h-auto py-1.5 px-3 ml-2"
                           title="Use this template to start a new document"
                         >
                           Use Template
                         </Button>
                       </div>
                     </div>
                     <div className="flex-1 overflow-auto p-4 space-y-4">
                       <div>
                         <h4 className="text-sm font-medium text-text-secondary mb-1">Description</h4>
                         <p className="text-sm text-text-primary">
                           {selectedTemplateObject.description || <span className="italic text-text-tertiary">No description provided.</span>}
                         </p>
                       </div>

                       {selectedTemplateObject.variables && selectedTemplateObject.variables.length > 0 && (
                         <div>
                           <h4 className="text-sm font-medium text-text-secondary mb-2">Variables</h4>
                           <div className="flex flex-wrap gap-2">
                             {selectedTemplateObject.variables.map(variable => (
                               <span key={variable} className="inline-block bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 rounded-full">
                                 {`{{${variable}}}`}
                               </span>
                             ))}
                           </div>
                         </div>
                       )}

                       <div>
                         <h4 className="text-sm font-medium text-text-secondary mb-1">Content Preview</h4>
                         <pre className="text-xs p-3 bg-surface-hover rounded border border-gray-600 overflow-x-auto whitespace-pre-wrap break-words">
                           {selectedTemplateObject.content.substring(0, 1500)}{selectedTemplateObject.content.length > 1500 ? '\n\n[Preview truncated]' : ''}
                         </pre>
                       </div>
                     </div>
                  </>
                ) : (
                 <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gradient-to-br from-surface to-surface-hover rounded-lg">
                   <Icons.File className="h-16 w-16 text-gray-600 mb-4 opacity-50" />
                   <h3 className="text-lg font-medium text-text-secondary">No Template Selected</h3>
                   <p className="text-text-tertiary mt-2 max-w-xs">
                     Select a template from the list on the left to view its details or create a new document from it.
                   </p>
                 </div>
               )}
             </div> 
           </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl p-6 max-w-lg w-full relative border border-gray-700">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white">
              <Icons.Close className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-text-primary mb-4">Upload Documents</h2>
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      )}

      <AIDraftModal
        isOpen={showAIDraftModal}
        onClose={() => setShowAIDraftModal(false)}
        context={aiDraftContext}
        onExport={(content: string) => { console.log('AI Draft exported for potential use:', content); }}
      />

      {showDraftEditor && selectedTemplateObject && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col relative border border-gray-700">
             <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-lg font-medium text-text-primary">Create Document from Template: {selectedTemplateObject.name}</h2>
                <button 
                  onClick={() => setShowDraftEditor(false)} 
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                  title="Close Editor"
                >
                  <Icons.Close className="h-5 w-5" />
                </button>
             </div>
             <div className="flex-1 overflow-auto p-4">
               <DraftManagement 
                 documentContext={selectedTemplateObject.content}
                 caseId={caseId}
               />
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Documents;