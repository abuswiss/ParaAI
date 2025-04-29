import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, caseDocumentsAtom, isCaseDocumentsLoadingAtom, caseDocumentsFetchErrorAtom, loadCaseDocumentsAtom } from '@/atoms/appAtoms';
import DocumentList from '@/components/documents/DocumentList';
import DocumentGrid from '@/components/documents/DocumentGrid';
import UploadModal from '@/components/documents/UploadModal';
import NewAIDraftModal from '@/components/documents/NewAIDraftModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, ArrowUpDown, Upload, Sparkles, PlusIcon, List, LayoutGrid } from 'lucide-react';

const PLACEHOLDER_SELECT_CASE = "Select a case to view documents.";
// const PLACEHOLDER_SELECT_DOCUMENT = "Select a document from the list to view its details."; // Removed as preview pane is gone
const PLACEHOLDER_NO_DOCUMENTS = "No documents found in this case.";

// Define types for sorting documents
type DocumentSortKey = 'filename' | 'uploadedAt' | 'contentType'; // Example keys
type SortOrder = 'asc' | 'desc';
// Define type for view mode
type ViewMode = 'list' | 'grid';

const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const documents = useAtomValue(caseDocumentsAtom);
  const isDocumentsLoading = useAtomValue(isCaseDocumentsLoadingAtom);
  const documentsError = useAtomValue(caseDocumentsFetchErrorAtom);
  const triggerLoadDocuments = useSetAtom(loadCaseDocumentsAtom);

  // State for filtering and sorting documents
  const [filterQueryDocuments, setFilterQueryDocuments] = useState('');
  const [sortKeyDocuments, setSortKeyDocuments] = useState<DocumentSortKey>('filename');
  const [sortOrderDocuments, setSortOrderDocuments] = useState<SortOrder>('asc');

  // State for view mode
  const [viewModeDocuments, setViewModeDocuments] = useState<ViewMode>('list');

  // State for modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAIDraftModalOpen, setIsAIDraftModalOpen] = useState(false);

  useEffect(() => {
    if (activeCaseId) {
      triggerLoadDocuments(activeCaseId);
    }
  }, [activeCaseId, triggerLoadDocuments]);

  // Handle selecting a document from the list/grid (navigate to viewer)
  const handleSelectDocument = useCallback((docId: string) => {
    navigate(`/view/document/${docId}`); // Navigate to the viewer page
  }, [navigate]); // Add navigate to dependency array

  // Get the ID of the document currently selected for viewing (REMOVED - viewer is now separate page)
  // const activeDocumentId = activeEditorItem?.type === 'document' ? activeEditorItem.id : null;
  const activeDocumentId = null; // Keep prop for list/grid but it's not used for viewer display here

  // --- Filtering and Sorting Logic for Documents ---
  const processedDocuments = useMemo(() => {
    let processed = [...(documents || [])]; // Use documents atom value

    // Filter
    if (filterQueryDocuments) {
      const query = filterQueryDocuments.toLowerCase();
      processed = processed.filter(doc => 
        doc.filename?.toLowerCase().includes(query) ||
        doc.contentType?.toLowerCase().includes(query)
        // Add more fields to filter if needed (e.g., tags, extracted text snippet?)
      );
    }

    // Sort
    processed.sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      switch (sortKeyDocuments) {
          case 'filename':
              valA = a.filename?.toLowerCase() || '';
              valB = b.filename?.toLowerCase() || '';
              break;
          case 'contentType':
              valA = a.contentType?.toLowerCase() || '';
              valB = b.contentType?.toLowerCase() || '';
              break;
          case 'uploadedAt':
              // Ensure uploadedAt is treated consistently (string -> Date -> number)
              valA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
              valB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
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

      return sortOrderDocuments === 'asc' ? comparison : comparison * -1;
    });

    return processed;
  }, [documents, filterQueryDocuments, sortKeyDocuments, sortOrderDocuments]);

  // Handler for sorting documents
  const handleSortDocuments = (key: DocumentSortKey) => {
      if (key === sortKeyDocuments) {
          setSortOrderDocuments(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKeyDocuments(key);
          setSortOrderDocuments('asc');
      }
  };

  // Upload Document handler (opens modal)
  const handleUploadDocument = () => {
    if (!activeCaseId) return;
    setIsUploadModalOpen(true);
  };

  // Handler for clicking "Create New Document" (navigates to editor)
  const handleCreateNewDocument = () => {
    if (!activeCaseId) return; // Need a case context
    navigate('/edit/document'); // Navigate to the new document editor page
  };

  // Handler for clicking "Create AI Document Draft"
  const handleCreateAIDocumentDraft = () => {
    if (!activeCaseId) return;
    setIsAIDraftModalOpen(true);
  };

  // Close handler for AI Draft modal 
  const handleAIDraftModalClose = () => {
      setIsAIDraftModalOpen(false);
      // Refresh might happen in onSuccess now
  };

   // Success handler for AI Draft modal
   const handleAIDraftSuccess = (newDraftId?: string) => { 
      setIsAIDraftModalOpen(false);
      console.log('AI Draft created:', newDraftId); 
      if(activeCaseId) triggerLoadDocuments(activeCaseId); // Refresh list on success
      // Navigate to edit the new draft if ID is returned
      if(newDraftId) {
         navigate(`/edit/document/${newDraftId}`);
      }
    };

  return (
    <div className="h-full flex flex-col bg-neutral-100 dark:bg-background">
      <div className="flex justify-between items-center flex-shrink-0 p-4 md:p-6 border-b border-neutral-200 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-text-primary">Documents</h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleUploadDocument} variant="outline" size="sm" disabled={!activeCaseId}> 
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
          <Button onClick={handleCreateAIDocumentDraft} variant="outline" size="sm" disabled={!activeCaseId}>
             <Sparkles className="h-4 w-4 mr-2" />
             Create AI Document Draft
          </Button>
          <Button onClick={handleCreateNewDocument} size="sm" disabled={!activeCaseId}>
             <PlusIcon className="h-4 w-4 mr-2" />
             Create New Document
          </Button>
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden p-4 md:p-6 pt-4">
        <div className="md:col-span-3 bg-white dark:bg-surface-darker shadow rounded-lg flex flex-col overflow-hidden border border-neutral-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-neutral-900 dark:text-text-primary">Case Documents</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  type="text"
                  placeholder="Filter documents..."
                  value={filterQueryDocuments}
                  onChange={(e) => setFilterQueryDocuments(e.target.value)}
                  className="pl-8 pr-2 py-1.5 text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={!activeCaseId}
                />
              </div>
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
                <Button 
                  variant={viewModeDocuments === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewModeDocuments('list')}
                  className="p-1.5 rounded-r-none border-r border-gray-300 dark:border-gray-600"
                  title="List View"
                  disabled={!activeCaseId}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewModeDocuments === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewModeDocuments('grid')}
                  className="p-1.5 rounded-l-none"
                  title="Grid View"
                  disabled={!activeCaseId}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => handleSortDocuments('filename')}
                title={`Sort by Filename (${sortKeyDocuments === 'filename' ? sortOrderDocuments : ' '})`}
                disabled={!activeCaseId}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!activeCaseId ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-neutral-500 dark:text-text-secondary text-center">{PLACEHOLDER_SELECT_CASE}</p>
              </div>
            ) : isDocumentsLoading ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-neutral-500 dark:text-text-secondary text-center">Loading documents...</p>
              </div>
            ) : documentsError ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-error dark:text-error text-center">Error loading documents.</p>
              </div>
            ) : processedDocuments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-neutral-500 dark:text-text-secondary text-center">{PLACEHOLDER_NO_DOCUMENTS}</p>
              </div>
            ) : viewModeDocuments === 'list' ? (
              <DocumentList
                documents={processedDocuments}
                isLoading={isDocumentsLoading}
                error={documentsError}
                activeDocumentId={activeDocumentId}
                onSelectDocument={handleSelectDocument}
              />
            ) : (
              <DocumentGrid
                documents={processedDocuments}
                isLoading={isDocumentsLoading}
                error={documentsError}
                activeDocumentId={activeDocumentId}
                onSelectDocument={handleSelectDocument}
              />
            )}
          </div>
        </div>
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      <NewAIDraftModal
        isOpen={isAIDraftModalOpen}
        onClose={handleAIDraftModalClose}
        onSuccess={handleAIDraftSuccess}
      />
    </div>
  );
};

export default DocumentsPage;