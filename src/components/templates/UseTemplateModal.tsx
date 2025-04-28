import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton } from "@/components/ui/Modal";

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
}

// Helper function to extract variables (could be moved to utils)
const extractVariables = (htmlContent: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const matches = htmlContent.matchAll(regex);
    const variables = new Set<string>();
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
};

const UseTemplateModal: React.FC<UseTemplateModalProps> = ({ isOpen, onClose, templateId }) => {
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch template details when modal opens or templateId changes
  useEffect(() => {
    if (isOpen && templateId) {
      setIsLoading(true);
      setError(null);
      setTemplate(null);
      setVariables([]);
      setVariableValues({});

      templateService.getTemplateById(templateId)
        .then(({ data, error: fetchError }) => {
          if (fetchError) throw fetchError;
          if (data) {
            setTemplate(data);
            const extracted = extractVariables(data.content || '');
            setVariables(extracted);
            // Initialize variableValues state with empty strings
            const initialValues: Record<string, string> = {};
            extracted.forEach(v => { initialValues[v] = '' });
            setVariableValues(initialValues);
          } else {
            throw new Error('Template not found.');
          }
        })
        .catch(err => {
          console.error("Error fetching template for use:", err);
          setError("Failed to load template details.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, templateId]);

  const handleInputChange = (variableName: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [variableName]: value }));
  };

  const handleCreateDraft = async () => {
    if (!template) return;
    setIsCreatingDraft(true);
    setError(null);

    // Simple validation: Check if all variable fields have been filled
    const unfilledVariables = variables.filter(v => !variableValues[v]?.trim());
    if (unfilledVariables.length > 0) {
        setError(`Please fill in all variables: ${unfilledVariables.join(', ')}`);
        setIsCreatingDraft(false);
        return;
    }

    // Use a default name for the draft or maybe prompt the user?
    const draftName = `${template.name} - Draft`;

    try {
      const { data: newDraft, error: createError } = await templateService.createDraftFromTemplate(
        template.id,
        draftName,
        variableValues
        // Optionally pass caseId if available/needed
      );

      if (createError) throw createError;
      
      if (newDraft?.id) {
        console.log('Draft created:', newDraft.id);
        onClose(); // Close modal on success
        navigate(`/documents/drafts/${newDraft.id}`); // Navigate to the new draft
      } else {
          throw new Error('Failed to create draft: No ID returned.');
      }

    } catch (err) {
      console.error("Error creating draft from template:", err);
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setIsCreatingDraft(false);
    }
  };

  // If not open, render nothing (Dialog handles visibility)
  // if (!isOpen) return null; // No longer needed

  return (
    // Use the custom Modal components
    <Modal isOpen={isOpen} onClose={onClose} size="xl"> 
      <ModalOverlay />
      {/* Pass sizeClass to ModalContent */}
      <ModalContent sizeClass="sm:max-w-xl"> 
        <ModalHeader>
          Use Template: {template?.name || 'Loading...'}
          {/* Add close button to header */}
          <ModalCloseButton onClick={onClose} /> 
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto"> 
          {/* Body content remains the same: loading, error, form */}
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Spinner size="md" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Loading Template Details...</span>
            </div>
          )}
          {!isLoading && error && (
            <Alert variant="destructive" className="my-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && template && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{template.description}</p>
              {variables.length === 0 ? (
                 <p className="text-center text-gray-500 dark:text-gray-400 py-4">This template has no variables to fill.</p>
              ) : (
                variables.map((variable) => (
                  <div key={variable}>
                    <Label htmlFor={`var-${variable}`} className="capitalize mb-1 block">{variable.replace(/_/g, ' ')}</Label>
                    <Input
                      id={`var-${variable}`}
                      value={variableValues[variable] || ''}
                      onChange={(e) => handleInputChange(variable, e.target.value)}
                      placeholder={`Enter value for ${variable}`}
                      disabled={isCreatingDraft}
                      className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {/* Footer buttons remain the same */}
          <Button variant="outline" onClick={onClose} disabled={isCreatingDraft}>Cancel</Button>
          <Button 
            onClick={handleCreateDraft} 
            disabled={isLoading || isCreatingDraft || (variables.length === 0 && !template) || !template}
          >
            {isCreatingDraft ? <Spinner size="sm" className="mr-2" /> : null}
            {isCreatingDraft ? 'Creating Draft...' : 'Create Draft Document'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UseTemplateModal; 