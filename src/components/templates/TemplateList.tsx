import React, { useState, useEffect } from 'react';
import { getAvailableTemplates, DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircle, Star, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Icons } from '@/components/ui/Icons';

interface TemplateListProps {
  templates: DocumentTemplate[];
  isLoading: boolean;
  error: string | null;
  activeTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  isLoading,
  error,
  activeTemplateId,
  onSelectTemplate,
}) => {
  const renderTemplateIcon = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'contract': return <Icons.FileText className="w-4 h-4 mr-2 flex-shrink-0 text-blue-400" />;
      case 'letter': return <Icons.Send className="w-4 h-4 mr-2 flex-shrink-0 text-green-400" />;
      case 'pleading': return <Icons.Gavel className="w-4 h-4 mr-2 flex-shrink-0 text-red-400" />;
      case 'agreement': return <Icons.FileText className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-400" />;
      case 'memorandum': return <Icons.Document className="w-4 h-4 mr-2 flex-shrink-0 text-purple-400" />;
      default: return <Icons.File className="w-4 h-4 mr-2 flex-shrink-0 text-text-tertiary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size="sm" />
        <span className="ml-2 text-xs text-neutral-500 dark:text-text-secondary">Loading...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-error dark:text-error px-2">Error: {error}</p>;
  }

  return (
    <div className="template-list-container flex-1 overflow-y-auto pt-1">
      {templates.length === 0 && (
        <p className="text-xs text-neutral-500 dark:text-text-secondary px-2 italic">
          No templates found.
        </p>
      )}
      {templates.length > 0 && (
        <ul className="space-y-1 px-1">
          {templates.map((tmpl) => (
            <li key={tmpl.id}>
              <button
                onClick={() => onSelectTemplate(tmpl.id)}
                className={`w-full flex items-center px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                  (activeTemplateId === tmpl.id)
                    ? 'bg-primary-light text-primary dark:bg-primary-light dark:text-primary'
                    : 'text-neutral-700 dark:text-text-secondary hover:bg-neutral-100 dark:hover:bg-surface-lighter'
                }`}
              >
                {renderTemplateIcon(tmpl.category)}
                <div className="flex-1 truncate">
                  <span className="font-medium" title={tmpl.name || 'Untitled Template'}>
                    {tmpl.name || 'Untitled Template'}
                  </span>
                  <span className="ml-2 text-text-tertiary capitalize text-[11px]">{tmpl.category}</span>
                  {tmpl.description && 
                    <p className="text-text-tertiary text-[11px] truncate mt-0.5" title={tmpl.description}>{tmpl.description}</p>
                  }
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TemplateList; 