import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Edit, Play } from 'lucide-react';
import ReadOnlyEditor from '@/components/documents/ReadOnlyEditor';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import { toast } from 'sonner';
import { templateCreateDraftModalTriggerAtom } from '@/atoms/templateAtoms';

const TemplateViewPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCaseId = useAtomValue(activeCaseIdAtom);
  const triggerCreateDraftModal = useSetAtom(
    templateCreateDraftModalTriggerAtom
  );

  useEffect(() => {
    if (!templateId) {
      setError('Template ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    templateService.getTemplateById(templateId)
      .then(({ data, error: fetchError }) => {
        if (fetchError) throw fetchError;
        if (!data) throw new Error('Template not found.');
        setTemplate(data);
      })
      .catch(err => {
        console.error("Error fetching template:", err);
        setError(err.message || "Failed to load template data.");
      })
      .finally(() => setIsLoading(false));

  }, [templateId]);

  const handleUseTemplate = () => {
      if (template) {
          if (!activeCaseId) {
              toast.error("Please select an active case before using a template.");
              return;
          }
          console.log(`Navigating to create document from template: ${template.id} for case: ${activeCaseId}`);
          navigate(`/edit/document/new?templateId=${template.id}&caseId=${activeCaseId}`);
      } else {
          console.error('Cannot use template, data not loaded.');
          toast.error('Template data is not loaded, cannot use template.');
      }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="p-4 md:p-6">
             <Button variant="outline" asChild className="mb-4">
                 <Link to="/templates"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Templates</Link>
             </Button>
            <div className="flex items-center space-x-2 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300">
                <AlertCircle className="h-6 w-6 flex-shrink-0" />
                <span className="text-lg">Error loading template: {error}</span>
            </div>
        </div>
    );
  }

  if (!template) {
    return (
        <div className="p-4 md:p-6">
             <Button variant="outline" asChild className="mb-4">
                 <Link to="/templates"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Templates</Link>
             </Button>
            <p className="text-center text-xl text-gray-500 dark:text-gray-400 py-10 italic">
                Template not found.
            </p>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
            <Button variant="outline" size="sm" asChild className="mb-2">
                <Link to="/templates"><ArrowLeft className="mr-1 h-3 w-3"/> Templates</Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{template.name}</h1>
            {template.description && <p className="mt-1 text-md text-gray-600 dark:text-gray-400">{template.description}</p>}
            <div className="mt-2 space-x-2">
                <span className="inline-block bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Category: {template.category}
                </span>
                {template.tags?.map(tag => (
                    <span key={tag} className="inline-block bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full px-3 py-1 text-xs font-semibold">
                        {tag}
                    </span>
                ))}
            </div>
        </div>
        <div className="flex space-x-2 flex-shrink-0 mt-1">
             <Button onClick={() => navigate(`/edit/template/${templateId}`)} size="sm" variant="outline" disabled={isLoading || !!error}>
                <Edit className="h-4 w-4 mr-1" />
                Edit Details
             </Button>
             <Button onClick={handleUseTemplate} size="sm" variant="default" disabled={isLoading || !!error || !activeCaseId} title={!activeCaseId ? "Select a case first" : "Use Template"}>
                 <Play className="h-4 w-4 mr-1" />
                 Use Template
             </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 shadow-sm rounded-lg border border-neutral-200 dark:border-gray-700 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-neutral-200 dark:border-gray-700 text-gray-800 dark:text-white">Template Content</h2>
        <div className="p-4">
           <ReadOnlyEditor content={template.content} />
        </div>
      </div>
    </div>
  );
};

export default TemplateViewPage; 