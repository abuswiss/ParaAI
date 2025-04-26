import React, { useState, useEffect } from 'react';
import { 
  DocumentDraft, 
  DocumentTemplate, 
  getUserDrafts,
  generateDraftWithAI,
  deleteDraft
} from '../../../services/templateService';
import TemplateSelector from './TemplateSelector';
import DraftEditor from './DraftEditor';

// Helper function to extract variables from template content
const extractVariables = (content: string): string[] => {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const matches = content.match(variableRegex) || [];
  
  // Remove duplicates and clean up the variable names
  return [...new Set(matches.map(match => {
    // Extract the variable name from {{variable}}
    return match.replace(/\{\{|\}\}/g, '').trim();
  }))];
};

// Helper function to count variables in template content
const countVariables = (content: string): number => {
  return extractVariables(content).length;
};

interface DraftManagementProps {
  caseId?: string;
  documentContext?: string;
}

const DraftManagement: React.FC<DraftManagementProps> = ({
  caseId,
  documentContext
}) => {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'ai'>('list');
  const [drafts, setDrafts] = useState<DocumentDraft[]>([]);
  // Templates will be loaded when needed
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<DocumentDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load drafts when component mounts
  useEffect(() => {
    loadDrafts();
  }, [caseId]);
  
  // Load drafts from the service
  const loadDrafts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await getUserDrafts(caseId);
      
      if (error) throw error;
      
      setDrafts(data || []);
    } catch (err) {
      console.error('Error loading drafts:', err);
      setError('Failed to load drafts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle template selection
  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setView('create');
  };
  
  // Handle AI draft generation
  const handleGenerateWithAI = async () => {
    if (!aiPrompt) return;
    
    setAiGenerating(true);
    setError(null);
    
    try {
      const { data, error } = await generateDraftWithAI(
        aiPrompt,
        documentContext,
        aiCategory || undefined
      );
      
      if (error) throw error;
      
      if (data) {
        // Create a new draft from the AI-generated content
        const draftName = aiPrompt.split('.')[0].slice(0, 30) + '...';
        
        const newDraft: Omit<DocumentDraft, 'id' | 'createdAt' | 'updatedAt'> = {
          name: draftName,
          content: data,
          caseId: caseId,
        };
        
        // In a real implementation, we would save this draft to the database
        // For now, we'll just create a mock draft
        const mockDraft: DocumentDraft = {
          ...newDraft,
          id: `draft-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setDrafts(prev => [mockDraft, ...prev]);
        setSelectedDraft(mockDraft);
        setView('edit');
      }
    } catch (err) {
      console.error('Error generating draft with AI:', err);
      setError('Failed to generate draft. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };
  
  // Draft creation handler implemented in TemplateSelector component
  
  // Handle draft deletion
  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    
    setIsLoading(true);
    
    try {
      const { success, error } = await deleteDraft(draftId);
      
      if (error) throw error;
      
      if (success) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch (err) {
      console.error('Error deleting draft:', err);
      setError('Failed to delete draft. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter drafts by search term
  const filteredDrafts = drafts.filter(draft => 
    draft.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render the main component
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text-primary">Document Drafts</h1>
          
          {view === 'list' && (
            <div className="flex space-x-2">
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
              >
                New from Template
              </button>
              <button
                onClick={() => setView('ai')}
                className="px-4 py-2 bg-gray-800 text-text-primary rounded hover:bg-gray-700 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                AI Draft
              </button>
            </div>
          )}
          
          {view !== 'list' && (
            <button
              onClick={() => {
                setView('list');
                setSelectedTemplate(null);
                setSelectedDraft(null);
                setAiPrompt('');
              }}
              className="px-4 py-2 bg-gray-800 text-text-primary rounded hover:bg-gray-700"
            >
              Back to List
            </button>
          )}
        </div>
        
        {view === 'list' && (
          <div className="mt-4">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search drafts..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </div>
      
      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {/* List view */}
        {!isLoading && view === 'list' && (
          <>
            {filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-text-primary mb-2">No Drafts Found</h3>
                <p className="text-text-secondary max-w-md mb-6">
                  Create a new document draft from a template or let the AI generate a draft based on your requirements.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setView('create')}
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
                  >
                    New from Template
                  </button>
                  <button
                    onClick={() => setView('ai')}
                    className="px-4 py-2 bg-gray-800 text-text-primary rounded hover:bg-gray-700"
                  >
                    AI Draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDrafts.map(draft => (
                  <div 
                    key={draft.id}
                    className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-primary transition-all duration-200"
                  >
                    <div className="p-4">
                      <h3 className="font-medium text-text-primary mb-1 truncate">{draft.name}</h3>
                      <p className="text-sm text-text-secondary mb-3">
                        Last updated: {new Date(draft.updatedAt).toLocaleDateString()}
                      </p>
                      <div className="text-xs text-gray-400 line-clamp-3 mb-4">
                        {draft.content.substring(0, 150)}...
                      </div>
                      <div className="flex justify-between">
                        <button
                          onClick={() => {
                            setSelectedDraft(draft);
                            setView('edit');
                          }}
                          className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-hover"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="px-3 py-1 bg-gray-700 text-gray-400 text-sm rounded hover:bg-gray-600 hover:text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Template selection view */}
        {view === 'create' && !selectedTemplate && (
          <TemplateSelector onSelectTemplate={handleSelectTemplate} />
        )}
        
        {/* New draft from template view */}
        {view === 'create' && selectedTemplate && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-lg font-medium text-text-primary mb-2">{selectedTemplate.name}</h2>
            <p className="text-sm text-text-secondary mb-4">
              This template has {countVariables(selectedTemplate.content)} customizable variables.
              {caseId && <span className="text-primary ml-1">Variables will be auto-filled from case data when available.</span>}
            </p>
            
            <div className="mb-6">
              <h3 className="text-md font-medium text-text-primary mb-3">Template Variables</h3>
              
              {extractVariables(selectedTemplate.content).map((variable: string, index: number) => (
                <div key={index} className="mb-3">
                  <label className="block text-sm text-text-secondary mb-1">{variable}</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
                    placeholder={caseId ? `Auto-filled from case data if available` : `Enter ${variable}`}
                  />
                </div>
              ))}
            </div>
              
              <button
                onClick={() => {
                  // Create a draft with the template and case information
                  const mockDraft: DocumentDraft = {
                    id: `draft-${Date.now()}`,
                    name: `Draft from ${selectedTemplate.name}`,
                    templateId: selectedTemplate.id,
                    content: selectedTemplate.content,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    caseId: caseId // Associate with the case if available
                  };
                  
                  setDrafts(prev => [mockDraft, ...prev]);
                  setSelectedDraft(mockDraft);
                  setView('edit');
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover"
              >
                Create Draft
              </button>
          </div>
        )}
        
        {/* Edit draft view */}
        {view === 'edit' && selectedDraft && (
          <DraftEditor 
            draft={selectedDraft}
            caseId={selectedDraft.caseId || caseId} 
            onSave={(updatedDraft) => {
              setDrafts(prev => prev.map(d => d.id === updatedDraft.id ? updatedDraft : d));
              setView('list');
            }}
            onCancel={() => {
              setSelectedDraft(null);
              setView('list');
            }}
          />
        )}
        
        {/* AI draft generation view */}
        {view === 'ai' && (
          <div className="bg-gray-900 rounded-lg p-4">
            <h2 className="text-lg font-medium text-text-primary mb-1">Generate Document with AI</h2>
            <p className="text-sm text-text-secondary mb-4">
              Describe what you need and the AI will generate a draft document
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Document Type</label>
                <select
                  value={aiCategory}
                  onChange={e => setAiCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">Select a document type...</option>
                  <option value="contract">Contract</option>
                  <option value="letter">Legal Letter</option>
                  <option value="pleading">Pleading</option>
                  <option value="memorandum">Legal Memorandum</option>
                  <option value="agreement">Agreement</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">Document Requirements</label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="w-full h-40 bg-gray-800 border border-gray-700 rounded px-4 py-3 text-text-primary focus:outline-none focus:border-primary"
                  placeholder="Describe what you need in the document. Be specific about parties, terms, conditions, etc."
                />
              </div>
              
              {documentContext && (
                <div className="p-3 bg-gray-800 border border-gray-700 rounded">
                  <p className="text-sm text-primary mb-1">Using Document Context</p>
                  <p className="text-xs text-text-secondary">
                    The AI will reference information from the current document as context.
                  </p>
                </div>
              )}
              
              <button
                onClick={handleGenerateWithAI}
                disabled={!aiPrompt || aiGenerating}
                className="w-full px-4 py-3 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center"
              >
                {aiGenerating ? (
                  <>
                    <div className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Generating Document...
                  </>
                ) : (
                  <>Generate Document</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftManagement;
