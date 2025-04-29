import React from 'react';
import { DocumentTemplate } from '@/services/templateService'; // Assuming this type exists
import DocumentEditor, { DocumentEditorRef } from '@/components/documents/DocumentEditor'; // Import the core editor
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { Save, X } from 'lucide-react';

// Define categories - copied from TemplateEditor for consistency
const TEMPLATE_CATEGORIES: DocumentTemplate['category'][] = [
  'contract', 'letter', 'pleading', 'memorandum', 'agreement', 'other'
];

interface EditorLayoutProps {
  type: 'document' | 'template';
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean; // Add isDirty state from parent
  saveStatus: string; // e.g., Idle, Saving, Saved, Error
  templateMetadata?: {
    name: string;
    description: string;
    category: DocumentTemplate['category'];
    tags: string;
  };
  onContentChange: (content: string) => void; // This might not be needed if DocumentEditor handles its state via ref
  onMetadataChange?: (field: keyof NonNullable<EditorLayoutProps['templateMetadata']>, value: string | DocumentTemplate['category']) => void;
  onSave: () => void;
  onCancel: () => void;
  editorRef: React.RefObject<DocumentEditorRef>; // Make ref required for getting content
}

const EditorLayout: React.FC<EditorLayoutProps> = ({
  type,
  content,
  isLoading,
  isSaving,
  isDirty,
  saveStatus,
  templateMetadata,
  onMetadataChange,
  onSave,
  onCancel,
  editorRef, // Receive the ref
}) => {

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="large" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading Editor...</span>
      </div>
    );
  }

  // DocumentEditor needs an editorItem prop, construct it here
  const editorItem = { type: type, id: 'current' }; // Use a generic ID or pass the real one if needed by DocumentEditor internals

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-darker rounded-lg shadow overflow-hidden border border-neutral-200 dark:border-gray-700">
      {/* Conditional Template Metadata Inputs */}
      {type === 'template' && templateMetadata && onMetadataChange && (
        <div className="p-4 border-b border-neutral-200 dark:border-gray-700 bg-neutral-50 dark:bg-surface">
          {/* Removed title, integrate into fields maybe? */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateMetadata.name}
                onChange={(e) => onMetadataChange('name', e.target.value)}
                placeholder="e.g., Cease and Desist Letter"
                disabled={isSaving}
                className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
             <div>
               <Label htmlFor="template-category">Category</Label>
               <select
                 id="template-category"
                 value={templateMetadata.category}
                 onChange={(e) => onMetadataChange('category', e.target.value as DocumentTemplate['category'])}
                 className="block w-full mt-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 dark:bg-gray-700 dark:text-white"
                 disabled={isSaving}
               >
                 {TEMPLATE_CATEGORIES.map(cat => (
                   <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                 ))}
               </select>
             </div>
            <div className="md:col-span-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={templateMetadata.description}
                onChange={(e) => onMetadataChange('description', e.target.value)}
                placeholder="Briefly describe what this template is for."
                rows={2} // Make it shorter
                disabled={isSaving}
                className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
             <div className="md:col-span-2">
               <Label htmlFor="template-tags">Tags (comma-separated)</Label>
               <Input
                 id="template-tags"
                 value={templateMetadata.tags}
                 onChange={(e) => onMetadataChange('tags', e.target.value)}
                 placeholder="e.g., litigation, discovery, ip"
                 disabled={isSaving}
                 className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
               />
            </div>
          </div>
        </div>
      )}

      {/* Core Document Editor - takes remaining space */}
      <div className="flex-grow overflow-hidden relative">
         {/* Render DocumentEditor. Note: DocumentEditor handles its own content state internally. 
             We pass the initialContent key to force re-initialization when the item changes. 
             We use the ref to get content on save. 
             Toolbar might be controlled within DocumentEditor itself based on its props.
             Assume showToolbar defaults to true or is handled internally. */}
         <DocumentEditor
            key={content} // Use content or a unique ID as key to force re-render on item change
            ref={editorRef} // Pass the ref
            initialContent={content} // Set initial content
            editorItem={editorItem} // Pass the constructed item
            // Removed onContentChange prop as DocumentEditor manages its state and we use ref to get it
          />
      </div>

       {/* Action Buttons Footer - Removed extra padding/border as editor fills space */}
       {/* The toolbar inside DocumentEditor will handle Save status display */}
       {/* This footer could be optional or integrated into the toolbar */}
       {/* Adding a simple cancel button here for now */}
        <div className="flex justify-end p-2 border-t border-neutral-200 dark:border-gray-700 flex-shrink-0 bg-neutral-50 dark:bg-surface">
         <Button onClick={onCancel} variant="outline" size="sm">
           <X className="h-4 w-4 mr-1" /> Close Editor
         </Button>
         {/* The save button is now inside DocumentEditor's toolbar */} 
       </div>
    </div>
  );
};

export default EditorLayout; 