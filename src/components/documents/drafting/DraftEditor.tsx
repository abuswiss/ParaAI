import React, { useState, useEffect } from 'react';
import { 
  DocumentDraft, 
  DocumentTemplate, 
  updateDraft, 
  getCaseFields 
} from '../../../services/templateService';

interface DraftEditorProps {
  draft: DocumentDraft;
  template?: DocumentTemplate;
  onSave?: (draft: DocumentDraft) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  caseId?: string;
}

const DraftEditor: React.FC<DraftEditorProps> = ({
  draft,
  template,
  onSave,
  onCancel,
  readOnly = false,
  caseId
}) => {
  const [content, setContent] = useState(draft.content);
  const [name, setName] = useState(draft.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [caseVariables, setCaseVariables] = useState<Record<string, string>>({});
  const [isLoadingCaseVariables, setIsLoadingCaseVariables] = useState(false);
  
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
          const possibleValue = extractVariableValue(draft.content, template.content, variable);
          initialValues[variable] = possibleValue || '';
        } else {
          initialValues[variable] = '';
        }
      });
      
      setVariableValues(initialValues);
    }
  }, [template, draft]);
  
  // Handle variable change
  const handleVariableChange = (variable: string, value: string) => {
    setVariableValues(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Load case variables if a case ID is provided
  useEffect(() => {
    const loadCaseVariables = async () => {
      if (!caseId) return;
      
      setIsLoadingCaseVariables(true);
      try {
        const { data, error } = await getCaseFields(caseId);
        
        if (error) throw error;
        if (data) {
          setCaseVariables(data);
          
          // If we have a template, auto-fill any matching variables
          if (template && template.variables.length > 0) {
            setVariableValues(prev => {
              const updated = { ...prev };
              
              // For each template variable, check if we have a matching case field
              template.variables.forEach(variable => {
                // Try direct match or with case_ prefix
                if (data[variable]) {
                  updated[variable] = data[variable];
                } else if (data[`case_${variable}`]) {
                  updated[variable] = data[`case_${variable}`];
                }
              });
              
              return updated;
            });
          }
        }
      } catch (err) {
        console.error('Error loading case variables:', err);
      } finally {
        setIsLoadingCaseVariables(false);
      }
    };
    
    loadCaseVariables();
  }, [caseId, template]);
  
  // Extract the value a variable was replaced with by comparing template and draft content
  const extractVariableValue = (draftContent: string, templateContent: string, variableName: string): string | null => {
    // Find where in the template this variable appears and what surrounding context it has
    const placeholder = `{{${variableName}}}`;
    const placeholderRegex = new RegExp(escapeRegExp(placeholder), 'g');
    
    // Find all instances of this placeholder in the template
    const placeholderMatches: RegExpExecArray[] = [];
    let match;
    while ((match = placeholderRegex.exec(templateContent)) !== null) {
      placeholderMatches.push(match);
    }
    
    if (placeholderMatches.length === 0) {
      return null; // Placeholder not found in template
    }
    
    // For each placeholder occurrence, try to find what it was replaced with
    for (const placeholderMatch of placeholderMatches) {
      const placeholderIndex = placeholderMatch.index;
      
      // Get context before and after the placeholder (up to 50 chars each side)
      const contextBefore = getContext(templateContent, placeholderIndex - 50, placeholderIndex);
      const contextAfter = getContext(templateContent, placeholderIndex + placeholder.length, placeholderIndex + placeholder.length + 50);
      
      // If we have context on both sides, use it to locate the replacement
      if (contextBefore && contextAfter) {
        // Create a regex that looks for anything between the contexts
        const contextRegex = new RegExp(`${escapeRegExp(contextBefore)}(.*?)${escapeRegExp(contextAfter)}`, 's');
        const draftMatch = contextRegex.exec(draftContent);
        
        if (draftMatch && draftMatch[1]) {
          // We found what's between these contexts in the draft
          return draftMatch[1];
        }
      }
      // If we only have context on one side, try a simpler approach
      else if (contextBefore) {
        const afterIndex = draftContent.indexOf(contextBefore) + contextBefore.length;
        if (afterIndex >= contextBefore.length) {
          // Take up to 100 chars after this context as a guess
          const possibleValue = draftContent.substring(afterIndex, afterIndex + 100);
          // If there's contextAfter from the original, trim at that point
          if (contextAfter && possibleValue.includes(contextAfter)) {
            return possibleValue.substring(0, possibleValue.indexOf(contextAfter));
          }
          return possibleValue;
        }
      } 
      else if (contextAfter) {
        const beforeIndex = draftContent.indexOf(contextAfter);
        if (beforeIndex > 0) {
          // Take up to 100 chars before this context as a guess
          const startIndex = Math.max(0, beforeIndex - 100);
          return draftContent.substring(startIndex, beforeIndex);
        }
      }
    }
    
    // Fallback: check for variable name hint
    // Sometimes variables are replaced with values that contain hints like [firstName: John]
    const hintRegex = new RegExp(`\\[${variableName}:\\s*([^\\]]+)\\]`, 'i');
    const hintMatch = draftContent.match(hintRegex);
    if (hintMatch && hintMatch[1]) {
      return hintMatch[1].trim();
    }
    
    return null; // Couldn't determine the replacement
  };
  
  // Helper to escape special regex characters
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // Helper to get context around a position, handling bounds
  const getContext = (text: string, start: number, end: number): string => {
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(text.length, end);
    
    if (safeStart >= safeEnd) return '';
    
    return text.substring(safeStart, safeEnd);
  };
  
  // Apply variable replacements to the content
  const applyVariableReplacements = () => {
    if (!template) return content;
    
    let newContent = template.content;
    
    for (const [variable, value] of Object.entries(variableValues)) {
      if (value) {
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
        newContent = newContent.replace(regex, value);
      }
    }
    
    return newContent;
  };
  
  // Handle adding a case variable to the editor
  const handleAddCaseVariable = (variableName: string) => {
    // Find which template variable this should be assigned to
    const matchingTemplateVar = template?.variables.find(v => 
      v === variableName || `case_${v}` === variableName
    );
    
    if (matchingTemplateVar) {
      // If we found a matching template variable, set its value
      handleVariableChange(matchingTemplateVar, caseVariables[variableName]);
    } else {
      // Otherwise, insert this variable directly at the cursor position
      // This is for direct insertion into the text editor (for future enhancement)
      // For now, we'll just show an alert
      alert(`Variable ${variableName} = ${caseVariables[variableName]}\n\nTo use this variable, update your template to include {{${variableName}}}.`);
    }
  };
  
  // Handle save
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const { success, error } = await updateDraft(draft.id, {
        name,
        content: applyVariableReplacements()
      });
      
      if (!success) throw error || new Error('Failed to save draft');
      
      const updatedDraft: DocumentDraft = {
        ...draft,
        name,
        content: applyVariableReplacements(),
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
                  className="px-3 py-1 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center space-x-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>{showVariablePanel ? 'Hide' : 'Show'} Variables</span>
                  {caseId && (
                    <span className="ml-1 text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full">
                      Case Context Available
                    </span>
                  )}
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
        <div className="p-4 bg-gray-800 rounded-lg overflow-y-auto" style={{ maxHeight: '300px' }}>
          {isLoadingCaseVariables ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500"></div>
            </div>
          ) : template && template.variables.length > 0 ? (
            <div className="space-y-4">
              {template.variables.map(variable => {
                // Check if this variable has a matching case variable
                const hasCaseMatch = 
                  caseVariables[variable] !== undefined || 
                  caseVariables[`case_${variable}`] !== undefined;
                
                return (
                  <div key={variable} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-300">
                        {variable}
                      </label>
                      {hasCaseMatch && (
                        <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded-full">
                          Auto-filled from case
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={variableValues[variable] || ''}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      placeholder={`Enter value for ${variable}`}
                    />
                  </div>
                );
              })}
              
              {/* Case variables section */}
              {caseId && Object.keys(caseVariables).length > 0 && (
                <div className="mt-8 border-t border-gray-700 pt-4">
                  <h4 className="font-medium text-gray-300 mb-2">Available Case Variables</h4>
                  <p className="text-sm text-gray-400 mb-4">These case variables are available for use in your template:</p>
                  
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                    {Object.entries(caseVariables).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-1 px-2 rounded bg-gray-700 hover:bg-gray-600 cursor-pointer"
                           onClick={() => handleAddCaseVariable(key)}
                      >
                        <span className="text-sm font-mono text-gray-300">{key}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[150px]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400">No variables found in this template.</p>
          )}
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