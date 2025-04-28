import React, { useState, useEffect } from 'react';
import { DocumentTemplate, getTemplateById } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { AlertTriangle, Edit2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface TemplatePreviewProps {
  templateId: string;
  onEdit: (templateId: string) => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ templateId, onEdit }) => {
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read-only editor to display content
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-full focus:outline-none dark:prose-invert p-4 border border-transparent', // Read-only styling
      },
    },
  });

  useEffect(() => {
    if (templateId) {
      setIsLoading(true);
      setError(null);
      setTemplate(null);
      editor?.commands.setContent(''); // Clear previous content

      getTemplateById(templateId)
        .then(({ data, error: fetchError }) => {
          if (fetchError) throw fetchError;
          if (data) {
            setTemplate(data);
            editor?.commands.setContent(data.content || '<p><i>No content</i></p>');
          } else {
            throw new Error('Template not found.');
          }
        })
        .catch(err => {
          console.error("Error fetching template for preview:", err);
          setError("Failed to load template preview.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [templateId, editor]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="md" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading Preview...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Preview</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!template) {
    // This case might occur briefly or if ID is invalid but loading finished
    return <div className="p-6 text-center text-gray-500">Template data not available.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white truncate" title={template.name}>
          {template.name}
        </h2>
        <Button variant="outline" size="sm" onClick={() => onEdit(template.id)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{template.category}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</span>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {template.description || <span className="italic">No description provided.</span>}
          </p>
        </div>
        {template.tags && template.tags.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tags</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {template.tags.map(tag => (
                 <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-xs">
                   {tag}
                 </span>
              ))}
            </div>
          </div>
        )}
         <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase block mb-1">Content Preview</span>
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 min-h-[200px]">
             {editor && <EditorContent editor={editor} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview; 