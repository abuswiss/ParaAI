import React, { useState, useEffect } from 'react';
import { DocumentDraft, DocumentTemplate, updateDraft } from '../../../services/templateService';

interface DraftEditorProps {
  draft: DocumentDraft;
  template?: DocumentTemplate;
  onSave?: (draft: DocumentDraft) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

const DraftEditor: React.FC<DraftEditorProps> = ({
  draft,
  template,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const [content, setContent] = useState(draft.content);
  const [name, setName] = useState(draft.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  
  // Initialize variable values from the template if available
  useEffect(() => {
    if (template && template.variables.length > 0) {
      const initialValues: Record<string, string> = {};
      
      // Extract current values from the draft content
      template.variables.forEach(variable => {
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
        const matches = draft.content.match(regex);
        
        if (!matches) {
          // If the variable placeholder isn't in the content, 
          // it might have been replaced already
          // Try to determine what it was replaced with
          const placeholder = `{{${variable}}}`;
          const possibleValue = extractVariableValue(draft.content, placeholder, variable);
          initialValues[variable] = possibleValue || '';
        } else {
          initialValues[variable] = '';
        }
      });
      
      setVariableValues(initialValues);
    }
  }, [template, draft]);
  
  // Extract the value a variable was replaced with
  const extractVariableValue = (_content: string, _placeholder: string, _variable: string): string | null => {
    // This is a simplified approach - in a real application, you would use a more
    // robust method to determine what a placeholder was replaced with
    
    // Placeholder logic would go here
    return null;
  };
  
  // Apply variables to the content
  const applyVariables = () => {
    if (!template) return;
    
    let updatedContent = template.content;
    
    Object.entries(variableValues).forEach(([variable, value]) => {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
      updatedContent = updatedContent.replace(regex, value || `[${variable}]`);
    });
    
    setContent(updatedContent);
  };
  
  // Handle save
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const { success, error } = await updateDraft(draft.id, {
        name,
        content
      });
      
      if (!success) throw error || new Error('Failed to save draft');
      
      const updatedDraft: DocumentDraft = {
        ...draft,
        name,
        content,
        updatedAt: new Date().toISOString()
      };
      
      if (onSave) onSave(updatedDraft);
    } catch (err) {
      console.error('Error saving draft:', err);
      setError('Failed to save draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="bg-gray-900 rounded-lg">
      {/* Header with actions */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-text-primary">
            {readOnly ? 'View Document' : 'Edit Document'}
          </h2>
          <p className="text-sm text-text-secondary">
            {template ? `Based on: ${template.name}` : 'Custom document'}
          </p>
        </div>
        
        <div className="flex space-x-2">
          {!readOnly && (
            <>
              {template && (
                <button
                  onClick={() => setShowVariablePanel(!showVariablePanel)}
                  className="px-4 py-2 bg-gray-800 text-text-primary rounded hover:bg-gray-700 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Variables
                </button>
              )}
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover flex items-center disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </>
          )}
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-800 text-text-primary rounded hover:bg-gray-700"
            >
              {readOnly ? 'Back' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
      
      {/* Variable panel */}
      {showVariablePanel && template && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h3 className="text-sm font-medium text-text-primary mb-3">Template Variables</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {template.variables.map(variable => (
              <div key={variable} className="flex flex-col">
                <label className="text-xs text-text-secondary mb-1">{variable}</label>
                <input
                  type="text"
                  value={variableValues[variable] || ''}
                  onChange={e => setVariableValues({...variableValues, [variable]: e.target.value})}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                  placeholder={`Enter ${variable}...`}
                />
              </div>
            ))}
          </div>
          
          <div className="mt-3 flex justify-end">
            <button
              onClick={applyVariables}
              className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-hover"
            >
              Apply Variables
            </button>
          </div>
        </div>
      )}
      
      {/* Document title */}
      <div className="p-4 border-b border-gray-700">
        <label className="block text-sm text-text-secondary mb-1">Document Title</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={readOnly}
          className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-text-primary 
            ${readOnly ? 'cursor-not-allowed opacity-70' : 'focus:outline-none focus:border-primary'}`}
          placeholder="Enter document title..."
        />
      </div>
      
      {/* Document content editor */}
      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          disabled={readOnly}
          className={`w-full h-96 bg-gray-800 border border-gray-700 rounded px-4 py-3 text-text-primary font-mono text-sm 
            ${readOnly ? 'cursor-not-allowed opacity-70' : 'focus:outline-none focus:border-primary'}`}
          placeholder="Enter document content..."
        />
      </div>
    </div>
  );
};

export default DraftEditor;
