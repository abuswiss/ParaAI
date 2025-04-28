import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Case, getCaseById } from '../services/caseService';
import { createConversationSafely } from '../lib/secureDataClient';
import CaseDocuments from '../components/cases/CaseDocuments';
import { Button } from '../components/ui/Button';
import { Icons } from '../components/ui/Icons';
import { Spinner } from '../components/ui/Spinner';
import CaseForm from '../components/cases/CaseForm';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  useEffect(() => {
    const fetchCaseAndDocuments = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const caseResponse = await getCaseById(id);
        if (caseResponse.error) {
          throw caseResponse.error;
        }
        
        if (!caseResponse.data) {
          throw new Error('Case not found');
        }
        
        setCaseData(caseResponse.data);
      } catch (err) {
        console.error('Error fetching case details:', err);
        setError('Failed to load case details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCaseAndDocuments();
  }, [id]);

  const handleNewConversation = async () => {
    if (!id) return;
    setCreatingConversation(true);
    try {
      const { data: newConversation, error: createError } = await createConversationSafely(undefined, id);
      if (createError || !newConversation) {
        throw createError || new Error('Failed to create conversation');
      }
      navigate(`/chat/${newConversation.id}`);
    } catch (err) {
      console.error('Error creating new conversation:', err);
      setError('Could not start a new conversation.');
    } finally {
      setCreatingConversation(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="p-6">
        <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-md">
          {error || 'Case not found'}
        </div>
        <button
          onClick={() => navigate('/cases')}
          className="mt-4 text-primary hover:underline flex items-center"
        >
          <Icons.ChevronLeft className="h-4 w-4 mr-1" />
          Back to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={() => navigate('/cases')} className="mb-0">
          <Icons.ChevronLeft className="h-4 w-4 mr-1" />
          Back to Cases
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setIsEditFormOpen(true)}>
          <Icons.Edit className="h-4 w-4 mr-1" />
          Edit Case
        </Button>
      </div>

      <div className="bg-surface rounded-lg p-6 border border-border">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">{caseData.name}</h1>
        {caseData.description && (
          <p className="text-text-secondary mb-4 text-sm">{caseData.description}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="font-medium text-text-secondary">Client:</span> {caseData.client_name || 'N/A'}</div>
          <div><span className="font-medium text-text-secondary">Opposing Party:</span> {caseData.opposing_party || 'N/A'}</div>
          <div><span className="font-medium text-text-secondary">Case Number:</span> {caseData.case_number || 'N/A'}</div>
          <div><span className="font-medium text-text-secondary">Court:</span> {caseData.court || 'N/A'}</div>
          <div><span className="font-medium text-text-secondary">Status:</span> <span className="capitalize">{caseData.status}</span></div>
          <div><span className="font-medium text-text-secondary">Created:</span> {new Date(caseData.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-6 border border-border">
        {id && <CaseDocuments caseId={id} />}
      </div>

      <div className="bg-surface rounded-lg p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Conversations</h2>
          <Button onClick={handleNewConversation} disabled={creatingConversation} size="sm">
            {creatingConversation ? <Spinner size="sm" className="mr-2"/> : <Icons.Plus className="h-4 w-4 mr-1" />}
            New Conversation
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-6 text-center border border-dashed border-border">
          <p className="text-text-secondary mb-2">No conversations for this case yet.</p>
          <p className="text-sm text-muted-foreground">Start a new conversation about this case.</p>
        </div>
      </div>

      {caseData && (
        <CaseForm 
          isOpen={isEditFormOpen} 
          onClose={() => setIsEditFormOpen(false)} 
          caseData={caseData} 
        />
      )}
    </div>
  );
};

export default CaseDetail;
