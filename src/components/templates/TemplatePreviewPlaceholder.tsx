import React from 'react';
import { FileText } from 'lucide-react';

const TemplatePreviewPlaceholder: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 dark:text-gray-400">
      <FileText size={48} className="mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
        No Template Selected
      </h3>
      <p className="text-sm">
        Select a template from the list on the left to view or edit it, or create a new template using the buttons above.
      </p>
    </div>
  );
};

export default TemplatePreviewPlaceholder; 