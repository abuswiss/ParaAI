import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useAtomValue } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import * as templateService from '@/services/templateService';
import * as caseService from '@/services/caseService';
import { DocumentTemplate } from '@/services/templateService';
import { Case } from '@/services/caseService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';

interface TemplatePopulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
  onDraftCreated: (draftId: string) => void;
}

const TemplatePopulationModal: React.FC<TemplatePopulationModalProps> = ({ isOpen, onClose, templateId, onDraftCreated }) => {
  const activeCaseId = useAtomValue(activeCaseIdAtom);

  const [templateDetails, setTemplateDetails] = useState<DocumentTemplate | null>(null);
  const [prefilledValues, setPrefilledValues] = useState<Record<string, string>>({});
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [unfilledVariables, setUnfilledVariables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && templateId) {
      setIsLoading(true);
      setError(null);
      setTemplateDetails(null);
      setPrefilledValues({});
      setVariableValues({});
      setUnfilledVariables([]);

      const fetchData = async () => {
        try {
          const { data: templateData, error: templateError } = await templateService.getTemplateById(templateId);
          if (templateError) throw templateError;
          if (!templateData) throw new Error('Template not found.');
          setTemplateDetails(templateData);

          const regex = /\{\{\s*([\w\d_]+)\s*\}\}/g;
          const extractedVars = new Set<string>();
          let match;
          while ((match = regex.exec(templateData.content)) !== null) {
            extractedVars.add(match[1]);
          }
          const allTemplateVars = Array.from(extractedVars);

          let fetchedCaseFields: Record<string, string> = {};
          if (activeCaseId) {
            const { data: caseFields, error: caseFieldsError } = await caseService.getCaseFields(activeCaseId);
            if (caseFieldsError) {
              console.warn("Could not fetch case fields:", caseFieldsError.message);
            } else {
              fetchedCaseFields = caseFields || {};
            }
          }
          setPrefilledValues(fetchedCaseFields);

          const unfilled = allTemplateVars.filter(v => !fetchedCaseFields[v]);
          setUnfilledVariables(unfilled);

          const initialUserValues: Record<string, string> = {};
          unfilled.forEach(v => { initialUserValues[v] = '' });
          setVariableValues(initialUserValues);

        } catch (err) {
          console.error("Error loading template population data:", err);
          setError(err instanceof Error ? err.message : "Failed to load template data.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, templateId, activeCaseId]);

  const handleInputChange = (varName: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [varName]: value }));
  };

  const handleSubmit = async () => {
    if (!templateId || !templateDetails) return;

    setIsSubmitting(true);
    setError(null);

    const finalValues = { ...prefilledValues, ...variableValues };

    try {
      const { data: draftData, error: createError } = await templateService.createDraftFromTemplate(
        templateId,
        templateDetails.name,
        finalValues,
        activeCaseId
      );

      if (createError) throw createError;
      if (!draftData?.id) throw new Error('Failed to create draft: No ID returned.');

      onDraftCreated(draftData.id);
      onClose();

    } catch (err) {
      console.error("Error creating draft from template:", err);
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (varName: string) => {
    const commonProps = {
      id: varName,
      value: variableValues[varName] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleInputChange(varName, e.target.value),
      className: "mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100",
      required: true,
    };

    if (varName.toLowerCase().includes('address') || varName.toLowerCase().includes('description') || varName.toLowerCase().includes('notes')) {
      return <textarea {...commonProps} rows={3} />;
    }
    return <Input type="text" {...commonProps} />;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-700">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-text-primary mb-1 flex items-center"
                >
                  <Icons.FileText className="h-5 w-5 mr-2 text-primary" />
                  Populate Template: {templateDetails?.name || 'Loading...'}
                </Dialog.Title>
                <p className="text-sm text-text-secondary mb-4">
                  Fill in the required variables for this template. Fields may be pre-filled based on the active case.
                </p>

                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Spinner size="large" />
                  </div>
                ) : error ? (
                  <div className="text-red-400 bg-red-900/30 p-3 rounded-md">Error: {error}</div>
                ) : unfilledVariables.length === 0 && templateDetails ? (
                   <div className="text-green-400 bg-green-900/30 p-3 rounded-md mb-4">
                     All variables seem to be pre-filled from the active case.
                   </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {unfilledVariables.map((varName) => (
                        <div key={varName}>
                          <Label htmlFor={varName} className="block text-sm font-medium text-text-secondary capitalize">
                            {varName.replace(/_/g, ' ')}
                          </Label>
                          {renderInput(varName)}
                        </div>
                      ))}
                    </div>
                  </form>
                )}

                <div className="mt-6 flex justify-end space-x-3 border-t border-gray-700 pt-4">
                   {error && !isLoading && (
                     <p className="text-xs text-red-400 mr-auto self-center">Error: {error}</p>
                   )}
                   {!isLoading && (
                    <>
                     <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                       Cancel
                     </Button>
                     <Button 
                       type="submit" 
                       variant="primary" 
                       onClick={handleSubmit} 
                       disabled={isLoading || isSubmitting || (!templateDetails && !error)}
                     >
                       {isSubmitting ? <><Spinner size="small" className="mr-2" /> Creating...</> : 'Create Draft'}
                     </Button>
                    </>
                   )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TemplatePopulationModal; 