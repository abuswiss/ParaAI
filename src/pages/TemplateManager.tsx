import React, { useState } from 'react';
import TemplateList from '@/components/templates/TemplateList';
import TemplateEditor from '@/components/templates/TemplateEditor';
import { Icons } from '@/components/ui/Icons';

const TemplateManager: React.FC = () => {
  // State to manage which view is active: list or editor
  // `null` templateId means show list, otherwise show editor for that ID (or null for new)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null | undefined>(undefined);

  const handleSelectTemplate = (templateId: string | null) => {
    // If templateId is null, it means "Create New"
    // If it's a string, it means "Edit Existing"
    setEditingTemplateId(templateId);
  };

  const handleBackToList = () => {
    setEditingTemplateId(undefined); // Set back to undefined to show the list
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 md:mb-6">
        {editingTemplateId === undefined ? 'Template Management' : (editingTemplateId === null ? 'Create New Template' : 'Edit Template')}
      </h1>
      {editingTemplateId !== undefined && (
         <button onClick={handleBackToList} className="text-sm text-primary dark:text-primary-light hover:underline mb-4 inline-flex items-center">
            <Icons.ChevronLeft className="h-4 w-4 mr-1" /> Back to Templates
          </button>
      )}
      <div className="flex-grow bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6 overflow-y-auto">
        {editingTemplateId === undefined ? (
          // Show the list view
          <TemplateList onSelectTemplate={handleSelectTemplate} />
        ) : (
          // Render the actual editor
          <TemplateEditor
            templateId={editingTemplateId}
            onSaveSuccess={handleBackToList}
            onCancel={handleBackToList}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateManager;