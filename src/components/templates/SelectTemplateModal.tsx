import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal'; 
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService'; // Assuming this type exists
import { AlertCircle, FileText } from 'lucide-react';

interface SelectTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

const SelectTemplateModal: React.FC<SelectTemplateModalProps> = ({ 
  isOpen,
  onClose,
  onSelect
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      setTemplates([]); // Clear previous list
      templateService.getAvailableTemplates() 
        .then(({ data, error: fetchError }) => {
          if (fetchError) throw fetchError;
          setTemplates(data || []);
        })
        .catch(err => {
          console.error("Error fetching templates:", err);
          setError("Failed to load templates.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Template">
      <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2"> {/* Add max height and scroll */}
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Spinner size="lg" />
          </div>
        )}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!isLoading && !error && templates.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10 italic">
            No templates found.
          </p>
        )}
        {!isLoading && !error && templates.length > 0 && (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li key={template.id}>
                <button 
                  onClick={() => onSelect(template.id)}
                  className="w-full text-left p-3 rounded-md border border-neutral-200 dark:border-gray-700 hover:bg-neutral-100 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors duration-150 flex items-start space-x-3"
                >
                  <FileText className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                      <span className="font-medium text-gray-900 dark:text-white block">{template.name}</span>
                      {template.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{template.description}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
};

export default SelectTemplateModal; 