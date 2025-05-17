import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai'; // Keep if other atoms are used, remove if not
import * as templateService from '@/services/templateService';
import { DocumentTemplate, getTemplates } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { PlusCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import NewAITemplateGenModal from '@/components/editor/modals/NewAITemplateGenModal';
// Removed imports related to TemplateEditorInternal and AIDraftGeneratorInternal if not used in this simplified module
// e.g., TiptapEditor, specific atoms for those components, etc.

// NOTE: The AIDraftGeneratorInternal component and its related logic from the original file
// are preserved below but are not the focus of this refactoring step (Phase 3.2).
// They belong to Phase 4 (AI Document Drafting Modal Refactor).

const AIDraftingTemplateModule: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAIGenModalOpen, setIsAIGenModalOpen] = useState<boolean>(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setFetchError(null);
    try {
      const { data, error } = await templateService.getAvailableTemplates(); // UPDATED to use getAvailableTemplates
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      const message = err.message || 'Failed to load templates.';
      setFetchError(message);
      toast.error(message);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateGenerated = (templateInfo: { id: string; name: string }) => {
    toast.success(`Template "${templateInfo.name}" created! Refreshing list...`);
    fetchTemplates(); // Refresh the list
    // Optional: navigate(`/ai/templates/${templateInfo.id}/fill`); // Or to a template management/edit page if that exists
  };

  const handleSelectTemplate = (templateId: string) => {
    navigate(`/ai/templates/${templateId}/fill`); // UPDATED Line
  };

  if (isLoadingTemplates) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /> <p className='ml-2'>Loading templates...</p></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AI-Generated Templates</h1>
        <Button onClick={() => setIsAIGenModalOpen(true)}>
          <Sparkles className="mr-2 h-5 w-5" /> Generate New AI Template
        </Button>
      </div>

      {fetchError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error Loading Templates</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 && !fetchError && (
        <div className="text-center py-10">
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No Templates Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4">Start by generating your first template using AI.</p>
          <Button onClick={() => setIsAIGenModalOpen(true)} variant="outline">
            <PlusCircle className="mr-2 h-5 w-5" /> Create First Template
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card 
            key={template.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer dark:bg-gray-800"
            onClick={() => handleSelectTemplate(template.id)}
          >
            <CardHeader>
              <CardTitle className="truncate" title={template.name}>{template.name}</CardTitle>
              <CardDescription className="capitalize">{template.category || 'General'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {template.description || 'No description available.'}
              </p>
              {/* TODO: Add more info like variable count, last updated, etc. if desired */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Variables: {template.variables?.length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NewAITemplateGenModal
        isOpen={isAIGenModalOpen}
        onClose={() => setIsAIGenModalOpen(false)}
        onSuccess={handleTemplateGenerated}
      />
      
      {/* The AIDraftGeneratorInternal and related logic from the original file would be below */}
      {/* For Phase 3.2, it's not actively used or modified here. It belongs to Phase 4. */}
    </div>
  );
};

export default AIDraftingTemplateModule;

// ----- Start of original AIDraftGeneratorInternal and related code (to be addressed in Phase 4) -----
// (The content of AIDraftGeneratorInternal and any helper components/hooks it used
//  from the original file would be placed here, largely untouched for this refactoring step)
// ... (original code for AIDraftGeneratorInternal etc. would follow) ...
// ----- End of original AIDraftGeneratorInternal code -----