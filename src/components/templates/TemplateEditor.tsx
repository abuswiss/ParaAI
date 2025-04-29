import React, { useState, useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai'; // Keep useSetAtom
import DocumentEditor, { DocumentEditorRef } from '@/components/documents/DocumentEditor';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { PostgrestError } from '@supabase/supabase-js';
import { Save } from 'lucide-react';
// Remove CreateVariableModal import
// import { Editor } from '@tiptap/react'; // Keep if DocumentEditor uses it, maybe not needed here
import { 
  activeEditorTypeAtom, 
  isNavCollapsedAtom
  // Remove other atoms
} from '@/atoms/appAtoms';

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
  // Keep standard template field state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentTemplate['category']>('other');
  const [tags, setTags] = useState('');
  const [initialContent, setInitialContent] = useState('');

  // Keep loading/saving/error state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  // Remove modal state

  // Keep ref
  const editorRef = useRef<DocumentEditorRef>(null);

  // Keep Atom Setters needed
  const setActiveEditorType = useSetAtom(activeEditorTypeAtom);
  const setIsNavCollapsed = useSetAtom(isNavCollapsedAtom);
  // Remove variable/modal atom setters/getters

  // Keep Effect to control layout state (nav collapse)
  useEffect(() => {
    setActiveEditorType('template');
    setIsNavCollapsed(false);
    return () => {
      setActiveEditorType(null);
    };
  }, [setActiveEditorType, setIsNavCollapsed]);

  // Keep Effect for fetching data
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
            setInitialContent(data.content || '');
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
      setInitialContent('<p></p>'); // Default content for new template
    }
  }, [templateId]);

  // --- REMOVE Variable Extraction Logic & Effects ---
  /*
  const extractVariablesFromEditor = ...
  const debouncedExtractVariables = ...
  useEffect(() => { // Editor update listener for variables
     ...
  }, ...);
  useEffect(() => { // Delete action listener
    ...
  }, ...);
  useEffect(() => { // Rename action listener
    ...
  }, ...);
  */

  // Keep handleSave, but simplify templateData
  const handleSave = async () => {
    const htmlContent = editorRef.current?.getContent() ?? '';
    if (!htmlContent && !templateId) {
      setError("Template body cannot be empty.");
      return;
    }
    
    setIsSaving(true);
    setError(null);

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const templateData = {
      name,
      description,
      category,
      content: htmlContent,
      variables: [],
      tags: parsedTags,
      isPublic: false,
    };

    try {
      let result: { data: DocumentTemplate | null; error: PostgrestError | Error | null };
      if (templateId) {
        result = await templateService.updateTemplate(templateId, templateData);
      } else {
        result = await templateService.createTemplate(templateData);
      }
      if (result.error) throw result.error;
      setIsEditorDirty(false);
      onSaveSuccess();
    } catch (err) {
      console.error("Error saving template:", err);
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- REMOVE handleInsertVariable --- 
  /*
  const handleInsertVariable = ...
  */

  if (isLoading) {
    return (
        <div className="flex justify-center items-center py-10">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading Template Editor...</span>
        </div>
      );
  }

  return (
    <div className="template-editor flex flex-col h-full">
      {/* Header part (non-scrolling) */}
      <div className="px-4 pt-4 flex-shrink-0">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
          {templateId ? 'Edit Template' : 'Create New Template'}
        </h3>
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-grow overflow-y-auto px-4 pb-4 space-y-4">
        <div>
          <Label id="label-template-name">Template Name</Label>
          <Input
            id="template-name"
            aria-labelledby="label-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cease and Desist Letter"
            disabled={isSaving}
            className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <Label id="label-template-description">Description</Label>
          <Textarea
            id="template-description"
            aria-labelledby="label-template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe what this template is for."
            rows={3}
            disabled={isSaving}
            className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label id="label-template-category">Category</Label>
            <select
              id="template-category"
              aria-labelledby="label-template-category"
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
            <Label id="label-template-tags">Tags (comma-separated)</Label>
            <Input
              id="template-tags"
              aria-labelledby="label-template-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., litigation, real estate, contract"
              disabled={isSaving}
              className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Editor Body Section (Button was removed) */}
        <div className="template-body-section flex flex-col flex-grow min-h-[400px]">
           <div className="flex justify-between items-center mb-1">
             <Label>Template Body</Label>
             {/* Button removed */}
           </div>
          <div className="flex-grow h-full border border-neutral-200 dark:border-gray-700 rounded-md overflow-hidden">
            <DocumentEditor
              ref={editorRef}
              initialContent={initialContent}
              // Pass simpler props now
              editorItem={{ type: 'template', id: templateId || 'new_template' }}
              showToolbar={true}
              isSaving={false} // These might need re-evaluation based on DocumentEditor needs
              saveStatus={'Idle'}
              isDirty={isEditorDirty}
              onSave={() => {}} // Or potentially trigger handleSave?
              onDirtyChange={setIsEditorDirty} 
              onSaveStatusChange={() => {}} 
              // Remove variable-specific props if any were passed
            />
          </div>
        </div>
      </div>
      
      {/* Footer buttons (non-scrolling) */}
      <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 flex-shrink-0">
         <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
         <Button onClick={handleSave} disabled={isSaving || isLoading || !isEditorDirty}>
           {isSaving ? <Spinner size="sm" className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
           {isSaving ? 'Saving...' : (templateId ? 'Update Template' : 'Create Template')}
         </Button>
      </div>
    </div>
  );
};

export default TemplateEditor; 