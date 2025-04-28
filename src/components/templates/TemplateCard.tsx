import React from 'react';
import { DocumentTemplate } from '@/services/templateService';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/Icons';

interface TemplateCardProps {
  template: DocumentTemplate;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, isSelected, onSelect }) => {
  // Use a generic icon for templates for now
  const IconComponent = Icons.FileText; 

  return (
    <button
      onClick={() => onSelect(template.id)}
      className={cn(
        'group relative flex flex-col justify-between w-full p-3 rounded-lg border transition-colors duration-150 ease-in-out overflow-hidden text-left h-36', // Slightly taller than DocumentCard
        'bg-surface hover:bg-surface-hover',
        isSelected 
          ? 'border-primary ring-1 ring-primary' 
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
      )}
      title={`${template.name}${template.description ? ` - ${template.description}` : ''}`}
    >
      {/* Top section: Icon */}
      <div className="flex-shrink-0">
        <IconComponent 
          className={cn(
            "h-6 w-6",
            isSelected ? "text-primary" : "text-text-secondary group-hover:text-text-primary"
          )} 
        />
      </div>

      {/* Bottom section: Text */}
      <div className="mt-2 flex flex-col justify-end flex-grow min-h-0">
        <h3 
          className={cn(
            "text-sm font-medium truncate mb-1",
            isSelected ? "text-primary" : "text-text-primary group-hover:text-text-primary"
          )}
        >
          {template.name || 'Untitled Template'}
        </h3>
        <p className="text-xs text-text-secondary capitalize">
          {template.category || 'Uncategorized'}
        </p>
        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
          {template.description || 'No description'}
        </p>
      </div>
    </button>
  );
};

export default TemplateCard; 