import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai'; // Import useSetAtom
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService'; // Assuming type exists
import { useActiveCaseId } from '@/hooks/useActiveCaseId'; // Assuming hook exists
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { DocumentEditorRef } from '@/components/documents/DocumentEditor'; // Import ref type
import { toast } from 'sonner'; // Assuming toast notifications are set up
import BreadcrumbNav, { BreadcrumbItem } from '@/components/layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import DocumentEditor from '@/components/documents/DocumentEditor'; // Import DocumentEditor directly
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  isNavCollapsedAtom, 
  activeEditorTypeAtom, 
  EditorType // Import type
} from '@/atoms/appAtoms'; // Import layout atoms

const EditPage: React.FC = () => {
  const { type, id } = useParams<{ type: 'document' | 'template', id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get user from auth context
  const activeCaseId = useActiveCaseId();
  const editorRef = useRef<DocumentEditorRef>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'Idle' | 'Saving' | 'Saved' | 'Error'>('Idle');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [templateMetadata, setTemplateMetadata] = useState<{
    name: string;
    description: string;
    category: DocumentTemplate['category'];
    tags: string;
  }>({ name: '', description: '', category: 'other', tags: '' });

  // --- Atom Setters --- 
  const setIsNavCollapsed = useSetAtom(isNavCollapsedAtom);
  const setActiveEditorType = useSetAtom(activeEditorTypeAtom);

  // Determine if it's a new item
  const isNew = id === undefined || id === 'new'; // Consider 'new' explicitly if used

  // --- Effect to control layout state --- 
  useEffect(() => {
    if (type) {
      // On mount: collapse nav, set editor type
      setIsNavCollapsed(true);
      setActiveEditorType(type as EditorType); // Type assertion might be needed

      // On unmount: reset editor type
      return () => {
        setActiveEditorType(null);
      };
    } else {
      // Handle case where type is somehow missing (shouldn't happen with route setup)
      setActiveEditorType(null);
    }
  }, [type, setIsNavCollapsed, setActiveEditorType]); // Add setters to dependency array

  useEffect(() => {
    setIsLoading(true);
    setSaveStatus('Idle');
    setIsDirty(false);

    const loadData = async () => {
      try {
        if (!type) throw new Error('Editor type is required');

        if (isNew) {
          // Set default content for new items
          setContent('<p></p>');
          if (type === 'template') {
             setTemplateMetadata({ name: '', description: '', category: 'other', tags: '' });
          }
        } else {
          // Fetch existing data
          if (type === 'document') {
            if (!id) throw new Error('Document ID is required');
            // Fetch document using the service
            const { data, error } = await documentService.getDocumentById(id);
            if (error) throw error; // Let the catch block handle it
            if (!data) throw new Error('Document not found.'); // Should be handled by service, but double check
            setContent(data.extractedText || '<p></p>'); // Use extractedText for content
          } else if (type === 'template') {
            if (!id) throw new Error('Template ID is required');
            const { data, error } = await templateService.getTemplateById(id);
            if (error) throw error;
            if (data) {
              setContent(data.content || '<p></p>');
              setTemplateMetadata({
                name: data.name || '',
                description: data.description || '',
                category: data.category || 'other',
                tags: data.tags?.join(', ') || '',
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading editor data:", error);
        toast.error(`Failed to load ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSaveStatus('Error');
        // Maybe navigate back or show an error state?
        // navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [type, id, isNew]);

  // Handler for editor content changes (passed down to DocumentEditor -> onUpdate)
  const handleDirtyChange = useCallback((dirty: boolean) => {
      setIsDirty(dirty);
      if(dirty) {
          setSaveStatus('Idle'); // Reset save status when changes are made
      }
  }, []);

  const handleMetadataChange = useCallback((field: keyof typeof templateMetadata, value: string) => {
    setTemplateMetadata(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveStatus('Idle');
  }, []);

  const handleSave = async () => {
    if (!type || !isDirty || !user) { // Ensure user exists
        if (!user) toast.error('Authentication error. Cannot save.');
        return;
    }

    setIsSaving(true);
    setSaveStatus('Saving');

    // Use the ref to get the latest content from the editor
    const currentContent = editorRef.current?.getContent() ?? content;

    try {
      let newId: string | undefined = undefined;
      if (type === 'document') {
          if (!activeCaseId) throw new Error('Cannot save document without an active case.');
          const docData = { content: currentContent }; // Update content field name if needed
          if (isNew) {
              // Call the createDocument service
              const { data, error } = await documentService.createDocument(user.id, activeCaseId, {
                  content: currentContent,
                  // filename: 'Optional filename' // Add filename if needed
              });
              if (error) throw error;
              if (!data?.id) throw new Error('Create document did not return an ID.');
              newId = data.id;
              toast.info('Creating new document...') // Inform user
          } else {
              if (!id) throw new Error('Document ID is required for update');
              // Call the updateDocument service
              const { success, error } = await documentService.updateDocument(id, {
                  extractedText: currentContent // Use extractedText based on service function
              });
              if (error || !success) throw error || new Error('Update document failed.');
          }
      } else if (type === 'template') {
          const variables = extractVariables(currentContent);
          const parsedTags = templateMetadata.tags.split(',').map(t => t.trim()).filter(Boolean);
          const templateData = {
            ...templateMetadata,
            content: currentContent,
            variables,
            tags: parsedTags,
            isPublic: false, // Or remove if not needed
          };
          if (isNew) {
            const { data, error } = await templateService.createTemplate(templateData);
            if (error) throw error;
            if (!data?.id) throw new Error('Create template did not return an ID.');
            newId = data.id;
          } else {
            if (!id) throw new Error('Template ID is required for update');
            const { error } = await templateService.updateTemplate(id, templateData);
            if (error) throw error;
          }
      }

      setIsDirty(false);
      setSaveStatus('Saved');
      toast.success(`${type === 'template' ? 'Template' : 'Document'} saved successfully!`);

      // If it was a new item, update the URL to reflect the new ID without full page reload
      if (isNew && newId) {
          navigate(`/edit/${type}/${newId}`, { replace: true });
      } else {
         // Optional: Trigger a refresh if staying on the page? Data should be up-to-date.
         // Consider maybe just updating a timestamp state to show recent save? 
      }

    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      setSaveStatus('Error');
      toast.error(`Failed to save ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to extract variables, move to utils?
  const extractVariables = (htmlContent: string): string[] => {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const matches = htmlContent.matchAll(regex);
    const variables = new Set<string>();
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  };

  const handleCancel = () => {
    // TODO: Use a styled modal confirmation if dirty
    if (isDirty) {
       if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
         return;
       }
    }
    navigate(type === 'template' ? '/templates' : '/documents'); // Navigate back to respective lists
  };

  // --- Generate Breadcrumb Items ---
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    if (!type) return [];

    const base = type === 'document' 
      ? { name: 'Documents', path: '/documents' } 
      : { name: 'Templates', path: '/templates' };

    let itemName = 'New ';
    let itemPath = undefined;
    let isEditing = false;

    if (!isNew && id) {
      if (type === 'document') {
        // In a real app, you might fetch the document name here or pass it via state
        // For now, we just use the ID or a placeholder
        itemName = `Document ${id.substring(0, 6)}...`; 
        itemPath = `/view/document/${id}`; // Link back to the viewer
      } else if (type === 'template') {
        itemName = templateMetadata.name || `Template ${id.substring(0,6)}...`; 
        itemPath = `/view/template/${id}`; // Link back to the viewer
      }
      isEditing = true;
    } else {
      itemName += type === 'document' ? 'Document' : 'Template';
    }

    const items: BreadcrumbItem[] = [base];
    if (itemPath) {
        items.push({ name: itemName, path: itemPath }); // Add link to item view
        items.push({ name: 'Edit' }); // Add Edit indicator
    } else {
        items.push({ name: itemName }); // Just add the item name (e.g., New Document)
    }
    
    return items;
    
  }, [type, id, isNew, templateMetadata.name]);
  

  // Determine if it's a potentially generating AI template
  const isEmptyTemplate = type === 'template' && (!content || content.trim() === '<p></p>');

  if (!type) {
    return <div className="p-4 text-error">Error: Editor type (document or template) missing.</div>; // Improved error message
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar with breadcrumbs, metadata inputs, etc. */}
      <div className="flex-shrink-0 p-3 border-b border-neutral-200 dark:border-gray-700 flex items-center justify-between">
          {/* Breadcrumbs */}
          <div className="flex-1 min-w-0">
            <BreadcrumbNav items={breadcrumbItems} />
          </div>

          {/* Metadata Inputs for Templates (conditionally rendered) */}
          {type === 'template' && !isLoading && (
              <div className="flex items-center space-x-2 ml-4">
                  <Input 
                      type="text"
                      placeholder="Template Name"
                      value={templateMetadata.name}
                      onChange={(e) => handleMetadataChange('name', e.target.value)}
                      className="input input-sm dark:bg-surface-light"
                  />
              </div>
          )}
      </div>

      {/* Main Content Area - Editor or Loading Indicator */}
      <div className="flex-grow relative overflow-hidden"> {/* Ensure parent has overflow hidden */}
          {isLoading ? (
              <div className="absolute inset-0 flex justify-center items-center bg-white dark:bg-surface">
                  <Spinner size="large" />
              </div>
          ) : isEmptyTemplate ? ( // <-- Check if it's an empty template
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-white dark:bg-surface text-center p-4">
                  <Spinner size="large" />
                  <p className="mt-4 text-lg font-medium text-neutral-700 dark:text-neutral-300">
                      AI is generating template content...
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      The content will appear here once generated. You may need to refresh the page.
                  </p>
              </div>
          ) : (
              <DocumentEditor
                  ref={editorRef}
                  key={id || 'new'} // Ensure re-render on ID change
                  initialContent={content}
                  isDirty={isDirty}
                  isSaving={isSaving}
                  saveStatus={saveStatus}
                  onSave={handleSave}
                  onDirtyChange={handleDirtyChange}
                  onSaveStatusChange={() => {}} // Placeholder, parent manages status
                  editorItem={{ type: type as EditorType, id: id! }}
              />
          )}
      </div>

      {/* Footer Buttons (Save/Cancel) */}
      <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-t border-neutral-200 dark:border-gray-700">
        <Button onClick={handleCancel} variant="outline" size="sm">Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving || !isDirty} size="sm">
            {isSaving ? <Spinner size="xs" className="mr-1.5" /> : null}
            {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default EditPage; 