import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DocumentEditor from '@/components/documents/DocumentEditor'; // Re-use the viewer component
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label'; // Assuming Label exists
import { Textarea } from '@/components/ui/Textarea'; // Assuming Textarea exists
import { Checkbox } from '@/components/ui/Checkbox'; // Assuming Checkbox exists
import { Spinner } from '@/components/ui/Spinner';
import { Icons } from '@/components/ui/Icons';
import { PostgrestError } from '@supabase/supabase-js';

// Define categories - should match the service/DB definition
const TEMPLATE_CATEGORIES: DocumentTemplate['category'][] = [
  'contract', 'letter', 'pleading', 'memorandum', 'agreement', 'other'
];

interface TemplateEditorProps {
  templateId: string | null; // null for creating a new template
  onSaveSuccess: () => void;
  onCancel: () => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateId, onSaveSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentTemplate['category']>('other');
  const [tags, setTags] = useState(''); // Simple comma-separated string for now
  const [isPublic, setIsPublic] = useState(false);
  const [initialContent, setInitialContent] = useState(''); // For Tiptap editor

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent, // Start with fetched or empty content
    editable: true, // Make editor editable
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none dark:prose-invert max-w-full border border-gray-300 dark:border-gray-600 rounded-md p-4 min-h-[300px]',
      },
    },
  });

  // Fetch existing template data if editing
  useEffect(() => {
    if (templateId) {
      setIsLoading(true);
      setError(null);
      templateService.getTemplateById(templateId)
        .then(({ data, error: fetchError }) => {
          if (fetchError) throw fetchError;
          if (data) {
            setName(data.name);
            setDescription(data.description || '');
            setCategory(data.category || 'other');
            setTags(data.tags?.join(', ') || '');
            setIsPublic(data.isPublic || false);
            setInitialContent(data.content || '');
            // Update editor content after state is set
            editor?.commands.setContent(data.content || '');
          }
        })
        .catch(err => {
          console.error("Error fetching template:", err);
          setError("Failed to load template data.");
        })
        .finally(() => setIsLoading(false));
    } else {
      // Reset fields for new template
      setName('');
      setDescription('');
      setCategory('other');
      setTags('');
      setIsPublic(false);
      setInitialContent('<p></p>'); // Start with empty paragraph
      editor?.commands.setContent('<p></p>');
    }
    // Reset editor content when templateId changes
    // Dependency array includes editor instance to re-run if it re-initializes
  }, [templateId, editor]);

  // Update editor content when initialContent is loaded asynchronously
  useEffect(() => {
      if (editor && initialContent !== editor.getHTML()) {
          editor.commands.setContent(initialContent);
      }
  }, [initialContent, editor]);

  const extractVariables = (htmlContent: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const matches = htmlContent.matchAll(regex);
    const variables = new Set<string>();
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  };

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);
    setError(null);

    const htmlContent = editor.getHTML();
    const variables = extractVariables(htmlContent);
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const templateData = {
      name,
      description,
      category,
      content: htmlContent,
      variables,
      tags: parsedTags,
      isPublic,
    };

    try {
      let result: { data: DocumentTemplate | null; error: PostgrestError | Error | null };
      if (templateId) {
        // Update existing template
        result = await templateService.updateTemplate(templateId, templateData);
      } else {
        // Create new template
        result = await templateService.createTemplate(templateData);
      }

      if (result.error) throw result.error;

      onSaveSuccess(); // Callback on success
    } catch (err) {
      console.error("Error saving template:", err);
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex justify-center items-center py-10">
          <Spinner size="large" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading Template Editor...</span>
        </div>
      );
  }

  return (
    <div className="template-editor">
      <h3 className="text-lg font-semibold mb-4">
        {templateId ? 'Edit Template' : 'Create New Template'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cease and Desist Letter"
            disabled={isSaving}
          />
        </div>

        <div>
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe what this template is for."
            rows={3}
            disabled={isSaving}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="template-category">Category</Label>
            <select
              id="template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentTemplate['category'])}
              className="block w-full mt-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 dark:bg-gray-700 dark:text-white"
              disabled={isSaving}
            >
              {TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
             <Label htmlFor="template-tags">Tags (comma-separated)</Label>
            <Input
              id="template-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., litigation, discovery, intellectual property"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="template-public"
            checked={isPublic}
            onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
            disabled={isSaving}
          />
          <Label htmlFor="template-public" className="mb-0">Make template public</Label>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <Label>Template Body</Label>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => editor?.chain().focus().insertContent('{{}}').run()} 
              disabled={!editor || isSaving}
              title="Insert Placeholder Variable"
            >
              <Icons.PlusCircle className="h-4 w-4 mr-1" />
              Insert Variable
            </Button>
          </div>
          {editor && <EditorContent editor={editor} className="template-editor-content" />}
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving || isLoading || !editor}>
          {isSaving ? <Spinner size="small" className="mr-2" /> : <Icons.Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Saving...' : (templateId ? 'Update Template' : 'Create Template')}
        </Button>
      </div>
    </div>
  );
};

export default TemplateEditor; 