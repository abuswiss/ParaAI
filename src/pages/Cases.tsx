import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getUserCases, Case, deleteCase } from '../services/caseService';
import { createBlankDraft } from '../services/templateService';
import CaseForm from '../components/cases/CaseForm';
import { Button } from '../components/ui/Button';
import { Icons, FolderIcon, FileTextIcon } from '../components/ui/Icons';
import { Spinner } from '../components/ui/Spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import { useAtomValue, useSetAtom } from 'jotai';
import { activeCaseIdAtom, activeEditorItemAtom } from '../atoms/appAtoms';
import UploadModal from '../components/documents/UploadModal';
import NewAIDraftModal from '../components/documents/NewAIDraftModal';

const Cases: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<Case | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewAIDraftModalOpen, setIsNewAIDraftModalOpen] = useState(false);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const setActiveEditorItem = useSetAtom(activeEditorItemAtom);

  const fetchCases = async () => {
    if (!user) {
      console.log('No user found, cannot fetch cases');
      return;
    }
    
    console.log('Starting to fetch cases for user:', user.id);
    try {
      setLoading(true);
      
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Fetch cases timeout after 10 seconds')), 10000);
      });
      
      // Race the actual fetch against the timeout
      const result = await Promise.race([
        getUserCases(),
        timeoutPromise
      ]) as { data: any, error: any };
      
      const { data, error } = result;
      
      if (error) {
        console.error('Supabase returned an error:', error);
        throw error;
      }
      
      console.log('Received cases data:', data);
      if (data) {
        setCases(data);
      } else {
        console.log('No cases data returned, setting empty array');
        setCases([]);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
      // Even with error, set the cases to empty array to finish loading
      setCases([]);
      setError('Failed to load cases. Please try again later.');
    } finally {
      console.log('Finished fetching cases, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [user]);

  const handleEditClick = (caseItem: Case) => {
    setSelectedCaseForEdit(caseItem);
    setIsEditFormOpen(true);
  };

  const handleDeleteClick = async (caseItem: Case) => {
    if (window.confirm(`Are you sure you want to delete the case "${caseItem.name}"? This action cannot be undone.`)) {
      setLoadingAction(`delete-${caseItem.id}`);
      try {
        setError(null);
        const { success, error: deleteError } = await deleteCase(caseItem.id);
        if (!success || deleteError) {
          throw deleteError || new Error('Failed to delete case.');
        }
        fetchCases();
      } catch (err) {
        console.error('Error deleting case:', err);
        setError(err instanceof Error ? err.message : 'Could not delete case.');
      } finally {
        setLoadingAction(null);
      }
    }
  };

  const handleDraftCreated = (newDraftId: string) => {
    setActiveEditorItem({ id: newDraftId, type: 'draft' });
    if (activeCaseId) {
      navigate(`/cases/${activeCaseId}`); 
    } else {
      navigate('/dashboard');
    }
  };

  const handleNewBlankDocument = async () => {
    setLoadingAction('new-blank');
    setError(null);
    try {
      const { data: newDraft, error: createError } = await createBlankDraft(activeCaseId);
      if (createError || !newDraft) {
        throw createError || new Error('Failed to create blank draft.');
      }
      handleDraftCreated(newDraft.id);
    } catch (err) {
       console.error('Error creating blank document:', err);
       setError(err instanceof Error ? err.message : 'Could not create blank document.');
    } finally {
        setLoadingAction(null);
    }
  };

  const handleFormClose = (refresh?: boolean) => {
    setIsCreateFormOpen(false);
    setIsEditFormOpen(false);
    setSelectedCaseForEdit(null);
    if (refresh) {
      fetchCases();
    }
  };

  const handleUploadModalClose = (refresh?: boolean) => {
    setIsUploadModalOpen(false);
    setIsNewAIDraftModalOpen(false);
    if (refresh) {
      console.log("Upload complete, potential refresh needed (not implemented)");
    }
  };

  const handleAIDraftModalClose = () => {
    setIsNewAIDraftModalOpen(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Manage Cases</h1>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={!!loadingAction}>
              {loadingAction === 'new-blank' || loadingAction === 'new-ai' ? <Spinner size="sm" className="mr-2"/> : <Icons.Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsCreateFormOpen(true)} disabled={!!loadingAction}>
              <FolderIcon className="mr-2 h-4 w-4" />
              <span>New Case</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNewBlankDocument} disabled={!!loadingAction}>
              <FileTextIcon className="mr-2 h-4 w-4" />
              <span>New Blank Document</span>
              {loadingAction === 'new-blank' && <Spinner size="xs" className="ml-auto"/>}
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => setIsUploadModalOpen(true)} disabled={!!loadingAction}>
               <Icons.Upload className="mr-2 h-4 w-4" />
              <span>Upload Document(s)</span>
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => setIsNewAIDraftModalOpen(true)} disabled={!!loadingAction}>
               <Icons.Sparkles className="mr-2 h-4 w-4" />
              <span>New AI Draft</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">
          {error}
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-text-primary mb-2">No cases yet</h3>
          <p className="text-text-secondary mb-6">
            Create your first case to organize your legal documents and conversations.
          </p>
          <button 
            onClick={() => setIsCreateFormOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-medium py-2 px-6 rounded-md transition"
          >
            Create a New Case
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface rounded-lg border border-border shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Opposing Party</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Case Number</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary cursor-pointer" onClick={() => navigate(`/cases/${caseItem.id}`)}>{caseItem.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{caseItem.client_name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{caseItem.opposing_party || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{caseItem.case_number || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary capitalize">{caseItem.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(caseItem)} disabled={!!loadingAction}>
                      <Icons.Edit className="h-4 w-4" /> 
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-100/10 disabled:opacity-50" 
                        onClick={() => handleDeleteClick(caseItem)} 
                        disabled={loadingAction === `delete-${caseItem.id}` || !!loadingAction && loadingAction !== `delete-${caseItem.id}`}
                    >
                        {loadingAction === `delete-${caseItem.id}` ? <Spinner size="sm"/> : <Icons.Trash className="h-4 w-4" />}
                        <span className="sr-only">Delete</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Create Case Form Modal */}
      {isCreateFormOpen && (
        <CaseForm
          isOpen={isCreateFormOpen}
          onClose={handleFormClose}
        />
      )}

      {/* Edit Case Form Modal */}
      {isEditFormOpen && selectedCaseForEdit && (
        <CaseForm
          isOpen={isEditFormOpen}
          onClose={handleFormClose}
          caseData={selectedCaseForEdit}
        />
      )}

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={handleUploadModalClose} 
      />

      <NewAIDraftModal 
        isOpen={isNewAIDraftModalOpen} 
        onClose={handleAIDraftModalClose}
        onSuccess={handleDraftCreated}
      />
    </div>
  );
};

export default Cases;
