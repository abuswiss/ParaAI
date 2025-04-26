import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Case, getCaseById } from '../services/caseService';
import CaseDocuments from '../components/cases/CaseDocuments';

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCaseAndDocuments = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch case details
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

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/cases')}
        className="mb-4 text-primary hover:underline flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Cases
      </button>

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">{caseData.name}</h1>
        {caseData.description && (
          <p className="text-text-secondary mb-4">{caseData.description}</p>
        )}
        <div className="flex items-center text-sm text-gray-400">
          <span className="mr-4">Status: <span className="capitalize">{caseData.status}</span></span>
          <span>Created: {new Date(caseData.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Case Documents Component */}
      {id && <CaseDocuments caseId={id} />}

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Conversations</h2>
          <button className="bg-primary hover:bg-primary-hover text-white text-sm font-medium py-1.5 px-3 rounded-md transition flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Conversation
          </button>
        </div>

        <div className="bg-gray-700 rounded-lg p-6 text-center">
          <p className="text-text-secondary mb-2">No conversations for this case yet.</p>
          <p className="text-sm text-gray-400">Start a new conversation about this case.</p>
        </div>
      </div>
    </div>
  );
};

export default CaseDetail;
