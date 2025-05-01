import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import BreadcrumbNav, { BreadcrumbItemDef } from '@/components/layout/BreadcrumbNav';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Input } from '@/components/ui/Input';
import { 
  isNavCollapsedAtom, 
  activeEditorTypeAtom, 
  EditorType,
  activeCaseIdAtom
} from '@/atoms/appAtoms';
import { CheckCircle, XCircle, Dot } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Icons } from '@/components/ui/Icons';

// Define interface for editor item details
interface EditorItemDetails {
  id?: string;
  name: string;
  content: string;
  description?: string;
  category?: DocumentTemplate['category'];
  tags?: string;
}

// Use only valid categories defined in the service type
const templateCategories: DocumentTemplate['category'][] = [
  'contract', 'letter', 'pleading', 'memorandum', 'agreement', 'other'
];

const EditPage: React.FC = () => {
  const { type, id } = useParams<{ type: 'document' | 'template', id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editorItem, setEditorItem] = useState<EditorItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>(''); 
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false); 
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const activeCaseId = useAtomValue(activeCaseIdAtom); 
  const setIsNavCollapsed = useSetAtom(isNavCollapsedAtom);
  const setActiveEditorType = useSetAtom(activeEditorTypeAtom);

  const isNew = id === undefined || id === 'new';

  // Effect to control layout state
  useEffect(() => {
    if (type) {
      setIsNavCollapsed(true);
      setActiveEditorType(type as EditorType);
      return () => {
        setActiveEditorType(null);
      };
    } else {
      setActiveEditorType(null);
    }
  }, [type, setIsNavCollapsed, setActiveEditorType]);

  // Effect to load data
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setSaveStatus('idle');
    setIsDirty(false);
    setEditorItem(null);
    setCurrentContent('');

    const loadData = async () => {
      let loadedItem: EditorItemDetails | null = null;
      try {
        if (!type) throw new Error('Editor type is required');

        if (isNew) {
          if (type === 'document') {
            loadedItem = { name: 'New Document', content: '<p></p>' };
          } else { // template
            loadedItem = { name: '', description: '', category: 'other', tags: '', content: '<p></p>' };
          }
        } else {
          if (!id) throw new Error(`${type} ID is required`);
          if (type === 'document') {
            const { data, error } = await documentService.getDocumentById(id);
            if (error) throw error;
            if (!data) throw new Error('Document not found.');
            loadedItem = {
              id: data.id,
              name: data.filename || `Document ${id}`,
              content: data.editedContent || data.extractedText || '<p></p>',
            };
          } else { // template
            const { data, error } = await templateService.getTemplateById(id);
            if (error) throw error;
            if (!data) throw new Error('Template not found.');
            loadedItem = {
              id: data.id,
              name: data.name || '',
              content: data.content || '<p></p>',
              description: data.description || '',
              category: data.category || 'other',
              tags: data.tags?.join(', ') || '',
            };
          }
        }
        setEditorItem(loadedItem);
        setCurrentContent(loadedItem?.content || '<p></p>');

      } catch (err) {
        console.error("Error loading editor data:", err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load ${type}: ${message}`);
        setSaveStatus('error');
        toast.error(`Failed to load ${type}: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [type, id, isNew]);

  // Handler for Tiptap editor content changes
  const handleContentChange = useCallback((newContent: string) => {
    if (newContent !== currentContent) {
         setCurrentContent(newContent);
         if (!isDirty) setIsDirty(true);
         if (saveStatus !== 'idle') setSaveStatus('idle');
    }
  }, [currentContent, isDirty, saveStatus]);

  // --- Metadata Change Handlers ---
  const handleMetadataInputChange = useCallback((field: keyof EditorItemDetails, value: string) => {
    setEditorItem(prev => prev ? { ...prev, [field]: value } : null);
    if (!isDirty) setIsDirty(true);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  }, [isDirty, saveStatus]);

  const handleCategoryChange = useCallback((value: DocumentTemplate['category']) => {
    setEditorItem(prev => prev ? { ...prev, category: value } : null);
    if (!isDirty) setIsDirty(true);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  }, [isDirty, saveStatus]);

  // --- Save Handler ---
  const handleSave = async () => {
    if (!type || !editorItem || !isDirty || !user) {
        if (!user) toast.error('Authentication error. Cannot save.');
        if (!isDirty) toast.info('No changes to save.');
        return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      let savedItemId: string | undefined = editorItem.id;

      if (type === 'document') {
          if (isNew && !activeCaseId) {
               throw new Error('Cannot create document without an active case.');
          }
          if (isNew) {
              const filename = editorItem.name !== 'New Document' ? editorItem.name : undefined;
              const { data, error } = await documentService.createDocument(user.id, activeCaseId!, {
                  content: currentContent,
                  filename: filename
              });
              if (error) throw error;
              if (!data?.id) throw new Error('Create document did not return an ID.');
              savedItemId = data.id;
              toast.info('Creating new document...');
          } else {
              if (!editorItem.id) throw new Error('Document ID is required for update');
              const { success, error } = await documentService.updateDocument(editorItem.id, {
                  editedContent: currentContent 
              });
              if (error || !success) throw error || new Error('Update document failed.');
          }
      } else if (type === 'template') {
          const variables = extractVariables(currentContent);
          const parsedTags = editorItem.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
          const categoryToSave = editorItem.category || 'other'; 
          const descriptionToSave = editorItem.description || '';
          const templateData = {
            name: editorItem.name,
            description: descriptionToSave,
            category: categoryToSave, 
            content: currentContent,
            variables,
            tags: parsedTags,
            isPublic: false, 
          };

          if (isNew) {
            const { data, error } = await templateService.createTemplate(templateData);
            if (error) throw error;
            if (!data?.id) throw new Error('Create template did not return an ID.');
            savedItemId = data.id;
          } else {
            if (!editorItem.id) throw new Error('Template ID is required for update');
            const { error } = await templateService.updateTemplate(editorItem.id, templateData);
            if (error) throw error;
          }
      }

      setIsDirty(false);
      setSaveStatus('success');
      toast.success(`${type === 'template' ? 'Template' : 'Document'} saved successfully!`);

      setEditorItem(prev => prev ? { ...prev, id: savedItemId, content: currentContent } : null);

      if (isNew && savedItemId) {
          navigate(`/edit/${type}/${savedItemId}`, { replace: true });
      } 

    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      setSaveStatus('error');
      toast.error(`Failed to save ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Fixed regular expression for extracting variables
  const extractVariables = (htmlContent: string): string[] => {
    const regex = /<mark>\{\{\s*([a-zA-Z0-9_]+)\s*\}\}<\/mark>/g;
    const matches = htmlContent.matchAll(regex);
    const variables = new Set<string>();
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  };

  const handleCancelAttempt = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      navigateBack();
    }
  };

  const navigateBack = () => {
      if (editorItem?.id && !isNew) {
           navigate(`/view/${type}/${editorItem.id}`);
      } else {
           navigate(type === 'template' ? '/templates' : '/documents');
      }
  };

  // --- Breadcrumb Generation ---
  const breadcrumbItems = useMemo((): BreadcrumbItemDef[] => {
    if (!type) return [];

    const base = type === 'document' 
      ? { name: 'Documents', path: '/documents' } 
      : { name: 'Templates', path: '/templates' };

    const itemName = isNew ? `New ${type === 'document' ? 'Document' : 'Template'}` 
                         : (editorItem?.name || `${type === 'document' ? 'Document' : 'Template'} ${editorItem?.id?.substring(0, 6)}...`);
    
    const items: BreadcrumbItemDef[] = [base];

    if (!isNew && editorItem?.id) {
        items.push({ name: itemName, path: `/view/${type}/${editorItem.id}` }); 
        items.push({ name: 'Edit' }); 
    } else {
        items.push({ name: itemName }); 
    }
    
    return items;
    
  }, [type, id, isNew, editorItem]);

  // --- Save Status Icon ---
  const SaveStatusIcon = () => {
    if (saveStatus === 'saving') return <Spinner size="xs" className="text-muted-foreground" />;
    if (saveStatus === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    if (saveStatus === 'success' && !isDirty) return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    if (isDirty) return <Dot className="h-6 w-6 text-yellow-500 -ml-1 -mr-1" />; 
    return null; // idle and clean
  };

  // --- Render Logic ---
  if (!type) {
    return <div className="p-4 text-destructive">Error: Editor type missing.</div>;
  }

  if (error) {
      return (
          <div className="p-4">
               <Alert variant="destructive">
                   <Icons.Alert className="h-4 w-4" />
                   <AlertTitle>Error Loading Editor</AlertTitle>
                   <AlertDescription>{error}</AlertDescription>
                    <Button onClick={() => navigate(-1)} variant="outline" size="sm" className="mt-4">Go Back</Button>
               </Alert>
          </div>
      );
  }

  const editorPlaceholder = type === 'template' 
    ? 'Start typing template. Use {{variable}} in <mark> tags...' 
    : 'Start typing document content...';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex-shrink-0 p-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <BreadcrumbNav items={breadcrumbItems} />
          </div>

          {/* Template Metadata Inputs: Using implicit label association */}
          {type === 'template' && !isLoading && editorItem && (
              <div className="flex items-center gap-3 flex-wrap justify-end">
                  {/* Name */}
                  <Label className="grid w-full max-w-xs items-center gap-1.5">
                       <span className="text-xs">Name</span>
                       <Input 
                          id="template-name"
                          type="text"
                          placeholder="Template Name"
                          value={editorItem.name || ''}
                          onChange={(e) => handleMetadataInputChange('name', e.target.value)}
                          className="h-8 text-sm"
                      />
                  </Label>
                  {/* Description */}
                   <Label className="grid w-full max-w-xs items-center gap-1.5">
                       <span className="text-xs">Description</span>
                       <Input 
                          id="template-desc"
                          type="text"
                          placeholder="Optional description"
                          value={editorItem.description || ''}
                          onChange={(e) => handleMetadataInputChange('description', e.target.value)}
                          className="h-8 text-sm"
                      />
                  </Label>
                  {/* Category */}
                   <Label className="grid w-40 items-center gap-1.5">
                       <span className="text-xs">Category</span>
                       <Select 
                            value={editorItem.category || 'other'}
                            onValueChange={(value: string) => handleCategoryChange(value as DocumentTemplate['category'])} 
                        >
                           <SelectTrigger id="template-category" className="h-8 text-sm">
                               <SelectValue placeholder="Select category" />
                           </SelectTrigger>
                           <SelectContent>
                               {templateCategories.map(cat => (
                                   <SelectItem key={cat} value={cat} className="capitalize text-sm">
                                       {cat}
                                   </SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                   </Label>
                   {/* Tags */}
                    <Label className="grid w-full max-w-xs items-center gap-1.5">
                       <span className="text-xs">Tags (comma-separated)</span>
                       <Input 
                          id="template-tags"
                          type="text"
                          placeholder="e.g., contract, nda, client"
                          value={editorItem.tags || ''}
                          onChange={(e) => handleMetadataInputChange('tags', e.target.value)}
                           className="h-8 text-sm"
                      />
                  </Label>
              </div>
          )}
      </div>

      {/* Main Content Area with TiptapEditor */}
      <div className="flex-grow relative overflow-hidden p-4">
          {isLoading ? (
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-background/80 z-10">
                  <Spinner size="lg" />
                  <p className="mt-2 text-muted-foreground text-sm">Loading...</p>
              </div>
          ) : (
              <TiptapEditor
                  key={id || 'new'} 
                  content={currentContent} 
                  editable={true}
                  placeholder={editorPlaceholder}
                  onChange={handleContentChange}
                  className="h-full shadow-inner" 
              />
          )}
      </div>

      {/* Footer Buttons */}
      <div className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-t border-border">
         {/* Cancel Button */}
         <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
            <AlertDialogTrigger asChild>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelAttempt}
                    disabled={isSaving} 
                >
                    Cancel
                </Button>
             </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
                <AlertDialogDescription>
                    You have unsaved changes. Are you sure you want to cancel and discard them?
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowCancelConfirm(false)}>Keep Editing</AlertDialogCancel> 
                    <AlertDialogAction onClick={() => { setShowCancelConfirm(false); navigateBack(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Discard Changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Save Button */}
        <div className="flex items-center gap-2">
             <div className="w-4 h-4 flex items-center justify-center" title={saveStatus === 'error' ? 'Save Error' : isDirty ? 'Unsaved Changes' : 'Saved'}>
                <SaveStatusIcon />
             </div>
             <Button onClick={handleSave} disabled={isSaving || !isDirty} size="sm">
                 {isSaving ? <Spinner size="xs" className="mr-1.5" /> : null}
                 {isSaving ? 'Saving...' : 'Save'}
             </Button>
         </div>
      </div>
    </div>
  );
};

export default EditPage;