import React from 'react';
import { DocumentTemplate } from '@/services/templateService';
import TemplateCard from './TemplateCard'; // Use TemplateCard
import { Spinner } from '@/components/ui/Spinner';

interface TemplateGridProps {
  templates: DocumentTemplate[]; // Use DocumentTemplate
  isLoading: boolean;
  error: string | null;
  activeTemplateId: string | null; // Use activeTemplateId
  onSelectTemplate: (templateId: string) => void; // Use templateId
}

const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates,
  isLoading,
  error,
  activeTemplateId,
  onSelectTemplate,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="large" />
        <span className="ml-3 text-text-secondary">Loading templates...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-error dark:text-error p-4">Error: {error}</p>;
  }

  if (templates.length === 0) {
    return (
      <p className="text-text-secondary p-4 italic">
        No templates to display in grid view.
      </p>
    );
  }

  return (
    // Adjust grid columns if needed for template cards
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4 p-4 overflow-y-auto">
      {templates.map((tmpl) => (
        <TemplateCard
          key={tmpl.id}
          template={tmpl}
          isSelected={activeTemplateId === tmpl.id}
          onSelect={onSelectTemplate}
        />
      ))}
    </div>
  );
};

export default TemplateGrid; 