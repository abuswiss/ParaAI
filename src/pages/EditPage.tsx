import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import * as documentService from '@/services/documentService';
import * as templateService from '@/services/templateService';
import { DocumentTemplate } from '@/services/templateService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import BreadcrumbNav, { BreadcrumbItemDef } from '@/components/layout/BreadcrumbNav';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { Input } from '@/components/ui/Input';
import { 
  isNavCollapsedAtom, 
  activeEditorTypeAtom, 
  EditorType,
  activeCaseIdAtom
} from '@/atoms/appAtoms';
import { CheckCircle, XCircle, Dot, Save, FilePlus, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import * as caseService from '@/services/caseService';
import { Case } from '@/types/case';
import { extractVariables, prefillVariables, resolveVariables } from '@/lib/templateUtils.ts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

// Define interface for editor item details
interface EditorItemDetails {
  id?: string;
  templateId?: string;
  templateName?: string;
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

// Define Document type to avoid errors
interface DocumentType {
  id: string;
  filename?: string;
  editedContent?: string;
  extractedText?: string;
  template_id?: string;
}

// Define Variable State Type
interface TemplateVariable {
  name: string; // The variable name (e.g., client_name)
  value: string | null; // Current value (prefilled or user-entered)
  status: 'pending' | 'prefilled' | 'missing' | 'user-filled';
  originalPlaceholder: string; // e.g., {{client_name}}
}

// Define type for initially extracted variables
interface ExtractedVariable {
  name: string;
  placeholder: string;
}

const EditPage: React.FC = () => {
  const { type, id } = useParams<{ type: 'document' | 'template', id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const [editorItem, setEditorItem] = useState<EditorItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false); 
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [initialContent, setInitialContent] = useState<string>('<p></p>');
  const [processedContent, setProcessedContent] = useState<string>('<p></p>');
  
  // Add a ref to store the current editor content
  const editorContentRef = useRef<string>('');

  const activeCaseId = useAtomValue(activeCaseIdAtom); 
  const setIsNavCollapsed = useSetAtom(isNavCollapsedAtom);
  const setActiveEditorType = useSetAtom(activeEditorTypeAtom);

  const isNew = id === undefined || id === 'new';
  
  // Check if creating a new document from a template
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const templateId = useMemo(() => queryParams.get('templateId'), [queryParams]);
  const templateName = useMemo(() => queryParams.get('templateName'), [queryParams]);
  const caseIdFromQuery = useMemo(() => queryParams.get('caseId'), [queryParams]); // Keep for initial check if needed
  
  const isCreatingFromTemplate = isNew && type === 'document' && !!templateId;

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
    setCaseData(null);
    setVariables([]);
    setInitialContent('<p></p>');
    setProcessedContent('<p></p>');
    // Initialize the ref with empty string
    editorContentRef.current = '';

    const loadData = async () => {
      let loadedItem: Partial<EditorItemDetails> = {};
      let loadedContent = '<p></p>';
      let fetchedCaseData: Case | null = null;

      try {
        if (!type) throw new Error('Editor type is required');

        let targetCaseId: string | null = null;

        if (isNew) {
          if (type === 'document') {
            targetCaseId = caseIdFromQuery || activeCaseId; // Determine the case ID to use

            if (!targetCaseId) {
              throw new Error('Cannot create document draft without a valid Case ID.');
            }
            
            // Fetch case data if we have a targetCaseId
            if (targetCaseId) {
              try {
                const { data, error: caseError } = await caseService.getCaseById(targetCaseId);
                if (caseError) throw new Error(`Failed to fetch case data: ${caseError.message}`);
                if (!data) throw new Error(`Case with ID ${targetCaseId} not found.`);
                fetchedCaseData = data;
                setCaseData(data);
                console.log('Fetched case data:', fetchedCaseData);
              } catch (err) {
                 const msg = err instanceof Error ? err.message : 'Unknown error';
                 toast.error(`Failed to load case data: ${msg}`);
                 setError(`Failed to load case data: ${msg}`);
                 // Decide if we should stop or continue without case data for pre-filling
                 // For now, let's continue but pre-filling won't work
              }
            }

            if (isCreatingFromTemplate && templateId) {
              // Load template content for the new document
              loadedItem = { 
                templateId: templateId, 
              };
              try {
                const { data: templateData, error: templateError } = await templateService.getTemplateById(templateId);
                if (templateError) throw templateError;
                if (!templateData) throw new Error('Template not found.');
                loadedContent = templateData.content || '<p></p>';
                loadedItem.name = `Draft from ${templateData.name || 'Template'}`;
                loadedItem.templateName = templateData.name || 'Template';

                if (!templateData) throw new Error('Template not found.');
                loadedContent = templateData.content || '<p></p>';
                // Update loadedItem with template name
                loadedItem.name = `Draft from ${templateData.name || 'Template'}`;
                loadedItem.templateName = templateData.name || 'Template';

                // --- Variable Extraction and Prefilling --- 
                setInitialContent(loadedContent);
                const extractedVars = extractVariables(loadedContent);
                console.log('Extracted Vars:', extractedVars);
                
                if (extractedVars.length > 0 && fetchedCaseData) {
                  const { content: prefilledContent, variableStates } = prefillVariables(loadedContent, fetchedCaseData, extractedVars);
                  setVariables(variableStates);
                  setProcessedContent(prefilledContent); 
                  editorContentRef.current = prefilledContent;
                  console.log('Prefilled Content:', prefilledContent);
                  console.log('Variable States:', variableStates);
                  toast.info(`Prefilled variables using case data. Please fill in any remaining fields.`);
                } else {
                  // No variables found or no case data for prefilling
                  setVariables([]);
                  setProcessedContent(loadedContent);
                  editorContentRef.current = loadedContent;
                  if (extractedVars.length > 0) {
                      toast.warning('Could not prefill variables: Case data missing or failed to load.');
                      // Initialize variable state as missing
                      setVariables(extractedVars.map((v: ExtractedVariable) => ({ 
                          name: v.name, 
                          value: null, 
                          status: 'missing', 
                          originalPlaceholder: v.placeholder 
                      })))
                  } else {
                      toast.info(`Loaded template content. No variables found.`);
                  }
                }
                // --- End Variable Logic ---
                
              } catch (tmplErr) {
                const msg = tmplErr instanceof Error ? tmplErr.message : 'Unknown error';
                toast.error(`Failed to load template content: ${msg}`);
                setError(`Failed to load template content: ${msg}`);
                // Allow continuing with an empty draft even if template load fails
                loadedContent = '<p>Error loading template content.</p>'; 
              }
            } else {
              // Standard new document (not from template)
              loadedItem = { name: 'New Document' };
              loadedContent = '<p></p>';
              setInitialContent(loadedContent);
              setProcessedContent(loadedContent);
              editorContentRef.current = loadedContent;
              setVariables([]);
            }
          } else { // template
            loadedItem = { name: '', description: '', category: 'other', tags: '', content: '<p></p>' };
            loadedContent = '<p></p>';
            setInitialContent(loadedContent);
            setProcessedContent(loadedContent);
            editorContentRef.current = loadedContent;
            setVariables([]);
          }
        } else { // Editing existing item
          if (!id) throw new Error(`${type} ID is required`);
          if (type === 'document') {
            const { data, error } = await documentService.getDocumentById(id);
            if (error) throw error;
            if (!data) throw new Error('Document not found.');
            loadedItem = {
              id: data.id,
              name: data.filename || `Document ${id}`,
            };
            loadedContent = data.editedContent || data.extractedText || '<p></p>'; // Prioritize edited content
            setInitialContent(loadedContent);
            setProcessedContent(loadedContent);
            editorContentRef.current = loadedContent;
            setVariables([]);
          } else { // template
            const { data, error } = await templateService.getTemplateById(id);
            if (error) throw error;
            if (!data) throw new Error('Template not found.');
            loadedItem = {
              id: data.id,
              name: data.name || '',
              description: data.description || '',
              category: data.category || 'other',
              tags: data.tags?.join(', ') || '',
            };
             loadedContent = data.content || '<p></p>';
             setInitialContent(loadedContent);
             setProcessedContent(loadedContent);
             editorContentRef.current = loadedContent;
             setVariables([]);
          }
        }
        
        // Initialize the editorContentRef with loaded content
        editorContentRef.current = loadedContent;
        
        setEditorItem(prev => ({ ...(prev || {}), ...loadedItem, content: loadedContent } as EditorItemDetails));

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
    // Dependency array should reflect what triggers a reload
  }, [type, id, isNew, isCreatingFromTemplate, templateId, activeCaseId, caseIdFromQuery]); // Simplified dependency array

  // --- Derived State ---
  const missingVariables = useMemo(() => variables.filter(v => v.status === 'missing'), [variables]);
  const hasMissingVariables = useMemo(() => missingVariables.length > 0, [missingVariables]);

  // Handler for Tiptap editor content changes
  const handleContentChange = useCallback((newContent: string) => {
    // Update the ref instead of state
    editorContentRef.current = newContent;
    if (!isDirty) setIsDirty(true);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  }, [isDirty, saveStatus]);

  // Handler for variable input changes
  const handleVariableChange = useCallback((variableName: string, value: string) => {
    setVariables(prevVars => prevVars.map(v => 
      v.name === variableName 
        ? { ...v, value: value, status: 'user-filled' } 
        : v
    ));
    if (!isDirty) setIsDirty(true);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  }, [isDirty, saveStatus]);

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
    if (!type || !editorItem || !user) {
      if (!user) toast.error('Authentication error. Cannot save.');
      return;
    }

    // --- Variable Validation (when creating from template) ---
    if (isCreatingFromTemplate) {
      const firstMissingVar = variables.find(v => !v.value); // Find any var with null or empty string value
      if (firstMissingVar) {
        toast.error(`Please provide a value for the variable: ${firstMissingVar.name}`);
        // Optional: Focus the input field
        document.getElementById(`var-${firstMissingVar.name}`)?.focus();
        return; // Prevent saving
      }
    }
    // --- End Variable Validation ---

    // Don't save if not dirty, unless creating from template (always save after validation)
    if (!isDirty && !isCreatingFromTemplate) {
      toast.info('No changes to save.');
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      let savedItemId: string | undefined = editorItem.id;
      let navigateTo: string | null = null;
      let contentToSave = editorContentRef.current; // Default to current editor content

      // --- Resolve Content (when creating from template using resolveVariables) ---
      if (isCreatingFromTemplate && initialContent) {
        // Use resolveVariables with the original template content and current variable states
        contentToSave = resolveVariables(initialContent, variables);
        console.log("Resolved final content using resolveVariables:", contentToSave);
      }
      // --- End Resolve Content ---

      if (type === 'document') {
        if (!activeCaseId) {
          throw new Error('Cannot save document without an active case.');
        }

        if (isNew) { // Covers both standard new and new from template
          let docName = editorItem.name.trim();
          if (!docName || docName === 'New Document') {
            docName = isCreatingFromTemplate ? `Draft from ${editorItem.templateName || 'Template'}` : `Untitled Document`;
          }
          
          // Use contentToSave here
          const { data: newDoc, error } = await documentService.createDocument(
            user.id,
            activeCaseId,
            {
              content: contentToSave, // Use the potentially resolved content
              filename: docName,
              ...(editorItem.templateId ? { template_id: editorItem.templateId } : {})
            }
          );

          if (error) throw error;
          savedItemId = newDoc?.id;
          navigateTo = `/view/document/${savedItemId}`;
          toast.success(`Document '${docName}' created successfully.`);
          setIsDirty(false); // Reset dirty state after successful save

        } else { // Updating existing document
          if (!id) throw new Error('Document ID is missing for update.');
          // Note: When updating an existing document, we continue to use the live editor content
          // The variable inputs are primarily for initial creation from template
          const { error } = await documentService.updateDocument(id, {
            editedContent: contentToSave, // Use contentToSave (which is editorContentRef for updates)
            filename: editorItem.name.trim() || undefined,
          });
          if (error) throw error;
          toast.success(`Document '${editorItem.name}' updated successfully.`);
          setIsDirty(false); // Reset dirty state after successful save
        }
      } else { // Saving a template
           const nameToSave = editorItem.name.trim() || 'Untitled Template';
           const descriptionToSave = editorItem.description?.trim() || ''; // Always provide a string
           const categoryToSave = editorItem.category || 'other';
           const tagsToSave = editorItem.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];

           // Use editorContentRef.current when saving templates as variables are not resolved in the same way
           const templateContent = editorContentRef.current;

           if (isNew) {
             const { data: newTemplate, error } = await templateService.createTemplate({
                 name: nameToSave,
                 description: descriptionToSave,
                 category: categoryToSave,
                 content: templateContent, // Use current editor content for templates
                 variables: extractVariables(templateContent).map((v: ExtractedVariable) => v.name),
                 tags: tagsToSave,
                 isPublic: false
             });
             if (error) throw error;
             savedItemId = newTemplate?.id;
             navigateTo = `/view/template/${savedItemId}`;
             toast.success(`Template '${nameToSave}' created successfully.`);
             setIsDirty(false); // Reset dirty state
           } else {
             if (!id) throw new Error('Template ID is missing for update.');
             const { error } = await templateService.updateTemplate(id, {
                 name: nameToSave,
                 description: descriptionToSave,
                 category: categoryToSave,
                 content: templateContent, // Use current editor content for templates
                 variables: extractVariables(templateContent).map((v: ExtractedVariable) => v.name),
                 tags: tagsToSave,
             });
             if (error) throw error;
             toast.success(`Template '${nameToSave}' updated successfully.`);
             setIsDirty(false); // Reset dirty state
           }
      }

      setSaveStatus('success');
      if (navigateTo) {
        navigate(navigateTo);
      }

    } catch (err) {
      console.error("Error saving:", err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save ${type}: ${message}`);
      setSaveStatus('error');
      toast.error(`Failed to save ${type}: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Other Handlers (Cancel, Navigation, etc.) ---
  const handleCancelAttempt = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      navigateBack();
    }
  };

  const navigateBack = () => {
    // Determine where to navigate back to
    if (type === 'document' && editorItem?.id && activeCaseId) {
      navigate(`/cases/${activeCaseId}/documents/${editorItem.id}`); // Go to document view
    } else if (type === 'document' && activeCaseId) {
       navigate(`/cases/${activeCaseId}`); // Go to case dashboard if new/no ID
    } else if (type === 'template' && editorItem?.id) {
       navigate(`/templates/${editorItem.id}`); // Go to template view
    } else if (type === 'template') {
        navigate('/templates'); // Go to template list
    } else {
      navigate(-1); // Fallback to previous page
    }
  };

  const confirmCancel = () => {
    setIsDirty(false); // Mark as not dirty since we are discarding changes
    setShowCancelConfirm(false);
    navigateBack();
  };

  // --- UI Components ---
  const SaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Spinner size="sm" className="w-4 h-4" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
         return isDirty ? <Dot className="w-4 h-4 text-blue-500 animate-pulse" /> : null;
      default:
        return null;
    }
  };

  const breadcrumbItems: BreadcrumbItemDef[] = useMemo(() => {
    const items: BreadcrumbItemDef[] = [];
    if (type === 'document' && activeCaseId) {
      items.push({ name: 'Cases', path: '/cases' });
      items.push({ name: `Case ${activeCaseId}`, path: `/cases/${activeCaseId}` }); // Link to specific case needed?
      items.push({ name: isCreatingFromTemplate ? `New Document from ${editorItem?.templateName}` : (editorItem?.name || (isNew ? 'New Document' : 'Edit Document')) });
    } else if (type === 'template') {
      items.push({ name: 'Templates', path: '/templates' });
      items.push({ name: editorItem?.name || (isNew ? 'New Template' : 'Edit Template') });
    }
    return items;
  }, [type, activeCaseId, editorItem, isNew, isCreatingFromTemplate]);

  // --- Render Logic ---
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  if (error && !editorItem) { // Show full page error only if loading failed completely
    return (
        <div className="p-4 md:p-6 flex flex-col items-center justify-center h-screen">
            <Alert variant="destructive" className="max-w-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Editor</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
                Go Back
            </Button>
        </div>
    );
  }
  
  if (!type || !editorItem) {
      // This case should ideally not be reached if loading logic is correct
      return <div className="p-6">Error: Editor type or item data is missing.</div>;
  }

  const pageTitle = isCreatingFromTemplate 
      ? `New Document from "${editorItem.templateName}"` 
      : (isNew ? `New ${type === 'document' ? 'Document' : 'Template'}` : `Edit ${type === 'document' ? 'Document' : 'Template'}`);

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
           {/* Breadcrumbs can be integrated here or kept separate */}
           <BreadcrumbNav items={breadcrumbItems} />
           <h1 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 truncate mt-1">{pageTitle}</h1>
        </div>
        
        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
          <div className="flex items-center mr-2">
            <SaveStatusIcon />
          </div>
           {/* Conditionally render Save vs Create button */}
           {isCreatingFromTemplate || (isNew && type === 'document') || (isNew && type === 'template') ? (
             <Button onClick={handleSave} disabled={isSaving || !user} size="sm">
               {isSaving ? <Spinner size="sm" className="mr-1" /> : (type === 'document' ? <FilePlus className="mr-1 h-4 w-4" /> : <Save className="mr-1 h-4 w-4" />)}
               {isSaving ? 'Creating...' : (type === 'document' ? 'Create Document' : 'Create Template')}
             </Button>
           ) : (
             <Button onClick={handleSave} disabled={isSaving || (isCreatingFromTemplate && hasMissingVariables && !isDirty)} size="sm" title={isCreatingFromTemplate && hasMissingVariables ? "Please fill all required variables" : undefined}>
               {isSaving ? <Spinner size="sm" className="mr-1" /> : <Save className="mr-1 h-4 w-4" />}
               {isSaving ? 'Creating...' : (isNew ? 'Create' : 'Save')} {type}
             </Button>
           )}
          
          <Button variant="outline" onClick={handleCancelAttempt} disabled={isSaving} size="sm">
            Cancel
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Metadata Fields (conditional for template) */}
        {type === 'template' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
            <div>
              <Label>
                Template Name
              </Label>
              <Input
                id="templateName"
                value={editorItem.name}
                onChange={(e) => handleMetadataInputChange('name', e.target.value)}
                placeholder="e.g., Client Engagement Letter"
                disabled={isSaving}
                className="mt-1"
              />
            </div>
            <div>
              <Label>
                Category
              </Label>
               <Select 
                  value={editorItem.category || 'other'} 
                  onValueChange={handleCategoryChange}
                  disabled={isSaving}
                >
                  <SelectTrigger id="templateCategory" className="mt-1">
                      <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                      {templateCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>
                Description
              </Label>
              <Input
                id="templateDescription"
                value={editorItem.description || ''}
                onChange={(e) => handleMetadataInputChange('description', e.target.value)}
                placeholder="Briefly describe the template's purpose"
                disabled={isSaving}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label>
                Tags (comma-separated)
              </Label>
              <Input
                id="templateTags"
                value={editorItem.tags || ''}
                onChange={(e) => handleMetadataInputChange('tags', e.target.value)}
                placeholder="e.g., contract, retainer, litigation"
                disabled={isSaving}
                className="mt-1"
              />
            </div>
          </div>
        )}
        
        {/* Document Name Field (only when editing existing docs or creating new ones NOT from template) */}
        {type === 'document' && !isCreatingFromTemplate && (
           <div className="p-4 border rounded-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
              <Label>
                Document Name
              </Label>
              <Input
                id="documentName"
                value={editorItem.name}
                onChange={(e) => handleMetadataInputChange('name', e.target.value)}
                placeholder="Enter document name"
                disabled={isSaving}
                className="mt-1"
              />
            </div>
        )}

        {/* Template Variable Input Section (Conditional) */}
        {isCreatingFromTemplate && variables.length > 0 && (
          <Card className="mb-4 bg-muted/40">
            <CardHeader>
              <CardTitle>Fill Template Variables</CardTitle>
              <CardDescription>
                {hasMissingVariables
                  ? "Please provide values for the following variables found in the template. Some may be pre-filled from the case data."
                  : "All variables were pre-filled from the case data. Review and adjust if needed."
                }
              </CardDescription>
              <p className="text-sm text-muted-foreground pt-1">
                The final document will be generated using the values entered here.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <TooltipProvider>
                {variables.map((variable) => (
                  <div key={variable.name} className="space-y-1">
                    <div className="flex items-center">
                      <label htmlFor={`var-${variable.name}`} className="flex items-center text-sm font-medium">
                        {variable.name}
                        {variable.status === 'prefilled' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
                            </TooltipTrigger>
                            <TooltipContent>
                               <p>Pre-filled from case data</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {variable.status === 'missing' && (
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <AlertCircle className="h-4 w-4 text-orange-500 ml-2" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Requires input</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {variable.status === 'user-filled' && (
                           <Tooltip>
                             <TooltipTrigger asChild>
                                <Dot className="h-5 w-5 text-blue-500 ml-1" />
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Value entered by user</p>
                             </TooltipContent>
                           </Tooltip>
                        )}
                      </label>
                    </div>
                    <Input
                      id={`var-${variable.name}`}
                      value={variable.value || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={`Enter value for ${variable.name}...`}
                      className={cn(
                        (variable.status === 'missing' && !variable.value) && "border-orange-400 focus-visible:ring-orange-400"
                      )}
                    />
                  </div>
                ))}
              </TooltipProvider>
            </CardContent>
          </Card>
        )}

        {/* Tiptap Editor */}
        <div className="h-[calc(100vh-280px)] md:h-[calc(100vh-240px)] min-h-[400px]"> 
          <TiptapEditor
            content={editorContentRef.current} 
            onChange={handleContentChange}
            editable={!isSaving}
            placeholder={type === 'template' ? 'Enter template content with {{placeholders}}...' : 'Start drafting your document...'}
            // Pass necessary context for AI features if applicable
            caseId={activeCaseId ?? undefined} 
            documentId={type === 'document' && !isNew ? id : undefined}
          />
        </div>
      </div>

       {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                      You have unsaved changes. Are you sure you want to discard them and leave this page?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmCancel} className={buttonVariants({ variant: "destructive" })}>
                    Discard
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditPage;