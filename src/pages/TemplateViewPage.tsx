import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTemplateById, DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Edit } from 'lucide-react';
// Placeholder import for BreadcrumbNav
// import BreadcrumbNav from '@/components/layout/BreadcrumbNav';
import BreadcrumbNav, { BreadcrumbItem } from '@/components/layout/BreadcrumbNav';
// Tiptap imports for read-only rendering
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const TemplateViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No template ID provided.');
      setLoading(false);
      return;
    }

    const fetchTemplateData = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await getTemplateById(id);
        if (error) throw error;
        if (!data) throw new Error('Template not found');
        setTemplate(data);
      } catch (err) {
        console.error('Error loading template for viewing:', err);
        setError('Failed to load template.');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplateData();
  }, [id]);

  const handleEditClick = () => {
    if (id) {
      navigate(`/edit/template/${id}`);
    }
  };

  // Set up a read-only Tiptap editor instance for rendering
  const editor = useEditor({
    editable: false,
    content: template?.content || '<p>Template content is empty or unavailable.</p>', // Load content
    extensions: [
      StarterKit,
      Placeholder.configure({
         placeholder: 'Template content is empty.', 
       }),
    ],
    editorProps: {
        attributes: {
          // Apply similar prose styling as the editor for consistency
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert max-w-full p-4',
        },
      },
  }, [template?.content]); // Reconfigure editor if template content changes

  // TODO: Refine rendering - maybe reuse parts of DocumentEditor or a dedicated TemplateRenderer?
  const renderContentView = () => {
    // Use the read-only Tiptap editor instance
    return <EditorContent editor={editor} />;
    
    /* // Old dangerous rendering
    if (!template?.content) return <p className="p-4 text-neutral-500">Template content is empty or unavailable.</p>;

    // Very basic rendering for now
    return (
      <div 
        className="prose prose-sm dark:prose-invert max-w-none p-4 whitespace-pre-wrap" 
        dangerouslySetInnerHTML={{ __html: template.content }}
      />
    );
    */
  }

  // Generate breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = template
    ? [
        { name: 'Templates', path: '/templates' },
        { name: template.name }, // Current item, no path
      ]
    : [{ name: 'Templates' }]; // Default if template hasn't loaded

  // Main render
  return (
    <div className="h-full flex flex-col bg-white dark:bg-surface-darker overflow-hidden">
      {/* Header Area */}
      <div className="flex-shrink-0 flex justify-between items-center p-3 border-b border-neutral-200 dark:border-gray-700">
        {/* Breadcrumb Placeholder */} 
        <div>
          <BreadcrumbNav items={breadcrumbItems} />
          {/* <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {loading ? 'Loading...' : template ? `Templates / ${template.name}` : 'Template Viewer'}
          </span> */}
        </div>
        {/* Action Buttons */} 
        <div className="flex items-center gap-2">
          <Button onClick={handleEditClick} size="sm" variant="outline" disabled={loading || !!error || !template}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {/* Add other actions like Use Template? */} 
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full text-center p-4">
            <p className="text-error dark:text-error">{error}</p>
          </div>
        ) : (
          renderContentView()
        )}
      </div>
    </div>
  );
};

export default TemplateViewPage; 