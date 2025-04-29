import React from 'react';
import { DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Edit2, Play, FileText, Send, Gavel, File as FileIcon } from 'lucide-react'; // Import necessary icons
import { Icons } from '@/components/ui/Icons'; // For custom icons if needed

interface TemplateGridProps {
  templates: DocumentTemplate[];
  isLoading: boolean;
  error: string | null;
  activeTemplateId: string | null | undefined;
  onSelectTemplate: (templateId: string | null) => void;
  onUseTemplate: (templateId: string) => void;
  // Add other props like onDelete if needed
}

// Helper to get icon based on category (similar to TemplateList)
const renderTemplateIcon = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'contract': return <Icons.FileText className="w-6 h-6 mb-2 text-blue-400" />; // Slightly larger for grid
      case 'letter': return <Icons.Send className="w-6 h-6 mb-2 text-green-400" />;
      case 'pleading': return <Icons.Gavel className="w-6 h-6 mb-2 text-red-400" />;
      case 'agreement': return <Icons.FileText className="w-6 h-6 mb-2 text-yellow-400" />;
      case 'memorandum': return <Icons.Document className="w-6 h-6 mb-2 text-purple-400" />;
      default: return <FileIcon className="w-6 h-6 mb-2 text-text-tertiary" />;
    }
};

const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates,
  isLoading,
  error,
  activeTemplateId,
  onSelectTemplate,
  onUseTemplate,
}) => {
  if (isLoading) {
    // Loading state can be simpler for grid or reuse list's
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-error dark:text-error p-4">Error: {error}</p>;
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-text-secondary p-4 italic text-center">
        No templates found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1"> {/* Adjust grid columns as needed */}
      {templates.map((template) => (
        <div
          key={template.id}
          onClick={() => onSelectTemplate(template.id)} // Select on card click
          className={`
            bg-white dark:bg-surface-lighter rounded-lg shadow 
            border border-gray-200 dark:border-gray-700 
            p-4 flex flex-col 
            min-h-[220px] /* Add minimum height for consistency */
            transition-all duration-150 ease-in-out cursor-pointer
            hover:shadow-md hover:border-primary dark:hover:border-primary
            ${activeTemplateId === template.id ? 'border-primary dark:border-primary ring-2 ring-primary' : ''}
          `}
        >
          {/* Icon centered */}
          <div className="flex justify-center mb-2">
             {renderTemplateIcon(template.category)}
          </div>
          {/* Left-aligned Text Info */}
          <div className="text-left flex-grow mb-3">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1 truncate" title={template.name}>
              {template.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize">
              {template.category}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2" title={template.description}>
              {template.description || ''}
            </p>
          </div>
          {/* Actions at the bottom */}
          <div className="flex justify-center space-x-2 mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onUseTemplate(template.id); }}
              title="Use this template"
              className="px-2 py-1" // Make buttons smaller for grid
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onSelectTemplate(template.id); /* Or trigger edit directly */ }}
              title="Preview/Edit this template"
              className="px-2 py-1"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {/* Optional Delete Button */}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TemplateGrid; 