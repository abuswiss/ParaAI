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
import Breadcrumb from '../common/Breadcrumb'; // Import Breadcrumb
import { 
  activeEditorTypeAtom, 
  isNavCollapsedAtom
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

  // ... handleContentChange ...

  // ... handleVariableInsert ...

  return (
    <div className="flex flex-col h-full p-4 bg-background text-foreground">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 pb-3 border-b">
        <Breadcrumb 
          items={[
            { label: 'Templates', href: '/files' }, // Link back to file manager (templates view)
            { label: templateId ? name || 'Loading Template...' : 'New Template' },
          ]} 
          className="flex-grow mr-4"
        />
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || !isEditorDirty}>
            {isSaving ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Template
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      {isLoading ? (
        <div className="flex-grow flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex-grow flex items-center justify-center text-red-500">
          {error}
        </div>
      ) : (
        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {/* Left Column: Editor */}
          <div className="md:col-span-2 h-full overflow-hidden flex flex-col border rounded-md">
             <DocumentEditor
              ref={editorRef}
              initialContent={initialContent}
              onUpdate={handleContentChange}
              editable={true}
              className="flex-grow overflow-y-auto"
             />
          </div>

          {/* Right Column: Metadata */}
          <div className="md:col-span-1 h-full overflow-y-auto space-y-4 p-4 border rounded-md bg-muted/30">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">Template Details</h3>
             <div>
                <Label htmlFor="template-name">Name</Label>
                <Input 
                  id="template-name" 
                  value={name} 
                  onChange={(e) => { setName(e.target.value); setIsEditorDirty(true); }} 
                  disabled={isSaving}
                  required
                />
             </div>
             <div>
                <Label htmlFor="template-description">Description</Label>
                <Textarea 
                  id="template-description" 
                  value={description} 
                  onChange={(e) => { setDescription(e.target.value); setIsEditorDirty(true); }} 
                  disabled={isSaving}
                  rows={3}
                />
             </div>
              <div>
                <Label htmlFor="template-category">Category</Label>
                <select
                  id="template-category"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as DocumentTemplate['category']); setIsEditorDirty(true); }}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-background dark:bg-surface"
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
                  onChange={(e) => { setTags(e.target.value); setIsEditorDirty(true); }} 
                  placeholder="e.g., nda, consulting, agreement"
                  disabled={isSaving}
                />
             </div>
              {/* Placeholder for Variable Management */}
              {/* <div>
                  <Label>Variables</Label>
                  <Button variant="outline" size="sm" onClick={handleInsertVariable}>Add Variable</Button>
                  <ul>... list variables ...</ul>
              </div> */} 
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateEditor; 