import React, { useState, useEffect } from 'react';
import TemplateList from '@/components/templates/TemplateList';
import TemplateEditor from '@/components/templates/TemplateEditor';
import { Icons } from '@/components/ui/Icons';
import { getAvailableTemplates, DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';

const TemplateManager: React.FC = () => {
  // State for editor view
  const [editingTemplateId, setEditingTemplateId] = useState<string | null | undefined>(undefined);

  // State for template data
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [errorTemplates, setErrorTemplates] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for re-fetching

  // Fetch templates when component mounts or refreshTrigger changes
  useEffect(() => {
    setIsLoadingTemplates(true);
    setErrorTemplates(null);
    getAvailableTemplates()
      .then(({ data, error }) => {
        if (error) throw error;
        setTemplates(data || []);
      })
      .catch(err => {
        console.error("Error fetching templates:", err);
        setErrorTemplates("Failed to load templates.");
      })
      .finally(() => setIsLoadingTemplates(false));
  }, [refreshTrigger]);

  const handleSelectTemplate = (templateId: string | null) => {
    setEditingTemplateId(templateId);
  };

  const handleBackToList = (needsRefresh = false) => {
    setEditingTemplateId(undefined); // Set back to undefined to show the list
    if (needsRefresh) {
        setRefreshTrigger(prev => prev + 1); // Trigger refresh if save was successful
    }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          {editingTemplateId === undefined ? 'Template Management' : (editingTemplateId === null ? 'Create New Template' : 'Edit Template')}
        </h1>
        {editingTemplateId === undefined ? (
            <Button onClick={() => handleSelectTemplate(null)} size="sm">
                 <Icons.Plus className="h-4 w-4 mr-2" />
                 Create New Template
            </Button>
        ) : (
            <Button onClick={() => handleBackToList()} variant="outline" size="sm">
                <Icons.ChevronLeft className="h-4 w-4 mr-1" /> Back to List
            </Button>
        )}
      </div>
      
      <div className="flex-grow bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6 overflow-y-auto">
        {editingTemplateId === undefined ? (
          <TemplateList 
            templates={templates}
            isLoading={isLoadingTemplates}
            error={errorTemplates}
            activeTemplateId={null}
            onSelectTemplate={handleSelectTemplate} 
          />
        ) : (
          <TemplateEditor
            templateId={editingTemplateId}
            onSaveSuccess={() => handleBackToList(true)}
            onCancel={() => handleBackToList(false)}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateManager;