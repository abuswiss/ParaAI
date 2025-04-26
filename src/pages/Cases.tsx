import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getUserCases, Case } from '../services/caseService';
import CaseForm from '../components/cases/CaseForm';

// Using the Case interface imported from caseService

const Cases: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchCases = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await getUserCases();
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setCases(data);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError('Failed to load cases. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [user]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">My Cases</h1>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white font-medium py-2 px-4 rounded-md transition flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Case
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-medium py-2 px-6 rounded-md transition"
          >
            Create a New Case
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <div 
              key={caseItem.id} 
              className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:bg-gray-700 transition"
              onClick={() => navigate(`/cases/${caseItem.id}`)}
            >
              <h3 className="text-xl font-semibold text-text-primary mb-2">{caseItem.name}</h3>
              <p className="text-text-secondary mb-4 line-clamp-2">{caseItem.description || 'No description'}</p>
              <div className="text-sm text-gray-400">
                Last updated: {new Date(caseItem.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Case Form Modal */}
      <CaseForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)}
        onCaseCreated={fetchCases}
      />
    </div>
  );
};

export default Cases;
