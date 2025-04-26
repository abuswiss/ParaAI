import React, { useState } from 'react';
import { createCase } from '../../services/caseService';

interface CaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated?: () => void;
}

const CaseForm: React.FC<CaseFormProps> = ({ isOpen, onClose, onCaseCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Case name is required');
      return;
    }
    
    try {
      console.log('Form submitted with name:', name);
      setLoading(true);
      setError(null);
      
      // Make sure to add a timeout to avoid UI hanging forever
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Case creation timed out after 15 seconds')), 15000);
      });
      
      // Race against timeout
      const result = await Promise.race([
        createCase(name, description),
        timeoutPromise
      ]) as { data: any, error: any };
      
      // Check for result
      if (result.error) {
        console.error('Error received from createCase:', result.error);
        throw result.error;
      }
      
      console.log('Case created successfully:', result.data);
      
      // Set success state
      setSuccess(true);
      setName('');
      setDescription('');
      
      // Even if there's an error with the onCaseCreated callback, we should still close the modal
      setTimeout(() => {
        try {
          if (onCaseCreated) {
            console.log('Calling onCaseCreated callback');
            onCaseCreated();
          }
        } catch (callbackErr) {
          console.error('Error in onCaseCreated callback:', callbackErr);
        } finally {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error('Error creating case:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create case. Please try again.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-black opacity-75"></div>
        </div>

        {/* Modal Content */}
        <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                  Create New Case
                </h3>
                
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="mb-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 p-2 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
                      Case Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter case name"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter case description"
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={onClose}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || success}
                      className={`font-medium py-2 px-4 rounded-md transition flex items-center ${success 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-primary hover:bg-primary-hover text-white'}`}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </>
                      ) : success ? (
                        <>
                          <svg className="-ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Created!
                        </>
                      ) : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseForm;
